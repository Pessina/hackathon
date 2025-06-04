import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import { ComputeBudgetProgram } from "@solana/web3.js";

describe("zk-solana-aa", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Verifies Groth16 proof", async () => {
    // Test data from the provided proof
    const proofHex =
      "a4594c5919893e3348a5ad0324192c415fa1f94ab7d7053152c4b227a61fe9d659875ea10f36f62a3583624f3c7b4d00b1613d08c8a93120bf20a20387e569afdb36e2c40b6cc75b59e168a9acf962264c02b3568e56fdb14bf08acb67e4ab733dbaed6b160bf9a7acd3ef82da430a758f9ca4af3c5512b7c0e46365b0a173ca51323cf601f52f2699c45f2d84cf5553edc093483dbc0e23fcdadafd9471fa2aa9f6c19b04815fdd3479162b730e4768b275ea91edd4335c82c89254a09bb89ba42a1f7f1699eebe916a60e46351b532ddfa8c2013ceae0e67430156e6134e07df64df8406bf87dade79fe2206ef10ca81ba067dde3aaadbc63adb76f92f2e434412d487";
    const publicValuesHex =
      "20000000000000000852d63bb7aa68da1ce892b3be6601ea2a815032ecaaf4a53e0105f4f54f7b542000000000000000e9fbf9c04d6f1f671774ab43f951e686ba7ac72b9775b1c50691846bbb68c9620f00000000000000746573745f3132335f66656c697065";

    // Convert hex string to bytes
    const proof = Buffer.from(proofHex, "hex");
    const publicValues = Buffer.from(publicValuesHex, "hex");

    const groth16Proof = {
      proof: proof,
      sp1PublicInputs: publicValues,
    };

    console.log({
      proofLength: proof.length,
      publicValuesLength: publicValues.length,
    });

    try {
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit(
        {
          units: 1_200_000, // Higher limit for RSA crate implementation
        }
      );

      const tx = await program.methods
        .verifyGroth16Proof(groth16Proof)
        .preInstructions([computeBudgetInstruction])
        .rpc();
      console.log("Proof verification transaction signature:", tx);
    } catch (error) {
      console.error("Proof verification failed:", error);
      throw error;
    }
  });
});
