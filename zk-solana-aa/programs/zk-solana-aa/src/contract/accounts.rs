use anchor_lang::prelude::*;

use crate::contract::auth::{verify_jwt_proof, poseidon_to_bytes, SP1Groth16Proof};

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32], salt: String)]
pub struct CreateUserAccountWithAuth<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = UserAccount::SPACE,
        seeds = [UserAccount::SEED_PREFIX, &email_hash, salt.as_bytes()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(email_hash: [u8; 32], salt: String)]
pub struct TransferFromUserAccountWithAuth<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [UserAccount::SEED_PREFIX, &email_hash, salt.as_bytes()],
        bump = user_account.bump,
        constraint = user_account.email_hash == email_hash @ ErrorCode::EmailHashMismatch,
        constraint = user_account.salt == salt @ ErrorCode::SaltMismatch
    )]
    pub user_account: Account<'info, UserAccount>,

    /// CHECK: This account receives the SOL transfer
    #[account(mut)]
    pub destination: AccountInfo<'info>,
}

pub fn create_user_account_with_auth(
    ctx: Context<CreateUserAccountWithAuth>,
    email_hash: [u8; 32],
    salt: String,
    groth16_proof: SP1Groth16Proof,
) -> Result<()> {
    let public_outputs = verify_jwt_proof(groth16_proof)?;
    let verified_email_hash = poseidon_to_bytes(&public_outputs.email_hash);

    require!(
        verified_email_hash == email_hash,
        ErrorCode::EmailHashMismatch
    );

    // Validate salt length to prevent excessive storage costs
    require!(salt.len() <= 32, ErrorCode::SaltTooLong);

    ctx.accounts.user_account.set_inner(UserAccount {
        email_hash,
        salt: salt.clone(),
        bump: ctx.bumps.user_account,
    });

    emit!(UserAccountCreated {
        user_account: ctx.accounts.user_account.key(),
        email_hash,
        salt,
    });

    Ok(())
}

pub fn transfer_from_user_account_with_auth(
    ctx: Context<TransferFromUserAccountWithAuth>,
    email_hash: [u8; 32],
    salt: String,
    groth16_proof: SP1Groth16Proof,
    amount: u64,
) -> Result<()> {
    let public_outputs = verify_jwt_proof(groth16_proof)?;
    let verified_email_hash = poseidon_to_bytes(&public_outputs.email_hash);

    require!(
        verified_email_hash == email_hash,
        ErrorCode::EmailHashMismatch
    );
    
    // Check that the user account has sufficient balance
    let user_account_lamports = ctx.accounts.user_account.to_account_info().lamports();
    let rent_exempt_minimum = Rent::get()?.minimum_balance(UserAccount::SPACE);
    let available_balance = user_account_lamports
        .checked_sub(rent_exempt_minimum)
        .ok_or(ErrorCode::InsufficientBalance)?;

    require!(available_balance >= amount, ErrorCode::InsufficientBalance);
    
    // Get the user account key before borrowing mutably
    let user_account_key = ctx.accounts.user_account.key();
    
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
        user_account: user_account_key,
        amount,
        destination: ctx.accounts.destination.key(),
        email_hash,
        salt,
    });

    Ok(())
}

#[account]
pub struct UserAccount {
    pub email_hash: [u8; 32],
    pub salt: String,
    pub bump: u8,
}

impl UserAccount {
    pub const SEED_PREFIX: &'static [u8] = b"user_account";

    pub const SPACE: usize = 8 + // discriminator
        32 + // email_hash (32 bytes for SHA256)
        4 + 32 + // salt (String with max 32 chars: 4 bytes length + 32 bytes data)
        1; // bump

    pub fn find_program_address(
        email_hash: &[u8; 32],
        salt: &str,
        program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[Self::SEED_PREFIX, email_hash, salt.as_bytes()],
            program_id,
        )
    }
}

#[event]
pub struct UserAccountCreated {
    pub user_account: Pubkey,
    pub email_hash: [u8; 32],
    pub salt: String,
}

#[event]
pub struct SolTransferred {
    pub user_account: Pubkey,
    pub amount: u64,
    pub destination: Pubkey,
    pub email_hash: [u8; 32],
    pub salt: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("JWT proof verification failed")]
    ProofVerificationFailed,
    #[msg("Email hash mismatch")]
    EmailHashMismatch,
    #[msg("Salt mismatch")]
    SaltMismatch,
    #[msg("Salt too long (max 32 characters)")]
    SaltTooLong,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
