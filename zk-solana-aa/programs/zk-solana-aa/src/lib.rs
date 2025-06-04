use anchor_lang::prelude::*;
use p3_baby_bear::BabyBear;
use serde::{Deserialize, Serialize};
use sp1_primitives::io::SP1PublicValues;
use sp1_solana::verify_proof;

mod constants;
// mod contract;

type PoseidonHash = [BabyBear; 8];

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

#[cfg(not(doctest))]
/// Derived as follows:
///
/// ```
/// let client = sp1_sdk::ProverClient::new();
/// let (pk, vk) = client.setup(YOUR_ELF_HERE);
/// let vkey_hash = vk.bytes32();
/// ```
const JWT_VKEY_HASH: &str = "0x00021a169057e720fd0e51dfc27aa641d094e2524a39c5a62df0d5cd95194b39";

/// The instruction data for the program.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SP1Groth16Proof {
    pub proof: Vec<u8>,
    pub sp1_public_inputs: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct PublicOutputs {
    pub email: String,
    pub nonce: String,
    pub pk_hash: PoseidonHash,
    pub verified: bool,
}

#[program]
pub mod zk_solana_aa {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn verify_groth16_proof(
        _ctx: Context<VerifyProof>,
        groth16_proof: SP1Groth16Proof,
    ) -> Result<()> {
        // Verify the proof first and drop the proof data to free memory
        verify_sp1_proof(&groth16_proof.proof, &groth16_proof.sp1_public_inputs)?;

        // Extract and process public inputs after proof verification
        process_public_inputs(groth16_proof.sp1_public_inputs)?;

        Ok(())
    }
}

// Helper functions outside the #[program] module
fn verify_sp1_proof(proof: &[u8], public_inputs: &[u8]) -> Result<()> {
    // Get the SP1 Groth16 verification key from the `sp1-solana` crate.
    let vk = constants::GROTH16_VK_5_0_0_BYTES;

    // Verify the proof.
    verify_proof(proof, public_inputs, &JWT_VKEY_HASH, vk)
        .map_err(|_| error!(ErrorCode::ProofVerificationFailed))?;

    Ok(())
}

fn process_public_inputs(sp1_public_inputs: Vec<u8>) -> Result<()> {
    // Create SP1PublicValues from the byte array
    let mut public_values = SP1PublicValues::from(&sp1_public_inputs);

    // Read the structured data directly
    let public_outputs: PublicOutputs = public_values.read();

    msg!("Email: {:?}", public_outputs.email);
    msg!("Nonce: {:?}", public_outputs.nonce);
    msg!("Public Key Hash: {:?}", public_outputs.pk_hash);
    msg!("Verified: {:?}", public_outputs.verified);

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct VerifyProof {}

#[error_code]
pub enum ErrorCode {
    #[msg("Proof verification failed")]
    ProofVerificationFailed,
    #[msg("Invalid public inputs")]
    InvalidPublicInputs,
}
