use anchor_lang::prelude::*;

mod constants;
mod contract;

use contract::accounts::*;
use contract::auth::*;

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

#[program]
pub mod zk_solana_aa {
    use super::*;

    pub fn verify_jwt_proof(
        _ctx: Context<VerifyProof>,
        groth16_proof: SP1Groth16Proof,
    ) -> Result<()> {
        contract::auth::verify_jwt_proof(groth16_proof)?;
        Ok(())
    }

    pub fn create_user_account_with_auth(
        ctx: Context<CreateUserAccountWithAuth>,
        email_hash: [u8; 32],
        groth16_proof: SP1Groth16Proof,
    ) -> Result<()> {
        contract::accounts::create_user_account_with_auth(ctx, email_hash, groth16_proof)
    }

    pub fn transfer_from_user_account_with_auth(
        ctx: Context<TransferFromUserAccountWithAuth>,
        email_hash: [u8; 32],
        groth16_proof: SP1Groth16Proof,
        amount: u64,
    ) -> Result<()> {
        contract::accounts::transfer_from_user_account_with_auth(
            ctx,
            email_hash,
            groth16_proof,
            amount,
        )
    }
}
