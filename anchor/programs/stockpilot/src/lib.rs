use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK");

pub const VAULT_SEED: &[u8] = b"stockpilot_vault";
pub const DEFAULT_COOLDOWN_SECONDS: i64 = 300; // 5 minute demo cooldown

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

    /// Deposit USDC into the user's autonomous portfolio vault
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.owner_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        msg!("Deposited {} into StockPilot Vault", amount);
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

        require!(
            vault_info.lamports() >= amount,
            StockPilotError::InsufficientFunds
        );

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
        vault.total_rebalances = vault.total_rebalances.checked_add(1).unwrap();

        msg!(
            "Autonomous rebalance executed successfully! Total rebalances: {}",
            vault.total_rebalances
        );
        Ok(())
    }
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
}
