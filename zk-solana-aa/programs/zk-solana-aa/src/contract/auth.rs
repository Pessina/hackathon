use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};
use sp1_primitives::io::SP1PublicValues;
use sp1_solana::verify_proof;

use crate::constants;

type Sha256Hash = [u8; 32];

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SP1Groth16Proof {
    pub proof: Vec<u8>,
    pub sp1_public_inputs: Vec<u8>,
}

// The order matters, it should be the same as the order of the public inputs in the SP1 program
#[derive(Serialize, Deserialize)]
pub struct PublicOutputs {
    pub email_hash: Sha256Hash,
    pub pk_hash: Sha256Hash,
    pub nonce: String,
    pub verified: bool,
}

const JWT_VKEY_HASH: &str = "0x00390c74c859c201b98ba24a54e76c683b6a25625767e42529b156f19cfc4eae";

pub fn verify_jwt_proof(groth16_proof: SP1Groth16Proof) -> Result<PublicOutputs> {
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
