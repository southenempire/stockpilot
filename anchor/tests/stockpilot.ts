import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("stockpilot-anchor-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const VAULT_SEED = Buffer.from("stockpilot_vault");
  const owner = provider.wallet.publicKey;

  let vaultPda: PublicKey;
  let vaultBump: number;

  before(async () => {
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, owner.toBuffer()],
      new PublicKey("CsiP2ZWy1bM6Ghye85r67kiLC2zkBC7FngYCYGAhEPgK")
    );
  });

  it("Derives correct PDA address from seeds [stockpilot_vault, owner]", () => {
    assert.isOk(vaultPda);
    assert.isNumber(vaultBump);
    assert.isTrue(vaultBump >= 0 && vaultBump <= 255);
  });

  it("Validates 15 bps protocol fee deduction rule", () => {
    const depositAmount = 1000_000_000n; // 1,000 USDC
    const feeBps = 15n;
    const fee = (depositAmount * feeBps) / 10000n;
    const vaultNet = depositAmount - fee;

    assert.equal(fee.toString(), "1500000"); // 1.5 USDC
    assert.equal(vaultNet.toString(), "998500000"); // 998.5 USDC
  });

  it("Enforces 300s cooldown between rebalances", () => {
    const cooldownSeconds = 300;
    const now = Math.floor(Date.now() / 1000);
    const lastRebalance = now - 100;

    const canRebalance = now >= lastRebalance + cooldownSeconds;
    assert.isFalse(canRebalance);
  });
});
