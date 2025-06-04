// use anchor_lang::prelude::*;
// use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

// /// Account structure for creating a PDA wallet
// #[derive(Accounts)]
// #[instruction(seed: String)]
// pub struct CreatePDAWallet<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,

//     /// The PDA wallet account
//     #[account(
//         init,
//         payer = payer,
//         space = 8 + 32 + 4 + seed.len(), // discriminator + owner + string length + seed
//         seeds = [seed.as_bytes()],
//         bump
//     )]
//     pub pda_wallet: Account<'info, PDAWallet>,

//     pub system_program: Program<'info, System>,
// }

// /// Account structure for staking transactions from PDA
// #[derive(Accounts)]
// #[instruction(seed: String)]
// pub struct StakeFromPDA<'info> {
//     /// The PDA wallet that will sign the transaction
//     #[account(
//         mut,
//         seeds = [seed.as_bytes()],
//         bump = pda_wallet.bump,
//         has_one = owner
//     )]
//     pub pda_wallet: Account<'info, PDAWallet>,

//     /// The owner who can authorize transactions from this PDA
//     pub owner: Signer<'info>,

//     /// Source token account (owned by PDA)
//     #[account(
//         mut,
//         associated_token::mint = mint,
//         associated_token::authority = pda_wallet
//     )]
//     pub source_token_account: Account<'info, TokenAccount>,

//     /// Destination staking account
//     #[account(mut)]
//     pub destination_account: Account<'info, TokenAccount>,

//     /// Token mint
//     pub mint: Account<'info, anchor_spl::token::Mint>,

//     /// Token program
//     pub token_program: Program<'info, Token>,
// }

// /// Account structure for funding the PDA wallet
// #[derive(Accounts)]
// #[instruction(seed: String)]
// pub struct FundPDAWallet<'info> {
//     #[account(mut)]
//     pub funder: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [seed.as_bytes()],
//         bump = pda_wallet.bump
//     )]
//     pub pda_wallet: Account<'info, PDAWallet>,

//     pub system_program: Program<'info, System>,
// }

// /// PDA Wallet account data
// #[account]
// pub struct PDAWallet {
//     /// The owner who can authorize transactions
//     pub owner: Pubkey,
//     /// The bump seed for PDA derivation
//     pub bump: u8,
//     /// The seed string used to create this PDA
//     pub seed: String,
// }

// impl PDAWallet {
//     /// Calculate the space needed for this account
//     pub fn space(seed: &str) -> usize {
//         8 + // discriminator
//         32 + // owner pubkey
//         1 + // bump
//         4 + seed.len() // string length prefix + seed
//     }
// }
