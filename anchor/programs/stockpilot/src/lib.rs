use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

pub mod oracle;

use oracle::{amount_for_value, read_pyth_price, usd_value, OraclePrice};

declare_id!("CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK");

pub const VAULT_SEED: &[u8] = b"stockpilot_vault";
pub const AUTOPILOT_SEED: &[u8] = b"autopilot";
pub const ORACLE_POOL_SEED: &[u8] = b"oracle_pool";
pub const MAX_BASKET_ASSETS: usize = 8;
pub const MAX_POOL_SPREAD_BPS: u16 = 500;
pub const MAX_SLIPPAGE_LIMIT_BPS: u16 = 500;
pub const MAX_PRICE_AGE_LIMIT_SECS: u32 = 3_600;
pub const DEFAULT_COOLDOWN_SECONDS: i64 = 300; // 5 minute demo cooldown
pub const PROTOCOL_FEE_BPS: u64 = 15; // 0.15% protocol fee (15 bps of 10,000)
pub const PROTOCOL_TREASURY_PUBKEY: Pubkey = pubkey!("2KtVKiQCMbHrsdAPyjQVVnccpgvt3Y8ggrjgxXCSPyEo");

#[program]
pub mod stockpilot {
    use super::*;

    /// Initialize a new on-chain autonomous stock portfolio vault for the user
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        strategy_id: String,
        target_weights: Vec<u16>, // basis points (10,000 = 100%)
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        vault.owner = ctx.accounts.owner.key();
        vault.strategy_id = strategy_id;
        vault.target_weights = target_weights;
        vault.created_at = clock.unix_timestamp;
        vault.last_rebalance_ts = clock.unix_timestamp;
        vault.cooldown_seconds = DEFAULT_COOLDOWN_SECONDS;
        vault.total_rebalances = 0;
        vault.bump = ctx.bumps.vault;

        msg!("StockPilot Vault initialized for owner: {}", vault.owner);
        Ok(())
    }

    /// Deposit tokens into the user's autonomous portfolio vault with 0.15% protocol fee deduction
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let fee_amount = amount
            .checked_mul(PROTOCOL_FEE_BPS)
            .ok_or(StockPilotError::CalculationOverflow)?
            .checked_div(10_000)
            .unwrap_or(0);
        let vault_amount = amount
            .checked_sub(fee_amount)
            .ok_or(StockPilotError::CalculationOverflow)?;

        // 1. Transfer 0.15% protocol fee to the treasury token account
        if fee_amount > 0 {
            let fee_accounts = TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            };
            let fee_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), fee_accounts);
            token_interface::transfer_checked(fee_ctx, fee_amount, ctx.accounts.mint.decimals)?;
        }

        // 2. Transfer remaining 99.85% net amount to user's vault PDA
        let vault_accounts = TransferChecked {
            from: ctx.accounts.owner_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let vault_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), vault_accounts);
        token_interface::transfer_checked(vault_ctx, vault_amount, ctx.accounts.mint.decimals)?;

        msg!(
            "Deposited {} tokens (Vault: {}, Protocol Fee: {})",
            amount,
            vault_amount,
            fee_amount
        );
        Ok(())
    }

    /// Withdraw SPL tokens from the vault back to the owner
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let owner_key = ctx.accounts.owner.key();
        let seeds = &[
            VAULT_SEED,
            owner_key.as_ref(),
            &[ctx.accounts.vault.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        msg!("Withdrew {} tokens from StockPilot Vault to owner", amount);
        Ok(())
    }

    /// Withdraw native SOL from the vault PDA back to the owner
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        let vault_info = ctx.accounts.vault.to_account_info();
        let owner_info = ctx.accounts.owner.to_account_info();

        // The vault PDA is also a data account: it must stay rent-exempt or the
        // runtime rejects the transaction and the vault can never be used again.
        let rent_floor = Rent::get()?.minimum_balance(vault_info.data_len());
        let spendable = vault_info.lamports().saturating_sub(rent_floor);
        require!(spendable >= amount, StockPilotError::InsufficientFunds);

        **vault_info.try_borrow_mut_lamports()? -= amount;
        **owner_info.try_borrow_mut_lamports()? += amount;

        msg!("Withdrew {} lamports SOL from StockPilot Vault to owner", amount);
        Ok(())
    }

    /// On-chain state and timelock cooldown coordinator for autonomous rebalancing.
    /// Enforces owner authorization and timelock cooldown invariants on-chain,
    /// while multi-token swap execution is routed atomically via Jupiter on the client.
    pub fn rebalance(
        ctx: Context<Rebalance>,
        _drift_bps: Vec<i16>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;

        // Enforce timelock cooldown (learned from Solana Fall School escrow pattern)
        let now = clock.unix_timestamp;
        let unlock_at = vault
            .last_rebalance_ts
            .checked_add(vault.cooldown_seconds)
            .ok_or(StockPilotError::CalculationOverflow)?;

        require!(now >= unlock_at, StockPilotError::RebalanceCooldownActive);

        // Update vault state
        vault.last_rebalance_ts = now;
        vault.total_rebalances = vault
            .total_rebalances
            .checked_add(1)
            .ok_or(StockPilotError::CalculationOverflow)?;

        msg!(
            "Autonomous rebalance executed successfully! Total rebalances: {}",
            vault.total_rebalances
        );
        Ok(())
    }

    /// Create an oracle-priced liquidity pool. The admin funds it by transferring
    /// tokens into token accounts owned by the pool PDA.
    pub fn init_oracle_pool(ctx: Context<InitOraclePool>, spread_bps: u16) -> Result<()> {
        require!(spread_bps <= MAX_POOL_SPREAD_BPS, StockPilotError::InvalidConfig);
        let pool = &mut ctx.accounts.pool;
        pool.admin = ctx.accounts.admin.key();
        pool.spread_bps = spread_bps;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Owner signs the autopilot mandate: which key may rebalance, which assets,
    /// target weights, and the limits every keeper trade is checked against.
    pub fn configure_autopilot(
        ctx: Context<ConfigureAutopilot>,
        keeper: Pubkey,
        pool: Pubkey,
        assets: Vec<BasketAsset>,
        limits: AutopilotLimits,
    ) -> Result<()> {
        require!(
            (2..=MAX_BASKET_ASSETS).contains(&assets.len()),
            StockPilotError::InvalidConfig
        );
        let weight_sum: u32 = assets.iter().map(|a| a.target_bps as u32).sum();
        require!(weight_sum == 10_000, StockPilotError::InvalidConfig);
        for (i, a) in assets.iter().enumerate() {
            require!(
                assets[..i].iter().all(|b| b.mint != a.mint),
                StockPilotError::InvalidConfig
            );
        }
        require!(
            (1..=5_000).contains(&limits.drift_threshold_bps)
                && limits.max_slippage_bps <= MAX_SLIPPAGE_LIMIT_BPS
                && (1..=10_000).contains(&limits.max_trade_bps)
                && (1..=MAX_PRICE_AGE_LIMIT_SECS).contains(&limits.max_price_age_secs),
            StockPilotError::InvalidConfig
        );

        let config = &mut ctx.accounts.config;
        config.vault = ctx.accounts.vault.key();
        config.keeper = keeper;
        config.enabled = keeper != Pubkey::default();
        config.pool = pool;
        config.assets = assets;
        config.limits = limits;
        config.bump = ctx.bumps.config;

        msg!("Autopilot configured. Keeper: {}", keeper);
        Ok(())
    }

    /// Owner switches autopilot off. The keeper key loses all rights immediately.
    pub fn revoke_keeper(ctx: Context<RevokeKeeper>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.enabled = false;
        config.keeper = Pubkey::default();
        msg!("Autopilot keeper revoked");
        Ok(())
    }

    /// Owner turns autopilot off for good and gets the settings account's rent back.
    pub fn close_autopilot(_ctx: Context<CloseAutopilot>) -> Result<()> {
        msg!("Autopilot closed; rent refunded to owner");
        Ok(())
    }

    /// Admin pulls liquidity out of the pool. Once a pool token account is empty
    /// it is closed and its rent goes back to the admin.
    pub fn withdraw_pool_liquidity(ctx: Context<WithdrawPoolLiquidity>, amount: u64) -> Result<()> {
        let admin_key = ctx.accounts.admin.key();
        let pool_seeds: &[&[u8]] = &[ORACLE_POOL_SEED, admin_key.as_ref(), &[ctx.accounts.pool.bump]];

        if amount > 0 {
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.pool_token_account.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.admin_token_account.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    &[pool_seeds],
                ),
                amount,
                ctx.accounts.mint.decimals,
            )?;
            ctx.accounts.pool_token_account.reload()?;
        }

        if ctx.accounts.pool_token_account.amount == 0 {
            token_interface::close_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.pool_token_account.to_account_info(),
                    destination: ctx.accounts.admin.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[pool_seeds],
            ))?;
        }
        Ok(())
    }

    /// Admin closes the pool account and gets its rent back. Empty and close the
    /// pool's token accounts first with `withdraw_pool_liquidity`; any left open
    /// stay recoverable because re-creating the pool gives the same PDA.
    pub fn close_oracle_pool(_ctx: Context<CloseOraclePool>) -> Result<()> {
        msg!("Oracle pool closed; rent refunded to admin");
        Ok(())
    }

    /// Swap one basket asset for another inside the vault, at the Pyth price,
    /// against the oracle pool. Callable by the owner or the approved keeper.
    ///
    /// The keeper can only move value between the vault's own token accounts, and
    /// only when the trade reduces drift toward the owner's target weights. It can
    /// never withdraw, change the mandate, or trade on a stale or bad price.
    ///
    /// remaining_accounts: for every basket asset, in mandate order,
    /// `[vault's associated token account, Pyth PriceUpdateV2 account]`.
    pub fn rebalance_swap<'info>(
        ctx: Context<'_, '_, 'info, 'info, RebalanceSwap<'info>>,
        from_index: u8,
        to_index: u8,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let assets = config.assets.clone();
        let limits = config.limits;
        let vault_key = ctx.accounts.vault.key();
        let authority = ctx.accounts.authority.key();
        let is_owner = authority == ctx.accounts.vault.owner;
        let is_keeper = config.enabled && config.keeper != Pubkey::default() && authority == config.keeper;
        require!(is_owner || is_keeper, StockPilotError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        let unlock_at = ctx
            .accounts
            .vault
            .last_rebalance_ts
            .checked_add(ctx.accounts.vault.cooldown_seconds)
            .ok_or(StockPilotError::CalculationOverflow)?;
        require!(now >= unlock_at, StockPilotError::RebalanceCooldownActive);

        let n = assets.len();
        let (from_i, to_i) = (from_index as usize, to_index as usize);
        require!(from_i < n && to_i < n && from_i != to_i, StockPilotError::InvalidAsset);
        require!(amount_in > 0, StockPilotError::InvalidAsset);
        require_keys_eq!(ctx.accounts.from_mint.key(), assets[from_i].mint, StockPilotError::InvalidMint);
        require_keys_eq!(ctx.accounts.to_mint.key(), assets[to_i].mint, StockPilotError::InvalidMint);
        require!(
            assets[from_i].decimals == ctx.accounts.from_mint.decimals
                && assets[to_i].decimals == ctx.accounts.to_mint.decimals,
            StockPilotError::InvalidMint
        );
        require!(
            ctx.accounts.pool.spread_bps <= limits.max_slippage_bps,
            StockPilotError::SlippageExceeded
        );

        // Value the whole basket at oracle prices.
        let remaining = ctx.remaining_accounts;
        require!(remaining.len() == n * 2, StockPilotError::InvalidAsset);
        let token_program = ctx.accounts.token_program.key();
        require_keys_eq!(
            ctx.accounts.vault_from_account.key(),
            vault_holding_address(&vault_key, &assets[from_i].mint, &token_program),
            StockPilotError::InvalidTokenAccount
        );
        require_keys_eq!(
            ctx.accounts.vault_to_account.key(),
            vault_holding_address(&vault_key, &assets[to_i].mint, &token_program),
            StockPilotError::InvalidTokenAccount
        );
        let mut prices: Vec<OraclePrice> = Vec::with_capacity(n);
        let mut values: Vec<u128> = Vec::with_capacity(n);
        let mut total: u128 = 0;
        for (i, asset) in assets.iter().enumerate() {
            let token_info = &remaining[i * 2];
            let balance = read_vault_balance(token_info, &token_program, &asset.mint, &vault_key)?;
            let price = read_pyth_price(
                &remaining[i * 2 + 1],
                &asset.feed_id,
                now,
                limits.max_price_age_secs,
            )?;
            let value = usd_value(balance, &price, asset.decimals)?;
            total = total.checked_add(value).ok_or(StockPilotError::CalculationOverflow)?;
            values.push(value);
            prices.push(price);
        }
        require!(total > 0, StockPilotError::DriftBelowThreshold);

        // Only rebalance once drift crosses the owner's threshold, and only in the
        // direction that reduces it: sell an overweight asset, buy an underweight one.
        let target_value = |i: usize| total * assets[i].target_bps as u128 / 10_000;
        let threshold = total * limits.drift_threshold_bps as u128 / 10_000;
        let max_drift = (0..n).map(|i| values[i].abs_diff(target_value(i))).max().unwrap_or(0);
        require!(max_drift >= threshold, StockPilotError::DriftBelowThreshold);
        require!(
            values[from_i] > target_value(from_i) && values[to_i] < target_value(to_i),
            StockPilotError::TradeWorsensDrift
        );

        let from_decimals = ctx.accounts.from_mint.decimals;
        let to_decimals = ctx.accounts.to_mint.decimals;
        let value_in = usd_value(amount_in, &prices[from_i], from_decimals)?;
        let excess = values[from_i] - target_value(from_i);
        let deficit = target_value(to_i) - values[to_i];
        require!(value_in <= excess.min(deficit), StockPilotError::TradeWorsensDrift);
        require!(
            value_in <= total * limits.max_trade_bps as u128 / 10_000,
            StockPilotError::TradeTooLarge
        );

        let value_out = value_in * (10_000 - ctx.accounts.pool.spread_bps as u128) / 10_000;
        let amount_out = amount_for_value(value_out, &prices[to_i], to_decimals)?;
        require!(amount_out > 0 && amount_out >= min_amount_out, StockPilotError::SlippageExceeded);
        require!(
            ctx.accounts.pool_to_account.amount >= amount_out,
            StockPilotError::InsufficientPoolLiquidity
        );

        let from_before = ctx.accounts.vault_from_account.amount;
        let to_before = ctx.accounts.vault_to_account.amount;

        // Leg 1: vault -> pool, signed by the vault PDA.
        let owner_key = ctx.accounts.vault.owner;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, owner_key.as_ref(), &[ctx.accounts.vault.bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_from_account.to_account_info(),
                    mint: ctx.accounts.from_mint.to_account_info(),
                    to: ctx.accounts.pool_from_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount_in,
            from_decimals,
        )?;

        // Leg 2: pool -> vault, signed by the pool PDA.
        let pool_admin = ctx.accounts.pool.admin;
        let pool_seeds: &[&[u8]] = &[ORACLE_POOL_SEED, pool_admin.as_ref(), &[ctx.accounts.pool.bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.pool_to_account.to_account_info(),
                    mint: ctx.accounts.to_mint.to_account_info(),
                    to: ctx.accounts.vault_to_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[pool_seeds],
            ),
            amount_out,
            to_decimals,
        )?;

        // Verify the vault's balances moved by exactly what was promised.
        ctx.accounts.vault_from_account.reload()?;
        ctx.accounts.vault_to_account.reload()?;
        require!(
            from_before - ctx.accounts.vault_from_account.amount == amount_in
                && ctx.accounts.vault_to_account.amount - to_before == amount_out,
            StockPilotError::BalanceCheckFailed
        );

        let vault = &mut ctx.accounts.vault;
        vault.last_rebalance_ts = now;
        vault.total_rebalances = vault
            .total_rebalances
            .checked_add(1)
            .ok_or(StockPilotError::CalculationOverflow)?;

        emit!(RebalanceSwapped {
            vault: vault_key,
            authority,
            by_keeper: !is_owner,
            from_mint: assets[from_i].mint,
            to_mint: assets[to_i].mint,
            amount_in,
            amount_out,
            value_in_usd_micros: value_in as u64,
        });
        Ok(())
    }
}

/// The vault's one canonical holding account for a mint. Anyone can create extra
/// token accounts owned by the vault PDA, so valuing or trading through anything
/// else would let a caller hide holdings (e.g. pass an empty decoy) and fake drift.
fn vault_holding_address(vault: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(vault, mint, token_program)
}

/// Reads the vault's canonical SPL token account (Token or Token-2022) for `mint`.
fn read_vault_balance(
    info: &AccountInfo,
    token_program: &Pubkey,
    mint: &Pubkey,
    vault: &Pubkey,
) -> Result<u64> {
    require_keys_eq!(
        info.key(),
        vault_holding_address(vault, mint, token_program),
        StockPilotError::InvalidTokenAccount
    );
    require_keys_eq!(*info.owner, *token_program, StockPilotError::InvalidTokenAccount);
    let data = info.try_borrow_data()?;
    require!(data.len() >= 72, StockPilotError::InvalidTokenAccount);
    require!(&data[0..32] == mint.as_ref(), StockPilotError::InvalidMint);
    require!(&data[32..64] == vault.as_ref(), StockPilotError::InvalidTokenAccount);
    Ok(u64::from_le_bytes(data[64..72].try_into().unwrap()))
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct BasketAsset {
    pub mint: Pubkey,
    /// Pyth price feed id, e.g. Equity.US.NVDA/USD.
    pub feed_id: [u8; 32],
    pub decimals: u8,
    pub target_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct AutopilotLimits {
    /// Rebalance only when some asset is this far from target (500 = 5%).
    pub drift_threshold_bps: u16,
    /// Worst price the vault accepts versus the oracle (100 = 1%).
    pub max_slippage_bps: u16,
    /// Largest single trade as a share of the basket (2_500 = 25%).
    pub max_trade_bps: u16,
    /// Oldest acceptable Pyth price. Also stops trading while the market is closed.
    pub max_price_age_secs: u32,
}

#[account]
#[derive(InitSpace)]
pub struct AutopilotConfig {
    pub vault: Pubkey,
    pub keeper: Pubkey,
    pub enabled: bool,
    pub pool: Pubkey,
    #[max_len(8)]
    pub assets: Vec<BasketAsset>,
    pub limits: AutopilotLimits,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OraclePool {
    pub admin: Pubkey,
    pub spread_bps: u16,
    pub bump: u8,
}

#[event]
pub struct RebalanceSwapped {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub by_keeper: bool,
    pub from_mint: Pubkey,
    pub to_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub value_in_usd_micros: u64,
}

#[derive(Accounts)]
pub struct InitOraclePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + OraclePool::INIT_SPACE,
        seeds = [ORACLE_POOL_SEED, admin.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, OraclePool>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureAutopilot<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + AutopilotConfig::INIT_SPACE,
        seeds = [AUTOPILOT_SEED, vault.key().as_ref()],
        bump
    )]
    pub config: Account<'info, AutopilotConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeKeeper<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, vault.key().as_ref()],
        bump = config.bump,
        has_one = vault,
    )]
    pub config: Account<'info, AutopilotConfig>,
}

#[derive(Accounts)]
pub struct CloseAutopilot<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    #[account(
        mut,
        seeds = [AUTOPILOT_SEED, vault.key().as_ref()],
        bump = config.bump,
        has_one = vault,
        close = owner,
    )]
    pub config: Account<'info, AutopilotConfig>,
}

#[derive(Accounts)]
pub struct WithdrawPoolLiquidity<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [ORACLE_POOL_SEED, admin.key().as_ref()],
        bump = pool.bump,
        has_one = admin,
    )]
    pub pool: Account<'info, OraclePool>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = pool,
        token::token_program = token_program,
    )]
    pub pool_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub admin_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CloseOraclePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_POOL_SEED, admin.key().as_ref()],
        bump = pool.bump,
        has_one = admin,
        close = admin,
    )]
    pub pool: Account<'info, OraclePool>,
}

#[derive(Accounts)]
pub struct RebalanceSwap<'info> {
    /// Vault owner or the approved keeper; checked in the handler.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Box<Account<'info, StockVault>>,

    #[account(
        seeds = [AUTOPILOT_SEED, vault.key().as_ref()],
        bump = config.bump,
        has_one = vault,
        has_one = pool,
    )]
    pub config: Box<Account<'info, AutopilotConfig>>,

    #[account(
        seeds = [ORACLE_POOL_SEED, pool.admin.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, OraclePool>>,

    pub from_mint: Box<InterfaceAccount<'info, Mint>>,
    pub to_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = from_mint,
        token::authority = vault,
        token::token_program = token_program,
    )]
    pub vault_from_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = to_mint,
        token::authority = vault,
        token::token_program = token_program,
    )]
    pub vault_to_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = from_mint,
        token::authority = pool,
        token::token_program = token_program,
    )]
    pub pool_from_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = to_mint,
        token::authority = pool,
        token::token_program = token_program,
    )]
    pub pool_to_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(strategy_id: String)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + StockVault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, StockVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ StockPilotError::InvalidTokenAccount,
        constraint = owner_token_account.mint == mint.key() @ StockPilotError::InvalidMint,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ StockPilotError::InvalidTokenAccount,
        constraint = vault_token_account.mint == mint.key() @ StockPilotError::InvalidMint,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token_account.mint == mint.key() @ StockPilotError::InvalidMint,
        constraint = treasury_token_account.owner == PROTOCOL_TREASURY_PUBKEY @ StockPilotError::Unauthorized,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key() @ StockPilotError::InvalidTokenAccount,
        constraint = vault_token_account.mint == mint.key() @ StockPilotError::InvalidMint,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ StockPilotError::InvalidTokenAccount,
        constraint = owner_token_account.mint == mint.key() @ StockPilotError::InvalidMint,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, StockVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Rebalance<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = authority.key() == vault.owner @ StockPilotError::Unauthorized,
    )]
    pub vault: Account<'info, StockVault>,
}

#[account]
#[derive(InitSpace)]
pub struct StockVault {
    pub owner: Pubkey,
    #[max_len(32)]
    pub strategy_id: String,
    #[max_len(8)]
    pub target_weights: Vec<u16>,
    pub created_at: i64,
    pub last_rebalance_ts: i64,
    pub cooldown_seconds: i64,
    pub total_rebalances: u64,
    pub bump: u8,
}

#[error_code]
pub enum StockPilotError {
    #[msg("Rebalance cooldown is active. Wait for the timelock to expire.")]
    RebalanceCooldownActive,
    #[msg("Math calculation overflow.")]
    CalculationOverflow,
    #[msg("Insufficient funds in vault for withdrawal.")]
    InsufficientFunds,
    #[msg("Invalid token account owner.")]
    InvalidTokenAccount,
    #[msg("Invalid token mint.")]
    InvalidMint,
    #[msg("Unauthorized: caller is not the vault owner.")]
    Unauthorized,
    #[msg("Invalid autopilot configuration.")]
    InvalidConfig,
    #[msg("Asset is not part of this vault's basket.")]
    InvalidAsset,
    #[msg("Price account is not a valid, fully verified Pyth update for this asset.")]
    InvalidPriceAccount,
    #[msg("Price is stale or the market is closed.")]
    StalePriceOrMarketClosed,
    #[msg("Price confidence interval is too wide.")]
    PriceTooUncertain,
    #[msg("Basket drift is below the rebalance threshold.")]
    DriftBelowThreshold,
    #[msg("Trade would not move the basket toward its target weights.")]
    TradeWorsensDrift,
    #[msg("Trade exceeds the per-rebalance size limit.")]
    TradeTooLarge,
    #[msg("Execution price is worse than the allowed slippage.")]
    SlippageExceeded,
    #[msg("Oracle pool does not have enough liquidity.")]
    InsufficientPoolLiquidity,
    #[msg("Vault balances did not change by the expected amounts.")]
    BalanceCheckFailed,
}
