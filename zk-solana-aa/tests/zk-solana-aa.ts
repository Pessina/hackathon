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
      "a4594c59054e3d69a0e6f81f918c70daba9ed61ccf6e6de62d0c49cf50fc92e8f64629ca1564b0dcb943b60f6b812dc6f51fe011dcc4506d87201fb4426bf68be7a31a0d050ef2cbb65ae22d05cc659ff8c378fae18dcd1a879bc4ee4dccf40f553215ae2e31be4db327b40ce1c33152737333df2cd71cceb7078de20bf4ea80b8ce7abd1a2d427a38a797038be0dc03325fe237147103aedffd40bf48e7fc584c3f56ee23c6b57ac9ef03c05dcaa93c625c9dd291afe9fc5448c8c11699f4ae558648d0275ac2c6db3e4e52ee21ffaa680abefa286df88fa3da3d8c248586f459a8a0a926288c2e05abea1a6d068800f5c43c909eddb61185f4a4d4e3fadf3cc4485dea";
    const publicValuesHex = "01";

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
