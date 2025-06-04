use anchor_lang::prelude::*;
use sp1_solana::verify_proof;

mod constants;
// mod contract;

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

#[cfg(not(doctest))]
/// Derived as follows:
///
/// ```
/// let client = sp1_sdk::ProverClient::new();
/// let (pk, vk) = client.setup(YOUR_ELF_HERE);
/// let vkey_hash = vk.bytes32();
/// ```
const JWT_VKEY_HASH: &str = "0x0050b304332480357605f91b1859f2c0fe5b4dd171300f2ef38d1b32bf831088";

/// The instruction data for the program.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SP1Groth16Proof {
    pub proof: Vec<u8>,
    pub sp1_public_inputs: Vec<u8>,
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
        msg!("JWT_VKEY_HASH: {:?}", JWT_VKEY_HASH);

        // Get the SP1 Groth16 verification key from the `sp1-solana` crate.
        let vk = constants::GROTH16_VK_5_0_0_BYTES;

        // Verify the proof.
        verify_proof(
            &groth16_proof.proof,
            &groth16_proof.sp1_public_inputs,
            &JWT_VKEY_HASH,
            vk,
        )
        .map_err(|_| error!(ErrorCode::ProofVerificationFailed))?;

        // Extract the public outputs like in main.rs
        let mut reader = groth16_proof.sp1_public_inputs.as_slice();
        let pk_hash = Vec::<u8>::deserialize(&mut reader)
            .map_err(|_| error!(ErrorCode::InvalidPublicInputs))?;
        let email_hash = Vec::<u8>::deserialize(&mut reader)
            .map_err(|_| error!(ErrorCode::InvalidPublicInputs))?;
        let nonce =
            String::deserialize(&mut reader).map_err(|_| error!(ErrorCode::InvalidPublicInputs))?;

        msg!("Public key hash: {:?}", pk_hash);
        msg!("Email hash: {:?}", email_hash);
        msg!("Nonce: {}", nonce);

        Ok(())
    }
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
