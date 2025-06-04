use anchor_lang::prelude::*;
use p3_baby_bear::BabyBear;
use serde::{Deserialize, Serialize};
use sp1_primitives::io::SP1PublicValues;
use sp1_solana::verify_proof;

use crate::constants;

type PoseidonHash = [BabyBear; 8];

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

const JWT_VKEY_HASH: &str = "0x0064ed2fa8374e88956274696c857993416e36810a247a310a3b084804b49822";

pub fn verify_jwt_proof_impl(
    _ctx: Context<VerifyProof>,
    groth16_proof: SP1Groth16Proof,
) -> Result<PublicOutputs> {
    let vk = constants::GROTH16_VK_5_0_0_BYTES;

    verify_proof(
        &groth16_proof.proof,
        &groth16_proof.sp1_public_inputs,
        &JWT_VKEY_HASH,
        vk,
    )
    .map_err(|_| error!(ErrorCode::ProofVerificationFailed))?;

    let mut public_values = SP1PublicValues::from(&groth16_proof.sp1_public_inputs);

    let public_outputs: PublicOutputs = public_values.read();

    Ok(public_outputs)
}

#[derive(Accounts)]
pub struct VerifyProof {}

#[error_code]
pub enum ErrorCode {
    #[msg("Proof verification failed")]
    ProofVerificationFailed,
}
