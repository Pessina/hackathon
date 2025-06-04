use anchor_lang::prelude::*;

declare_id!("DMztWS673fGnGLPReJa5pVNaMqG5VxRjjFcnNXaDzX54");

#[program]
pub mod zk_solana_aa {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
