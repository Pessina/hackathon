import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import { ComputeBudgetProgram } from "@solana/web3.js";

describe("zk-solana-aa", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;

  it("Verifies Groth16 proof", async () => {
    const proofHex =
      "a4594c591c97e3518c874ed7cf81cc78e3f94f61f73815b51a3944fbe7cea384a10b9dbe12de49bab512e19c2ed9cfed5193bac37d1b227cea8c747e0035e04df228c1d71ddf9ac52e8e5fde71407ce7701ea07a70e4b284eada092684f715b0470ba02e2e63a11e874c7f018e1761fdcf6d6ac100265729a8c75ee2e64b3281a04c5c73056e9c6673a97d977003205aaf8c778fcad8d5fab592b4846f2a6a11aeadaf5b1bae504f3721b318cfa89a89929378b455348e37d777e1f24d0941a4fef39ba827b288cc3e4d03a10c8fae520c6bfb73d36995248864f0a05d692372d9290add10fc582f03318bc37e26d9ffc4a9061f5f9aa82e0816a9888dfc330af1d1d6a5";
    const publicValuesHex =
      "59d5943e9f52b42dc6d4e51b983c7b1ce173a2081aba973da316ba07f6da826e3f745105166b6b695a6f0868ddce8f4a0bf34648495c5b550f12d944c0235f4d0f00000000000000746573745f3132335f66656c69706501";

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

      const tx = await program.methods
        .verifyJwtProof(groth16Proof)
        .preInstructions([computeBudgetInstruction])
        .rpc();

      console.log("Proof verification transaction signature:", tx);
    } catch (error) {
      console.error("Proof verification failed:", error);
      throw error;
    }
  });
});
