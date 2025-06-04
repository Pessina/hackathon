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
      "a4594c591355f4981a278d1996d6be6bcd4c93acc06e0842c323dc9402065dddfb2b724520e66c06863c4c151472ff98df9cda2d5e65e85ba357f9c7dc88f57b4f9607a420478ac85dd75880d98c73bbacf67a8527a5a9ec0a2be1c08b9251c1f099c6192b4ae9af00cafb97a577a5479d56a6322aa01da2ef896e4a8c2cafcf4158da4f0de149f9dc36bbb869c5db9f8da7f830274951c1350b09623dff881254f014ff16fe0051714aa090ed0ab8c83f4a5ad41bda6d23bb097f1c55d739cb447ef1aa1d0be2ff7495400d87c0999e22459a84bf4bf0516f145803c4b0d977a409d8ee1a89f0a633d5250f40bfddf4d771c422df3cdead05a278d10b47eeb16b7fcd60";
    const publicValuesHex =
      "140000000000000066732e70657373696e6140676d61696c2e636f6d0f00000000000000746573745f3132335f66656c6970653f745105166b6b695a6f0868ddce8f4a0bf34648495c5b550f12d944c0235f4d01";

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
          units: 1_200_000, // Higher limit for ZK-SP1 crate implementation
        }
      );

      const computeBudgetInstructionHeap =
        ComputeBudgetProgram.requestHeapFrame({
          bytes: 224 * 1024, // 128KB additional heap
        });

      const tx = await program.methods
        .verifyGroth16Proof(groth16Proof)
        .preInstructions([
          computeBudgetInstruction,
          computeBudgetInstructionHeap,
        ])
        .rpc();
      console.log("Proof verification transaction signature:", tx);
    } catch (error) {
      console.error("Proof verification failed:", error);
      throw error;
    }
  });
});
