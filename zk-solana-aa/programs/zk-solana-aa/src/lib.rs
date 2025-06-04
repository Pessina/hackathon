use anchor_lang::prelude::*;

mod constants;
mod contract;

use contract::auth::*;

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

#[program]
pub mod zk_solana_aa {
    use super::*;

    pub fn verify_jwt_proof(
        _ctx: Context<VerifyProof>,
        groth16_proof: SP1Groth16Proof,
    ) -> Result<()> {
        verify_jwt_proof_impl(_ctx, groth16_proof)?;

        Ok(())
    }
}
