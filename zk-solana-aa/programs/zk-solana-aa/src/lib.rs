use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};
use sp1_primitives::io::SP1PublicValues;
use sp1_solana::verify_proof;

mod constants;
// mod contract;

type PoseidonHash = [u32; 8];

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

const JWT_VKEY_HASH: &str = "0x00186dd398b016ce6e34591b0f3d64e3c402269c384dd2d28062d5442750d17a";

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SP1Groth16Proof {
    pub proof: Vec<u8>,
    pub sp1_public_inputs: Vec<u8>,
}

// The order matters, it should be the same as the order of the public inputs in the SP1 program
#[derive(Serialize, Deserialize)]
pub struct PublicOutputs {
    pub email_hash: PoseidonHash,
    pub pk_hash: PoseidonHash,
    pub nonce: String,
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
        verify_sp1_proof(&groth16_proof.proof, &groth16_proof.sp1_public_inputs)?;

        process_public_inputs(groth16_proof.sp1_public_inputs)?;

        Ok(())
    }
}

fn verify_sp1_proof(proof: &[u8], public_inputs: &[u8]) -> Result<()> {
    let vk = constants::GROTH16_VK_5_0_0_BYTES;

    verify_proof(proof, public_inputs, &JWT_VKEY_HASH, vk)
        .map_err(|_| error!(ErrorCode::ProofVerificationFailed))?;

    Ok(())
}

fn process_public_inputs(sp1_public_inputs: Vec<u8>) -> Result<()> {
    let mut public_values = SP1PublicValues::from(&sp1_public_inputs);

    let public_outputs: PublicOutputs = public_values.read();

    msg!("Email: {:?}", public_outputs.email_hash);
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
