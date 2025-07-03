use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};
use sp1_primitives::io::SP1PublicValues;
use sp1_solana::verify_proof;
use p3_baby_bear::BabyBear;
use p3_field::PrimeField32;

use crate::constants;

type PoseidonHash = [BabyBear; 8];

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SP1Groth16Proof {
    pub proof: Vec<u8>,
    pub sp1_public_inputs: Vec<u8>,
}

// Optimized JWT claims - only hash private fields, expose public fields directly
// The order matters, it should be the same as the order of the public inputs in the SP1 program
#[derive(Serialize, Deserialize)]
pub struct PublicOutputs {
    pub email_hash: PoseidonHash,    // Email hash (private field that needs hashing)
    pub sub: String,                 // Subject (public field, exposed directly)
    pub iss: String,                 // Issuer (public field, exposed directly)
    pub aud: String,                 // Audience (public field, exposed directly)
    pub verified: bool,
}

const JWT_VKEY_HASH: &str = "0x00390c74c859c201b98ba24a54e76c683b6a25625767e42529b156f19cfc4eae";

// Helper function to convert Poseidon hash to bytes for compatibility
pub fn poseidon_to_bytes(hash: &PoseidonHash) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    for (i, elem) in hash.iter().enumerate() {
        if i * 4 < 32 {
            let elem_bytes = elem.as_canonical_u32().to_le_bytes();
            let start = i * 4;
            let end = (start + 4).min(32);
            let copy_len = end - start;
            bytes[start..end].copy_from_slice(&elem_bytes[..copy_len]);
        }
    }
    bytes
}

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
    
    // Only validate proof verification status
    if !public_outputs.verified {
        return Err(error!(ErrorCode::ProofVerificationFailed));
    }

    Ok(public_outputs)
}

#[derive(Accounts)]
pub struct VerifyProof {}

#[error_code]
pub enum ErrorCode {
    #[msg("Proof verification failed")]
    ProofVerificationFailed,
}
