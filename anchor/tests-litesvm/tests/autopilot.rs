//! Runs the compiled StockPilot program in LiteSVM and proves what the autopilot
//! keeper can and cannot do. Build first: `cargo build-sbf` in anchor/programs/stockpilot.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_account::Account;
use solana_address::{address, Address};
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;

const PROGRAM_ID: Address = address!("CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK");
const TOKEN_PROGRAM: Address = address!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM_PROGRAM: Address = address!("11111111111111111111111111111111");
const PYTH_RECEIVER: Address = address!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
const ATA_PROGRAM: Address = address!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const START_TS: i64 = 1_800_000_000;
const COOLDOWN: i64 = 300;
const NVDA_FEED: [u8; 32] = [1; 32];
const AAPL_FEED: [u8; 32] = [2; 32];
const NVDA_PRICE: i64 = 18_000_000; // $180.00000, exponent -5
const AAPL_PRICE: i64 = 20_000_000; // $200.00000, exponent -5
const SPREAD_BPS: u16 = 50;
const ONE: u64 = 1_000_000; // one share at 6 decimals

// StockPilotError codes (Anchor custom errors start at 6000).
const ERR_COOLDOWN: u32 = 6000;
const ERR_INSUFFICIENT_FUNDS: u32 = 6002;
const ERR_INVALID_TOKEN_ACCOUNT: u32 = 6003;
const ERR_UNAUTHORIZED: u32 = 6005;
const ERR_INVALID_PRICE: u32 = 6008;
const ERR_STALE_OR_CLOSED: u32 = 6009;
const ERR_DRIFT_BELOW: u32 = 6011;
const ERR_WORSENS_DRIFT: u32 = 6012;
const ERR_TOO_LARGE: u32 = 6013;
const ERR_SLIPPAGE: u32 = 6014;
// Anchor framework error codes.
const ANCHOR_SEEDS: u32 = 2006;
const ANCHOR_TOKEN_OWNER: u32 = 2015;
const ANCHOR_ACCOUNT_NOT_INITIALIZED: u32 = 3012;

fn sighash(name: &str) -> [u8; 8] {
    let h = Sha256::digest(format!("global:{name}").as_bytes());
    h[..8].try_into().unwrap()
}

fn pda(seeds: &[&[u8]]) -> Address {
    Address::find_program_address(seeds, &PROGRAM_ID).0
}

fn ata(wallet: &Address, mint: &Address) -> Address {
    Address::find_program_address(&[wallet.as_ref(), TOKEN_PROGRAM.as_ref(), mint.as_ref()], &ATA_PROGRAM).0
}

fn coption_key(key: Option<&Address>, out: &mut Vec<u8>) {
    match key {
        Some(k) => {
            out.extend_from_slice(&1u32.to_le_bytes());
            out.extend_from_slice(k.as_ref());
        }
        None => out.extend_from_slice(&[0u8; 36]),
    }
}

fn mint_data(decimals: u8) -> Vec<u8> {
    let mut d = Vec::with_capacity(82);
    coption_key(Some(&Address::new_unique()), &mut d);
    d.extend_from_slice(&u64::MAX.to_le_bytes()); // supply
    d.push(decimals);
    d.push(1); // initialized
    coption_key(None, &mut d);
    d
}

fn token_account_data(mint: &Address, owner: &Address, amount: u64) -> Vec<u8> {
    let mut d = Vec::with_capacity(165);
    d.extend_from_slice(mint.as_ref());
    d.extend_from_slice(owner.as_ref());
    d.extend_from_slice(&amount.to_le_bytes());
    coption_key(None, &mut d); // delegate
    d.push(1); // AccountState::Initialized
    d.extend_from_slice(&[0u8; 12]); // is_native: None
    d.extend_from_slice(&0u64.to_le_bytes()); // delegated_amount
    coption_key(None, &mut d); // close_authority
    d
}

/// Pyth `PriceUpdateV2` with VerificationLevel::Full.
fn price_update_data(feed: [u8; 32], price: i64, publish_time: i64) -> Vec<u8> {
    let mut d = Vec::new();
    d.extend_from_slice(&[34, 241, 35, 99, 157, 126, 244, 205]);
    d.extend_from_slice(&[9u8; 32]); // write authority
    d.push(1); // Full
    d.extend_from_slice(&feed);
    d.extend_from_slice(&price.to_le_bytes());
    d.extend_from_slice(&((price / 1_000) as u64).to_le_bytes()); // conf = 0.1%
    d.extend_from_slice(&(-5i32).to_le_bytes());
    d.extend_from_slice(&publish_time.to_le_bytes());
    d.extend_from_slice(&publish_time.to_le_bytes()); // prev_publish_time
    d.extend_from_slice(&price.to_le_bytes()); // ema_price
    d.extend_from_slice(&0u64.to_le_bytes()); // ema_conf
    d.extend_from_slice(&0u64.to_le_bytes()); // posted_slot
    d
}

struct Env {
    svm: LiteSVM,
    owner: Keypair,
    keeper: Keypair,
    pool_admin: Keypair,
    vault: Address,
    config: Address,
    pool: Address,
    nvda: Address,
    aapl: Address,
    vault_nvda: Address,
    vault_aapl: Address,
    pool_nvda: Address,
    pool_aapl: Address,
    nvda_price: Address,
    aapl_price: Address,
}

impl Env {
    /// Vault holds 10 NVDAx ($1,800) and 5 AAPLx ($1,000) against a 50/50 target,
    /// so NVDAx is 14 points overweight. Keeper approved, cooldown already elapsed.
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        let so = concat!(env!("CARGO_MANIFEST_DIR"), "/../programs/stockpilot/target/deploy/stockpilot.so");
        svm.add_program_from_file(PROGRAM_ID, so).expect("build the program first: cargo build-sbf");
        set_clock(&mut svm, START_TS);

        let owner = Keypair::new();
        let keeper = Keypair::new();
        let pool_admin = Keypair::new();
        for k in [&owner, &keeper, &pool_admin] {
            svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        }

        let vault = pda(&[b"stockpilot_vault", owner.pubkey().as_ref()]);
        let config = pda(&[b"autopilot", vault.as_ref()]);
        let pool = pda(&[b"oracle_pool", pool_admin.pubkey().as_ref()]);

        let (nvda, aapl) = (Address::new_unique(), Address::new_unique());
        let mut env = Env {
            svm,
            vault,
            config,
            pool,
            nvda,
            aapl,
            vault_nvda: ata(&vault, &nvda),
            vault_aapl: ata(&vault, &aapl),
            pool_nvda: Address::new_unique(),
            pool_aapl: Address::new_unique(),
            nvda_price: Address::new_unique(),
            aapl_price: Address::new_unique(),
            owner,
            keeper,
            pool_admin,
        };

        for mint in [env.nvda, env.aapl] {
            env.put(mint, TOKEN_PROGRAM, mint_data(6));
        }
        env.put(env.vault_nvda, TOKEN_PROGRAM, token_account_data(&env.nvda, &vault, 10 * ONE));
        env.put(env.vault_aapl, TOKEN_PROGRAM, token_account_data(&env.aapl, &vault, 5 * ONE));
        env.put(env.pool_nvda, TOKEN_PROGRAM, token_account_data(&env.nvda, &pool, 1_000 * ONE));
        env.put(env.pool_aapl, TOKEN_PROGRAM, token_account_data(&env.aapl, &pool, 1_000 * ONE));

        let owner_key = env.owner.pubkey();
        let init_vault = {
            let mut data = sighash("initialize_vault").to_vec();
            let strategy = b"ai_champions";
            data.extend_from_slice(&(strategy.len() as u32).to_le_bytes());
            data.extend_from_slice(strategy);
            data.extend_from_slice(&2u32.to_le_bytes());
            data.extend_from_slice(&5_000u16.to_le_bytes());
            data.extend_from_slice(&5_000u16.to_le_bytes());
            Instruction::new_with_bytes(
                PROGRAM_ID,
                &data,
                vec![
                    AccountMeta::new(owner_key, true),
                    AccountMeta::new(vault, false),
                    AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
                ],
            )
        };
        env.send(&[init_vault], &[&env.owner.insecure_clone()]).unwrap();

        let admin_key = env.pool_admin.pubkey();
        let init_pool = Instruction::new_with_bytes(
            PROGRAM_ID,
            &[sighash("init_oracle_pool").as_slice(), &SPREAD_BPS.to_le_bytes()].concat(),
            vec![
                AccountMeta::new(admin_key, true),
                AccountMeta::new(pool, false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
            ],
        );
        env.send(&[init_pool], &[&env.pool_admin.insecure_clone()]).unwrap();

        let keeper_key = env.keeper.pubkey();
        let ix = env.configure_ix(&owner_key, keeper_key);
        env.send(&[ix], &[&env.owner.insecure_clone()]).unwrap();

        env.warp(START_TS + COOLDOWN + 1);
        env
    }

    fn put(&mut self, at: Address, owner: Address, data: Vec<u8>) {
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm
            .set_account(at, Account { lamports, data, owner, executable: false, rent_epoch: 0 })
            .unwrap();
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    /// Moves the clock and publishes fresh prices at the new time.
    fn warp(&mut self, ts: i64) {
        set_clock(&mut self.svm, ts);
        self.set_prices(ts);
    }

    fn set_prices(&mut self, publish_time: i64) {
        self.put(self.nvda_price, PYTH_RECEIVER, price_update_data(NVDA_FEED, NVDA_PRICE, publish_time));
        self.put(self.aapl_price, PYTH_RECEIVER, price_update_data(AAPL_FEED, AAPL_PRICE, publish_time));
    }

    fn configure_ix(&self, signer: &Address, keeper: Address) -> Instruction {
        let mut data = sighash("configure_autopilot").to_vec();
        data.extend_from_slice(keeper.as_ref());
        data.extend_from_slice(self.pool.as_ref());
        data.extend_from_slice(&2u32.to_le_bytes());
        for (mint, feed) in [(self.nvda, NVDA_FEED), (self.aapl, AAPL_FEED)] {
            data.extend_from_slice(mint.as_ref());
            data.extend_from_slice(&feed);
            data.push(6);
            data.extend_from_slice(&5_000u16.to_le_bytes());
        }
        data.extend_from_slice(&500u16.to_le_bytes()); // drift threshold 5%
        data.extend_from_slice(&100u16.to_le_bytes()); // max slippage 1%
        data.extend_from_slice(&2_500u16.to_le_bytes()); // max trade 25% of basket
        data.extend_from_slice(&60u32.to_le_bytes()); // max price age 60s
        let vault = pda(&[b"stockpilot_vault", signer.as_ref()]);
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &data,
            vec![
                AccountMeta::new(*signer, true),
                AccountMeta::new_readonly(vault, false),
                AccountMeta::new(pda(&[b"autopilot", vault.as_ref()]), false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
            ],
        )
    }

    /// NVDAx -> AAPLx swap with the default (honest) accounts.
    fn swap_ix(&self, authority: &Address, amount_in: u64, min_out: u64) -> Instruction {
        self.swap_ix_with(authority, 0, 1, amount_in, min_out, self.vault_aapl, self.nvda_price)
    }

    #[allow(clippy::too_many_arguments)]
    fn swap_ix_with(
        &self,
        authority: &Address,
        from: u8,
        to: u8,
        amount_in: u64,
        min_out: u64,
        vault_to_override: Address,
        nvda_price: Address,
    ) -> Instruction {
        let mut data = sighash("rebalance_swap").to_vec();
        data.push(from);
        data.push(to);
        data.extend_from_slice(&amount_in.to_le_bytes());
        data.extend_from_slice(&min_out.to_le_bytes());

        let legs = [(self.nvda, self.vault_nvda, self.pool_nvda), (self.aapl, self.vault_aapl, self.pool_aapl)];
        let (from_mint, vault_from, pool_from) = legs[from as usize];
        let (to_mint, mut vault_to, pool_to) = legs[to as usize];
        if to == 1 {
            vault_to = vault_to_override;
        }
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &data,
            vec![
                AccountMeta::new_readonly(*authority, true),
                AccountMeta::new(self.vault, false),
                AccountMeta::new_readonly(self.config, false),
                AccountMeta::new_readonly(self.pool, false),
                AccountMeta::new_readonly(from_mint, false),
                AccountMeta::new_readonly(to_mint, false),
                AccountMeta::new(vault_from, false),
                AccountMeta::new(vault_to, false),
                AccountMeta::new(pool_from, false),
                AccountMeta::new(pool_to, false),
                AccountMeta::new_readonly(TOKEN_PROGRAM, false),
                // remaining: [vault token account, price] per basket asset
                AccountMeta::new_readonly(self.vault_nvda, false),
                AccountMeta::new_readonly(nvda_price, false),
                AccountMeta::new_readonly(self.vault_aapl, false),
                AccountMeta::new_readonly(self.aapl_price, false),
            ],
        )
    }

    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        let payer = signers[0].pubkey();
        let msg = Message::new(ixs, Some(&payer));
        let tx = Transaction::new(signers, msg, self.svm.latest_blockhash());
        let res = self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err));
        self.svm.expire_blockhash();
        res
    }

    fn keeper_send(&mut self, ix: Instruction) -> Result<(), String> {
        let keeper = self.keeper.insecure_clone();
        self.send(&[ix], &[&keeper])
    }

    fn balance(&self, at: &Address) -> u64 {
        let data = self.svm.get_account(at).unwrap().data;
        u64::from_le_bytes(data[64..72].try_into().unwrap())
    }
}

fn set_clock(svm: &mut LiteSVM, ts: i64) {
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = ts;
    svm.set_sysvar(&clock);
}

fn assert_err(res: Result<(), String>, code: u32) {
    let err = res.expect_err("transaction should have failed");
    assert!(err.contains(&format!("Custom({code})")), "expected error {code}, got {err}");
}

/// $180 in, minus the 0.5% pool spread, paid out in $200 AAPLx.
fn expected_out(amount_in: u64) -> u64 {
    let value = amount_in as u128 * NVDA_PRICE as u128 * (10_000 - SPREAD_BPS as u128) / 10_000;
    (value / AAPL_PRICE as u128) as u64
}

#[test]
fn keeper_rebalances_toward_target() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let ix = env.swap_ix(&keeper, ONE, expected_out(ONE));
    env.keeper_send(ix).unwrap();

    assert_eq!(env.balance(&env.vault_nvda), 9 * ONE);
    assert_eq!(env.balance(&env.vault_aapl), 5 * ONE + expected_out(ONE));
    assert_eq!(env.balance(&env.pool_nvda), 1_001 * ONE);
    assert_eq!(expected_out(ONE), 895_500);
}

#[test]
fn keeper_cannot_withdraw_tokens_or_sol() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let attacker_ata = Address::new_unique();
    env.put(attacker_ata, TOKEN_PROGRAM, token_account_data(&env.nvda, &keeper, 0));

    // The vault PDA is derived from the signer, so a keeper-signed withdraw points
    // at a vault that does not exist.
    let mut data = sighash("withdraw").to_vec();
    data.extend_from_slice(&ONE.to_le_bytes());
    let withdraw = Instruction::new_with_bytes(
        PROGRAM_ID,
        &data,
        vec![
            AccountMeta::new(keeper, true),
            AccountMeta::new(env.vault, false),
            AccountMeta::new_readonly(env.nvda, false),
            AccountMeta::new(env.vault_nvda, false),
            AccountMeta::new(attacker_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM, false),
        ],
    );
    assert_err(env.keeper_send(withdraw), ANCHOR_SEEDS);

    let mut data = sighash("withdraw_sol").to_vec();
    data.extend_from_slice(&1u64.to_le_bytes());
    let withdraw_sol = Instruction::new_with_bytes(
        PROGRAM_ID,
        &data,
        vec![
            AccountMeta::new(keeper, true),
            AccountMeta::new(env.vault, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
        ],
    );
    assert_err(env.keeper_send(withdraw_sol), ANCHOR_SEEDS);
    assert_eq!(env.balance(&env.vault_nvda), 10 * ONE);
    assert_eq!(env.balance(&attacker_ata), 0);
}

#[test]
fn keeper_cannot_send_swap_output_to_itself() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let keeper_aapl = Address::new_unique();
    env.put(keeper_aapl, TOKEN_PROGRAM, token_account_data(&env.aapl, &keeper, 0));

    let ix = env.swap_ix_with(&keeper, 0, 1, ONE, 0, keeper_aapl, env.nvda_price);
    assert_err(env.keeper_send(ix), ANCHOR_TOKEN_OWNER);
    assert_eq!(env.balance(&keeper_aapl), 0);
}

#[test]
fn keeper_cannot_change_the_mandate() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    // Signing as the keeper derives the keeper's own (nonexistent) vault, not the owner's.
    let ix = env.configure_ix(&keeper, keeper);
    assert!(env.keeper_send(ix).is_err());
}

#[test]
fn trade_that_increases_drift_is_rejected() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    // Selling the underweight AAPLx to buy more overweight NVDAx.
    let ix = env.swap_ix_with(&keeper, 1, 0, ONE, 0, env.vault_aapl, env.nvda_price);
    assert_err(env.keeper_send(ix), ERR_WORSENS_DRIFT);
}

#[test]
fn oversized_trade_is_rejected() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    // NVDAx is $400 over target; 3 shares ($540) would overshoot.
    let ix = env.swap_ix(&keeper, 3 * ONE, 0);
    assert_err(env.keeper_send(ix), ERR_WORSENS_DRIFT);

    // Allow a larger excess, then hit the 25% per-trade cap instead.
    env.put(env.vault_nvda, TOKEN_PROGRAM, token_account_data(&env.nvda, &env.vault, 40 * ONE));
    env.put(env.vault_aapl, TOKEN_PROGRAM, token_account_data(&env.aapl, &env.vault, 0));
    // Basket = $7,200; cap = $1,800 = 10 shares.
    let ix = env.swap_ix(&keeper, 11 * ONE, 0);
    assert_err(env.keeper_send(ix), ERR_TOO_LARGE);
}

#[test]
fn bad_price_is_rejected() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let ix = env.swap_ix(&keeper, ONE, expected_out(ONE) + 1);
    assert_err(env.keeper_send(ix), ERR_SLIPPAGE);
}

#[test]
fn stale_price_or_closed_market_blocks_trading() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let now = env.now();
    env.set_prices(now - 61);
    let ix = env.swap_ix(&keeper, ONE, 0);
    assert_err(env.keeper_send(ix), ERR_STALE_OR_CLOSED);
}

#[test]
fn forged_price_account_is_rejected() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let now = env.now();
    // Same bytes, but owned by the keeper instead of the Pyth receiver program.
    let fake = Address::new_unique();
    env.put(fake, keeper, price_update_data(NVDA_FEED, NVDA_PRICE * 2, now));
    let ix = env.swap_ix_with(&keeper, 0, 1, ONE, 0, env.vault_aapl, fake);
    assert_err(env.keeper_send(ix), ERR_INVALID_PRICE);

    // Genuine Pyth account, but for the wrong feed.
    env.put(fake, PYTH_RECEIVER, price_update_data(AAPL_FEED, NVDA_PRICE * 2, now));
    let ix = env.swap_ix_with(&keeper, 0, 1, ONE, 0, env.vault_aapl, fake);
    assert_err(env.keeper_send(ix), ERR_INVALID_PRICE);
}

#[test]
fn cooldown_and_threshold_are_enforced() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    let ix = env.swap_ix(&keeper, ONE, 0);
    env.keeper_send(ix).unwrap();
    let ix = env.swap_ix(&keeper, ONE, 0);
    assert_err(env.keeper_send(ix), ERR_COOLDOWN);

    // Put the basket inside the 5% band: 10 NVDAx ($1,800) vs 9 AAPLx ($1,800).
    env.put(env.vault_aapl, TOKEN_PROGRAM, token_account_data(&env.aapl, &env.vault, 9 * ONE));
    let later = env.now() + COOLDOWN + 1;
    env.warp(later);
    let ix = env.swap_ix(&keeper, ONE / 10, 0);
    assert_err(env.keeper_send(ix), ERR_DRIFT_BELOW);
}

#[test]
fn revoked_keeper_is_locked_out_but_owner_can_still_rebalance() {
    let mut env = Env::new();
    let owner = env.owner.pubkey();
    let keeper = env.keeper.pubkey();
    let revoke = Instruction::new_with_bytes(
        PROGRAM_ID,
        &sighash("revoke_keeper"),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new_readonly(env.vault, false),
            AccountMeta::new(env.config, false),
        ],
    );
    let owner_kp = env.owner.insecure_clone();
    env.send(&[revoke], &[&owner_kp]).unwrap();

    let ix = env.swap_ix(&keeper, ONE, 0);
    assert_err(env.keeper_send(ix), ERR_UNAUTHORIZED);

    let ix = env.swap_ix(&owner, ONE, 0);
    env.send(&[ix], &[&owner_kp]).unwrap();
    assert_eq!(env.balance(&env.vault_nvda), 9 * ONE);
}

#[test]
fn withdraw_sol_keeps_vault_rent_exempt() {
    let mut env = Env::new();
    let owner = env.owner.pubkey();
    let owner_kp = env.owner.insecure_clone();
    let vault = env.vault;
    let vault_lamports = env.svm.get_account(&vault).unwrap().lamports;

    let withdraw_sol = |amount: u64| {
        let mut data = sighash("withdraw_sol").to_vec();
        data.extend_from_slice(&amount.to_le_bytes());
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &data,
            vec![
                AccountMeta::new(owner, true),
                AccountMeta::new(vault, false),
                AccountMeta::new_readonly(SYSTEM_PROGRAM, false),
            ],
        )
    };
    assert_err(env.send(&[withdraw_sol(vault_lamports)], &[&owner_kp]), ERR_INSUFFICIENT_FUNDS);

    // Lamports above the rent floor can still be withdrawn.
    let mut acct = env.svm.get_account(&vault).unwrap();
    acct.lamports += 5_000_000;
    env.svm.set_account(vault, acct).unwrap();
    env.send(&[withdraw_sol(5_000_000)], &[&owner_kp]).unwrap();
    assert_eq!(env.svm.get_account(&vault).unwrap().lamports, vault_lamports);
}

#[test]
fn close_autopilot_refunds_rent_and_ends_keeper_access() {
    let mut env = Env::new();
    let owner = env.owner.pubkey();
    let keeper = env.keeper.pubkey();
    let close = |signer: Address, vault: Address, config: Address| {
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &sighash("close_autopilot"),
            vec![
                AccountMeta::new(signer, true),
                AccountMeta::new_readonly(vault, false),
                AccountMeta::new(config, false),
            ],
        )
    };

    // The keeper can't close the owner's autopilot.
    assert_err(env.keeper_send(close(keeper, env.vault, env.config)), ANCHOR_SEEDS);

    let config_rent = env.svm.get_account(&env.config).unwrap().lamports;
    let owner_before = env.svm.get_account(&owner).unwrap().lamports;
    let owner_kp = env.owner.insecure_clone();
    let ix = close(owner, env.vault, env.config);
    env.send(&[ix], &[&owner_kp]).unwrap();

    assert!(env.svm.get_account(&env.config).map_or(true, |a| a.lamports == 0));
    let owner_after = env.svm.get_account(&owner).unwrap().lamports;
    assert_eq!(owner_after, owner_before + config_rent - 5_000); // minus the tx fee

    let ix = env.swap_ix(&keeper, ONE, 0);
    assert_err(env.keeper_send(ix), ANCHOR_ACCOUNT_NOT_INITIALIZED);
}

#[test]
fn pool_admin_can_drain_and_close_pool_but_no_one_else_can() {
    let mut env = Env::new();
    let admin = env.pool_admin.pubkey();
    let keeper = env.keeper.pubkey();
    let admin_nvda = Address::new_unique();
    env.put(admin_nvda, TOKEN_PROGRAM, token_account_data(&env.nvda, &admin, 0));

    let withdraw = |signer: Address, amount: u64, pool: Address, pool_nvda: Address, nvda: Address| {
        let mut data = sighash("withdraw_pool_liquidity").to_vec();
        data.extend_from_slice(&amount.to_le_bytes());
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &data,
            vec![
                AccountMeta::new(signer, true),
                AccountMeta::new_readonly(pool, false),
                AccountMeta::new_readonly(nvda, false),
                AccountMeta::new(pool_nvda, false),
                AccountMeta::new(admin_nvda, false),
                AccountMeta::new_readonly(TOKEN_PROGRAM, false),
            ],
        )
    };
    let (pool, pool_nvda, nvda) = (env.pool, env.pool_nvda, env.nvda);

    // Anyone other than the admin derives a different pool PDA.
    assert_err(env.keeper_send(withdraw(keeper, ONE, pool, pool_nvda, nvda)), ANCHOR_SEEDS);

    let admin_kp = env.pool_admin.insecure_clone();
    env.send(&[withdraw(admin, 400 * ONE, pool, pool_nvda, nvda)], &[&admin_kp]).unwrap();
    assert_eq!(env.balance(&pool_nvda), 600 * ONE);

    // Draining the rest closes the pool's token account and refunds its rent.
    let token_rent = env.svm.get_account(&pool_nvda).unwrap().lamports;
    let admin_before = env.svm.get_account(&admin).unwrap().lamports;
    env.send(&[withdraw(admin, 600 * ONE, pool, pool_nvda, nvda)], &[&admin_kp]).unwrap();
    assert_eq!(env.balance(&admin_nvda), 1_000 * ONE);
    assert!(env.svm.get_account(&pool_nvda).map_or(true, |a| a.lamports == 0));
    let admin_after = env.svm.get_account(&admin).unwrap().lamports;
    assert_eq!(admin_after, admin_before + token_rent - 5_000);

    let close = |signer: Address| {
        Instruction::new_with_bytes(
            PROGRAM_ID,
            &sighash("close_oracle_pool"),
            vec![AccountMeta::new(signer, true), AccountMeta::new(pool, false)],
        )
    };
    assert_err(env.keeper_send(close(keeper)), ANCHOR_SEEDS);
    env.send(&[close(admin)], &[&admin_kp]).unwrap();
    assert!(env.svm.get_account(&pool).map_or(true, |a| a.lamports == 0));
}

#[test]
fn decoy_vault_token_account_cannot_fake_drift() {
    let mut env = Env::new();
    let keeper = env.keeper.pubkey();
    // Anyone can create an empty NVDAx account whose authority is the vault PDA.
    // Passed in place of the real holding, it would make NVDAx look underweight.
    let decoy = Address::new_unique();
    let (vault, nvda) = (env.vault, env.nvda);
    env.put(decoy, TOKEN_PROGRAM, token_account_data(&nvda, &vault, 0));

    // Decoy used only to value the basket: sell underweight AAPLx into overweight NVDAx.
    let mut ix = env.swap_ix_with(&keeper, 1, 0, ONE, 0, env.vault_aapl, env.nvda_price);
    ix.accounts[11].pubkey = decoy;
    assert_err(env.keeper_send(ix), ERR_INVALID_TOKEN_ACCOUNT);

    // Decoy used as the trade's destination as well.
    let mut ix = env.swap_ix_with(&keeper, 1, 0, ONE, 0, env.vault_aapl, env.nvda_price);
    ix.accounts[7].pubkey = decoy;
    ix.accounts[11].pubkey = decoy;
    assert_err(env.keeper_send(ix), ERR_INVALID_TOKEN_ACCOUNT);

    assert_eq!(env.balance(&env.vault_nvda), 10 * ONE);
    assert_eq!(env.balance(&env.vault_aapl), 5 * ONE);
}
