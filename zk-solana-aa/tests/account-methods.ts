import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as assert from "assert";

describe("Account Methods - Native SOL with Salt Support", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;
  const provider = anchor.getProvider();

  const INITIAL_SOL_AMOUNT = 1 * LAMPORTS_PER_SOL; // 1 SOL
  const TRANSFER_AMOUNT = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL
  const COMPUTE_UNITS = 500_000;

  const PROOF_HEX =
    "a4594c59088d5af18703827f019a144908ea4206ef67a88dcf45fd911242b87ba13fb2bd1ec2aedb9d459cc84e6c59f3a1ae27a76afe38d9d92547e5f3cef3c2c6de4d5c06d63cbd6c4a63ff1f75ba8712be2ad7e8c9a3c37ad6ac34e55d4ece02ad17ad019d03f7f2bc73c399063411a50594267d3af80b2a60d75a76fcfb70517352572643845fd1a39b943265f9742f081eddb05d3732d114f17eff8363ed3060be0a15836d4cc9dfe236e2eddc86c483fe0183cd93a586bbe658d805c3006b696333239ff232a2dc7d51061c03d7c9a8fd4754cb46bd0508f108a87783df3ec84cd21d48694c255465fa3a2f2da3b19f6a8c1541d9f538dac93d7c8d4ebad8829ca5";
  const PUBLIC_VALUES_HEX =
    "b9c53ddad62c54e2b8e437460ac30709d700d1eb6b0d1b58e2344a6c64cef0c40852d63bb7aa68da1ce892b3be6601ea2a815032ecaaf4a53e0105f4f54f7b540f00000000000000746573745f3132335f66656c69706501";

  const EMAIL_HASH = new Uint8Array([
    185, 197, 61, 218, 214, 44, 84, 226, 184, 228, 55, 70, 10, 195, 7, 9, 215,
    0, 209, 235, 107, 13, 27, 88, 226, 52, 74, 108, 100, 206, 240, 196,
  ]);

  const groth16Proof = {
    proof: Buffer.from(PROOF_HEX, "hex"),
    sp1PublicInputs: Buffer.from(PUBLIC_VALUES_HEX, "hex"),
  };

  // Test salts for multiple accounts
  const SALT_DEFAULT = "default";
  const SALT_SAVINGS = "savings";
  const SALT_BUSINESS = "business";

  let userAccountDefault: anchor.web3.PublicKey;
  let userAccountSavings: anchor.web3.PublicKey;
  let userAccountBusiness: anchor.web3.PublicKey;
  let payer: Keypair;
  let authority: Keypair;
  let destination: Keypair;

  const createComputeBudgetInstruction = () =>
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS });

  const airdropToAccounts = async (
    accounts: anchor.web3.PublicKey[],
    amount: number
  ) => {
    const airdropPromises = accounts.map((account) =>
      provider.connection.requestAirdrop(account, amount)
    );
    const signatures = await Promise.all(airdropPromises);

    const confirmPromises = signatures.map((sig) =>
      provider.connection.confirmTransaction(sig)
    );
    await Promise.all(confirmPromises);
  };

  const getUserAccountAddress = (emailHash: Uint8Array, salt: string) => {
    const [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), Buffer.from(emailHash), Buffer.from(salt)],
      program.programId
    );
    return userAccountPda;
  };

  before(async () => {
    payer = Keypair.generate();
    authority = Keypair.generate();
    destination = Keypair.generate();

    await airdropToAccounts(
      [payer.publicKey, authority.publicKey],
      2 * LAMPORTS_PER_SOL
    );

    // Generate PDAs for different salts
    userAccountDefault = getUserAccountAddress(EMAIL_HASH, SALT_DEFAULT);
    userAccountSavings = getUserAccountAddress(EMAIL_HASH, SALT_SAVINGS);
    userAccountBusiness = getUserAccountAddress(EMAIL_HASH, SALT_BUSINESS);

    console.log("Default account address:", userAccountDefault.toString());
    console.log("Savings account address:", userAccountSavings.toString());
    console.log("Business account address:", userAccountBusiness.toString());

    // Create the default user account
    await program.methods
      .createUserAccountWithAuth(
        Array.from(EMAIL_HASH),
        SALT_DEFAULT,
        groth16Proof
      )
      .accounts({
        payer: payer.publicKey,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([payer])
      .rpc();

    console.log(
      "Default user account created successfully:",
      userAccountDefault.toString()
    );
  });

  it("Verifies user account was created with salt", async () => {
    const userAccountData = await program.account.userAccount.fetch(
      userAccountDefault
    );
    assert.deepEqual(userAccountData.emailHash, Array.from(EMAIL_HASH));
    assert.equal(userAccountData.salt, SALT_DEFAULT);
    assert.ok(typeof userAccountData.bump === "number");
  });

  it("Creates multiple accounts with different salts for same email", async () => {
    // Create savings account
    await program.methods
      .createUserAccountWithAuth(
        Array.from(EMAIL_HASH),
        SALT_SAVINGS,
        groth16Proof
      )
      .accounts({
        payer: payer.publicKey,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([payer])
      .rpc();

    // Create business account
    await program.methods
      .createUserAccountWithAuth(
        Array.from(EMAIL_HASH),
        SALT_BUSINESS,
        groth16Proof
      )
      .accounts({
        payer: payer.publicKey,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([payer])
      .rpc();

    // Verify all accounts exist and have correct data
    const defaultAccountData = await program.account.userAccount.fetch(
      userAccountDefault
    );
    const savingsAccountData = await program.account.userAccount.fetch(
      userAccountSavings
    );
    const businessAccountData = await program.account.userAccount.fetch(
      userAccountBusiness
    );

    // All should have same email hash but different salts
    assert.deepEqual(defaultAccountData.emailHash, Array.from(EMAIL_HASH));
    assert.deepEqual(savingsAccountData.emailHash, Array.from(EMAIL_HASH));
    assert.deepEqual(businessAccountData.emailHash, Array.from(EMAIL_HASH));

    assert.equal(defaultAccountData.salt, SALT_DEFAULT);
    assert.equal(savingsAccountData.salt, SALT_SAVINGS);
    assert.equal(businessAccountData.salt, SALT_BUSINESS);

    console.log("All three accounts created successfully with different salts");
  });

  it("Funds and transfers from specific salted account", async () => {
    // Fund the savings account
    const fundTx = new Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: userAccountSavings,
        lamports: INITIAL_SOL_AMOUNT,
      })
    );
    const fundSig = await provider.connection.sendTransaction(fundTx, [payer]);
    await provider.connection.confirmTransaction(fundSig);

    // Check initial balance
    const initialBalance = await provider.connection.getBalance(
      userAccountSavings
    );
    const destinationInitialBalance = await provider.connection.getBalance(
      destination.publicKey
    );

    console.log(
      "Initial savings account balance:",
      initialBalance / LAMPORTS_PER_SOL,
      "SOL"
    );

    // Calculate rent-exempt minimum for user account (updated for new size)
    const rentExemptMinimum =
      await provider.connection.getMinimumBalanceForRentExemption(
        8 + 32 + 4 + 32 + 1 // UserAccount::SPACE (discriminator + email_hash + salt + bump)
      );
    const availableBalance = initialBalance - rentExemptMinimum;

    console.log(
      "Available balance for transfer:",
      availableBalance / LAMPORTS_PER_SOL,
      "SOL"
    );

    // Ensure we have enough balance for the transfer
    assert.ok(
      availableBalance >= TRANSFER_AMOUNT,
      `Insufficient available balance for transfer. Have: ${
        availableBalance / LAMPORTS_PER_SOL
      } SOL, Need: ${TRANSFER_AMOUNT / LAMPORTS_PER_SOL} SOL`
    );

    // Transfer SOL from savings account to destination using the program method
    const tx = await program.methods
      .transferFromUserAccountWithAuth(
        Array.from(EMAIL_HASH),
        SALT_SAVINGS,
        groth16Proof,
        new anchor.BN(TRANSFER_AMOUNT)
      )
      .accounts({
        authority: authority.publicKey,
        destination: destination.publicKey,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([authority])
      .rpc();

    console.log("Transfer transaction signature:", tx);

    // Check final balances
    const finalBalance = await provider.connection.getBalance(
      userAccountSavings
    );
    const destinationFinalBalance = await provider.connection.getBalance(
      destination.publicKey
    );

    // Verify the transfer
    const expectedFinalBalance = initialBalance - TRANSFER_AMOUNT;
    const expectedDestinationBalance =
      destinationInitialBalance + TRANSFER_AMOUNT;

    assert.equal(
      finalBalance,
      expectedFinalBalance,
      "Savings account should have reduced balance after transfer"
    );
    assert.equal(
      destinationFinalBalance,
      expectedDestinationBalance,
      "Destination should have received the transferred SOL"
    );
  });

  it("Fails to create user account with wrong email hash", async () => {
    const wrongEmailHash = new Uint8Array(32).fill(1);

    try {
      await program.methods
        .createUserAccountWithAuth(
          Array.from(wrongEmailHash),
          SALT_DEFAULT,
          groth16Proof
        )
        .accounts({
          payer: payer.publicKey,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([payer])
        .rpc();

      assert.fail("Expected transaction to fail with email hash mismatch");
    } catch (error: any) {
      console.log("Expected error:", error.message);
      assert.ok(error.message.includes("EmailHashMismatch"));
    }
  });

  it("Fails to transfer with wrong salt", async () => {
    try {
      await program.methods
        .transferFromUserAccountWithAuth(
          Array.from(EMAIL_HASH),
          "wrong_salt",
          groth16Proof,
          new anchor.BN(TRANSFER_AMOUNT)
        )
        .accounts({
          authority: authority.publicKey,
          destination: destination.publicKey,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([authority])
        .rpc();

      assert.fail("Expected transaction to fail with salt mismatch");
    } catch (error: any) {
      console.log("Expected error:", error.message);
      assert.ok(
        error.message.includes("AccountNotInitialized") ||
          error.message.includes("SaltMismatch")
      );
    }
  });

  it("Fails to transfer with insufficient balance", async () => {
    const largeTransferAmount = 10 * LAMPORTS_PER_SOL; // Much more than available

    try {
      await program.methods
        .transferFromUserAccountWithAuth(
          Array.from(EMAIL_HASH),
          SALT_DEFAULT,
          groth16Proof,
          new anchor.BN(largeTransferAmount)
        )
        .accounts({
          authority: authority.publicKey,
          destination: destination.publicKey,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([authority])
        .rpc();

      assert.fail("Expected transaction to fail with insufficient balance");
    } catch (error: any) {
      console.log("Expected error for insufficient balance:", error.message);
      assert.ok(error.message.includes("InsufficientBalance"));
    }
  });

  it("Fails to create user account again with same salt (duplicate)", async () => {
    try {
      await program.methods
        .createUserAccountWithAuth(
          Array.from(EMAIL_HASH),
          SALT_DEFAULT,
          groth16Proof
        )
        .accounts({
          payer: payer.publicKey,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([payer])
        .rpc();

      assert.fail(
        "Expected transaction to fail when creating duplicate account"
      );
    } catch (error: any) {
      console.log("Expected error for duplicate account:", error.message);
      // The error could be "already in use" or similar account initialization error
      assert.ok(
        error.message.includes("already in use") ||
          error.message.includes("AccountAlreadyInitialized") ||
          error.message.includes("custom program error: 0x0")
      );
    }
  });

  it("Fails to create account with salt that's too long", async () => {
    const longSalt = "a".repeat(33); // 33 characters, exceeds max of 32

    try {
      await program.methods
        .createUserAccountWithAuth(
          Array.from(EMAIL_HASH),
          longSalt,
          groth16Proof
        )
        .accounts({
          payer: payer.publicKey, // Reuse existing payer instead of creating new one
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([payer])
        .rpc();

      assert.fail("Expected transaction to fail with salt too long");
    } catch (error: any) {
      console.log("Expected error for salt too long:", error.message);
      // The error occurs at account resolution level when salt is too long
      assert.ok(
        error.message.includes("SaltTooLong") ||
          error.message.includes(
            "Reached maximum depth for account resolution"
          ) ||
          error.message.includes("Unresolved accounts")
      );
    }
  });
});
