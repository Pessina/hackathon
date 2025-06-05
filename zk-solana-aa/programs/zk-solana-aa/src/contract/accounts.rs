use anchor_lang::prelude::*;

use crate::contract::auth::{verify_jwt_proof, SP1Groth16Proof};

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32])]
pub struct CreateUserAccountWithAuth<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = UserAccount::SPACE,
        seeds = [UserAccount::SEED_PREFIX, &email_hash],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32])]
pub struct TransferFromUserAccountWithAuth<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, &email_hash],
        bump = user_account.bump,
        constraint = user_account.email_hash == email_hash @ ErrorCode::EmailHashMismatch
    )]
    pub user_account: Account<'info, UserAccount>,

    /// CHECK: This account receives the SOL transfer
    #[account(mut)]
    pub destination: AccountInfo<'info>,
}

pub fn create_user_account_with_auth(
    ctx: Context<CreateUserAccountWithAuth>,
    email_hash: [u8; 32],
    groth16_proof: SP1Groth16Proof,
) -> Result<()> {
    let public_outputs = verify_jwt_proof(groth16_proof)?;
    let verified_email_hash = public_outputs.email_hash;

    require!(
        verified_email_hash == email_hash,
        ErrorCode::EmailHashMismatch
    );

    ctx.accounts.user_account.set_inner(UserAccount {
        email_hash,
        bump: ctx.bumps.user_account,
    });

    emit!(UserAccountCreated {
        user_account: ctx.accounts.user_account.key(),
        email_hash,
    });

    Ok(())
}

pub fn transfer_from_user_account_with_auth(
    ctx: Context<TransferFromUserAccountWithAuth>,
    email_hash: [u8; 32],
    groth16_proof: SP1Groth16Proof,
    amount: u64,
) -> Result<()> {
    let public_outputs = verify_jwt_proof(groth16_proof)?;
    let verified_email_hash = public_outputs.email_hash;

    require!(
        verified_email_hash == email_hash,
        ErrorCode::EmailHashMismatch
    );

    let user_account = &ctx.accounts.user_account;

    // Check that the user account has sufficient balance
    let user_account_lamports = user_account.to_account_info().lamports();
    let rent_exempt_minimum = Rent::get()?.minimum_balance(UserAccount::SPACE);
    let available_balance = user_account_lamports
        .checked_sub(rent_exempt_minimum)
        .ok_or(ErrorCode::InsufficientBalance)?;

    require!(available_balance >= amount, ErrorCode::InsufficientBalance);

    // Transfer SOL by manually adjusting lamports
    // Since the user_account is a PDA with data, we cannot use system_program::transfer
    // Instead, we directly modify the lamports in both accounts
    **ctx
        .accounts
        .user_account
        .to_account_info()
        .try_borrow_mut_lamports()? -= amount;
    **ctx
        .accounts
        .destination
        .to_account_info()
        .try_borrow_mut_lamports()? += amount;

    emit!(SolTransferred {
        user_account: user_account.key(),
        amount,
        destination: ctx.accounts.destination.key(),
        email_hash,
    });

    Ok(())
}

#[account]
pub struct UserAccount {
    pub email_hash: [u8; 32],
    pub bump: u8,
}

impl UserAccount {
    pub const SEED_PREFIX: &'static [u8] = b"user_account";

    pub const SPACE: usize = 8 + // discriminator
        32 + // email_hash (32 bytes for SHA256)
        1; // bump

    pub fn find_program_address(email_hash: &[u8; 32], program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[Self::SEED_PREFIX, email_hash], program_id)
    }
}

#[event]
pub struct UserAccountCreated {
    pub user_account: Pubkey,
    pub email_hash: [u8; 32],
}

#[event]
pub struct SolTransferred {
    pub user_account: Pubkey,
    pub amount: u64,
    pub destination: Pubkey,
    pub email_hash: [u8; 32],
}

#[error_code]
pub enum ErrorCode {
    #[msg("JWT proof verification failed")]
    ProofVerificationFailed,
    #[msg("Email hash mismatch")]
    EmailHashMismatch,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
