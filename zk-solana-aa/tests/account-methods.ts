import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import { ComputeBudgetProgram, Keypair, Transaction } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import * as assert from "assert";

describe("Account Methods", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;
  const provider = anchor.getProvider();

  const MINT_DECIMALS = 9;
  const INITIAL_MINT_AMOUNT = 1_000_000_000_000;
  const TRANSFER_AMOUNT = 500_000_000_000;
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

  let mint: anchor.web3.PublicKey;
  let userAccount: anchor.web3.PublicKey;
  let sourceTokenAccount: anchor.web3.PublicKey;
  let destinationTokenAccount: anchor.web3.PublicKey;
  let payer: Keypair;
  let authority: Keypair;
  let destinationOwner: Keypair;

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

  beforeEach(async () => {
    payer = Keypair.generate();
    authority = Keypair.generate();
    destinationOwner = Keypair.generate();

    await airdropToAccounts(
      [payer.publicKey, authority.publicKey, destinationOwner.publicKey],
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      MINT_DECIMALS
    );

    const [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), Buffer.from(EMAIL_HASH)],
      program.programId
    );
    userAccount = userAccountPda;

    destinationTokenAccount = await getAssociatedTokenAddress(
      mint,
      destinationOwner.publicKey,
      false
    );

    const createDestATAInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      destinationTokenAccount,
      destinationOwner.publicKey,
      mint
    );

    const destATATx = new Transaction().add(createDestATAInstruction);
    const destSignature = await provider.connection.sendTransaction(destATATx, [
      payer,
    ]);
    await provider.connection.confirmTransaction(destSignature);
  });

  it("Creates user account with auth", async () => {
    const tx = await program.methods
      .createUserAccountWithAuth(Array.from(EMAIL_HASH), groth16Proof)
      .accounts({
        payer: payer.publicKey,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([payer])
      .rpc();

    const userAccountData = await program.account.userAccount.fetch(
      userAccount
    );
    assert.deepEqual(userAccountData.emailHash, Array.from(EMAIL_HASH));
    assert.ok(typeof userAccountData.bump === "number");
  });

  it("Transfers tokens from user account with auth", async () => {
    sourceTokenAccount = await getAssociatedTokenAddress(
      mint,
      userAccount,
      true
    );

    const createATAInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      sourceTokenAccount,
      userAccount,
      mint
    );

    const createATATx = new Transaction().add(createATAInstruction);
    const signature = await provider.connection.sendTransaction(createATATx, [
      payer,
    ]);
    await provider.connection.confirmTransaction(signature);

    await mintTo(
      provider.connection,
      payer,
      mint,
      sourceTokenAccount,
      payer.publicKey,
      INITIAL_MINT_AMOUNT
    );

    const sourceAccountBefore = await getAccount(
      provider.connection,
      sourceTokenAccount
    );
    const destinationAccountBefore = await getAccount(
      provider.connection,
      destinationTokenAccount
    );

    assert.equal(
      sourceAccountBefore.owner.toString(),
      userAccount.toString(),
      "Source token account must be owned by the PDA"
    );

    const tx = await program.methods
      .transferFromUserAccountWithAuth(
        Array.from(EMAIL_HASH),
        groth16Proof,
        new anchor.BN(TRANSFER_AMOUNT)
      )
      .accounts({
        authority: authority.publicKey,
        sourceTokenAccount: sourceTokenAccount,
        destinationTokenAccount: destinationTokenAccount,
        mint: mint,
      })
      .preInstructions([createComputeBudgetInstruction()])
      .signers([authority])
      .rpc();

    const sourceAccountAfter = await getAccount(
      provider.connection,
      sourceTokenAccount
    );
    const destinationAccountAfter = await getAccount(
      provider.connection,
      destinationTokenAccount
    );

    assert.equal(
      sourceAccountAfter.amount.toString(),
      (INITIAL_MINT_AMOUNT - TRANSFER_AMOUNT).toString(),
      "PDA-owned source account should have reduced balance"
    );
    assert.equal(
      destinationAccountAfter.amount.toString(),
      TRANSFER_AMOUNT.toString(),
      "Destination account should have received the transferred tokens"
    );
  });

  it("Fails to create user account with wrong email hash", async () => {
    const wrongEmailHash = new Uint8Array(32).fill(1);

    try {
      await program.methods
        .createUserAccountWithAuth(Array.from(wrongEmailHash), groth16Proof)
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

  it("Fails to transfer with wrong email hash", async () => {
    const wrongEmailHash = new Uint8Array(32).fill(2);

    const transferAmount = 100_000_000_000;

    try {
      await program.methods
        .transferFromUserAccountWithAuth(
          Array.from(wrongEmailHash),
          groth16Proof,
          new anchor.BN(transferAmount)
        )
        .accounts({
          authority: authority.publicKey,
          sourceTokenAccount: sourceTokenAccount,
          destinationTokenAccount: destinationTokenAccount,
          mint: mint,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([authority])
        .rpc();

      assert.fail("Expected transaction to fail with email hash mismatch");
    } catch (error: any) {
      console.log("Expected error:", error.message);

      assert.ok(
        error.message.includes("EmailHashMismatch") ||
          error.message.includes("AccountNotInitialized")
      );
    }
  });

  it("Fails to transfer from token account NOT owned by PDA", async () => {
    const regularOwner = Keypair.generate();

    const nonPdaTokenAccount = await getAssociatedTokenAddress(
      mint,
      regularOwner.publicKey,
      false
    );

    const createNonPdaATAInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      nonPdaTokenAccount,
      regularOwner.publicKey,
      mint
    );

    const nonPdaATATx = new Transaction().add(createNonPdaATAInstruction);
    const nonPdaSignature = await provider.connection.sendTransaction(
      nonPdaATATx,
      [payer]
    );
    await provider.connection.confirmTransaction(nonPdaSignature);

    await mintTo(
      provider.connection,
      payer,
      mint,
      nonPdaTokenAccount,
      payer.publicKey,
      TRANSFER_AMOUNT
    );

    const transferAmount = 100_000_000_000;

    try {
      await program.methods
        .transferFromUserAccountWithAuth(
          Array.from(EMAIL_HASH),
          groth16Proof,
          new anchor.BN(transferAmount)
        )
        .accounts({
          authority: authority.publicKey,
          sourceTokenAccount: nonPdaTokenAccount,
          destinationTokenAccount: destinationTokenAccount,
          mint: mint,
        })
        .preInstructions([createComputeBudgetInstruction()])
        .signers([authority])
        .rpc();

      assert.fail(
        "Expected transaction to fail because token account is not owned by PDA"
      );
    } catch (error: any) {
      console.log("Expected error for non-PDA token account:", error.message);

      assert.ok(
        error.message.includes("ConstraintTokenOwner") ||
          error.message.includes("InvalidAccountData") ||
          error.message.includes("token::authority")
      );
    }
  });
});
