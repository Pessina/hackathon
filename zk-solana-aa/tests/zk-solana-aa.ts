import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkSolanaAa } from "../target/types/zk_solana_aa";
import { ComputeBudgetProgram } from "@solana/web3.js";

describe("zk-solana-aa", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.zkSolanaAa as Program<ZkSolanaAa>;

  it("Verifies Groth16 proof", async () => {
    const proofHex =
      "a4594c59194a6ef014151a4bd5f93b2e5b071747dfcd2c8223b34883ed296a9df5705c48238af59b08babf2fa2e169ed6a7167316032c78f2f7fb5b1a76588ada92851ea10a94980d24e726938d6f75ae0c8493c387874634377df4f268f78a2136998b90999a541f731f9dff6219b81cab10567845879c783aabe8f716fa883c58c24551b72a7d3dd5c8bf6b4fb473690fbbd30db18e886b4521e1443e1af7ae0f5d0a81ef690c08df84cb80e723785e0ddbdff333d97e308dadbeb97c01b3d4b8b093626beea41b5b44929fac4981edad609bb8727a379a0bbfe49a05c89c8c9992e2023d53bc7485442e7a7ce7619e607ec56fec96668ee861a6f4af05f501fbb9ceb";
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
