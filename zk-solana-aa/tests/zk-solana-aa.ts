import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import { ComputeBudgetProgram } from "@solana/web3.js";

describe("zk-solana-aa", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;

  it("Verifies Groth16 proof", async () => {
    const proofHex =
      "a4594c59088d5af18703827f019a144908ea4206ef67a88dcf45fd911242b87ba13fb2bd1ec2aedb9d459cc84e6c59f3a1ae27a76afe38d9d92547e5f3cef3c2c6de4d5c06d63cbd6c4a63ff1f75ba8712be2ad7e8c9a3c37ad6ac34e55d4ece02ad17ad019d03f7f2bc73c399063411a50594267d3af80b2a60d75a76fcfb70517352572643845fd1a39b943265f9742f081eddb05d3732d114f17eff8363ed3060be0a15836d4cc9dfe236e2eddc86c483fe0183cd93a586bbe658d805c3006b696333239ff232a2dc7d51061c03d7c9a8fd4754cb46bd0508f108a87783df3ec84cd21d48694c255465fa3a2f2da3b19f6a8c1541d9f538dac93d7c8d4ebad8829ca5";
    const publicValuesHex =
      "b9c53ddad62c54e2b8e437460ac30709d700d1eb6b0d1b58e2344a6c64cef0c40852d63bb7aa68da1ce892b3be6601ea2a815032ecaaf4a53e0105f4f54f7b540f00000000000000746573745f3132335f66656c69706501";

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
          units: 500_000, // Higher limit for ZK-SP1 crate implementation
        }
      );

      await program.methods
        .verifyJwtProof(groth16Proof)
        .preInstructions([computeBudgetInstruction])
        .rpc();
    } catch (error) {
      console.error("Proof verification failed:", error);
      throw error;
    }
  });
});
