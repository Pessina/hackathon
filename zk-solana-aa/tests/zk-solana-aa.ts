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
      "a4594c592b436586b2cf45bc90ed06740ea27ae5ea1f725eaec3f40f79f9a39c524541481e645a40bdf3e356111bf6270023348708f84488f60ae74d33c6734a1d68eb0324d571468cf50ae7a0bbe206f5d8382c88de9c04a20b49f61275cd2c7c1ff6fb036adc2f2eaac598e64ba1bb80247f77f9562b6b30cab945c3bf89d70e2ad7e928284ab6b2295cf4f26b15f6bb47ac978126403611ebf1579810c2ca6277f30019cdc6a33421eee3d73fc5bbb06f639c801672bc29feb33ffa8722023465173025d965596b84f31671f2c4dc877549308b6159a6addb6a0fc15bf40acb596dde022c21a32420bf47209567fec735da3e9c58a32871c826a3fccd25fe21e802e4";
    const publicValuesHex =
      "20000000000000003f745105166b6b695a6f0868ddce8f4a0bf34648495c5b550f12d944c0235f4d200000000000000059d5943e9f52b42dc6d4e51b983c7b1ce173a2081aba973da316ba07f6da826e0f00000000000000746573745f3132335f66656c697065";

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
