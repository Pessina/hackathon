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
      "a4594c592a31926e8a69dc414d7f85e9ba2e3fbb1e808f62f2e6eec9fec2882335a3c975158f7455136c9213f6b7bef2141d23b382b0fbbbf79d29bb58471c18894bd1b727cdd46964436718af7d1bb6ca86a14fae19afb27ce0b0c8bd60a685b2d338e714ba53bc0f16a00e9d4078b66ec887bc2221942f699c12a2855b433c47ca67b2281a06cff38e6cf75c712e94d3e3231397f68411edf47d6f486add26a2535025258716f2adf305d99c6e9ed70c5771f7e300b59f765f386cf827c821f7df7ca016c6e8e43452c0875a7b49b42d5cf2115665e296bea041269bbe162b6095f5a61598b0f54f8cdf013fef460b15a97888afce67adb8a2f389e27f485505fa7c66";

    // Convert hex string to bytes
    const proof = Buffer.from(proofHex, "hex");

    // Public inputs - these would be serialized using the same format as in the Rust code
    // For now, we'll create a mock public inputs buffer that matches the expected format
    const publicKeyHash = Buffer.from(
      "0852d63bb7aa68da1ce892b3be6601ea2a815032ecaaf4a53e0105f4f54f7b54",
      "hex"
    );
    const emailHash = Buffer.from(
      "e9fbf9c04d6f1f671774ab43f951e686ba7ac72b9775b1c50691846bbb68c962",
      "hex"
    );
    const nonce = "test_123_felipe";

    // This is a simplified version - in practice, you'd need to properly serialize
    // the public inputs using the same Borsh serialization format as the Rust program
    const sp1PublicInputs = Buffer.concat([
      publicKeyHash,
      emailHash,
      Buffer.from(nonce, "utf8"),
    ]);

    const groth16Proof = {
      proof: proof,
      sp1PublicInputs: sp1PublicInputs,
    };

    try {
      const computeBudgetInstruction = ComputeBudgetProgram.setComputeUnitLimit(
        {
          units: 1_400_000, // Higher limit for RSA crate implementation
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
