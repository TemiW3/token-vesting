#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("FqzkXZdwYjurnUKetJCAvaUw5WAqbwzU6gZEwydeEfqS");

#[program]
pub mod vesting {
    use super::*;

    pub fn create_vesting_account(ctx: Context<CreateVestingAccount>, company_name: String) -> Result<()>{
        *ctx.accounts.vesting_account = VestingAccount {
            owner: ctx.accounts.signer.key(),
            mint: ctx.accounts.mint.key(),
            treasury_account: ctx.accounts.treasury_account.key(),
            company_name,
            treatury_bump: ctx.bumps.treasury_account,
            bump: ctx.bumps.vesting_account,
        }; 

        Ok(())
    }

    pub fn create_employee_vesting_account(
        ctx: Context<CreateEmployeeVestingAccount>,
        start_time: i64,
        end_time: i64,
        amount: u64,
        cliff_time: i64,
    ) -> Result<()> {
        *ctx.accounts.employee_vesting_account = EmployeeVestingAccount {
            beneficiary: ctx.accounts.beneficiary.key(),
            start_time,
            end_time,
            cliff_time,
            vesting_acccount: ctx.accounts.vesting_account.key(),
            amount,
            total_claimed: 0,
            bump: ctx.bumps.employee_vesting_account,
        };

        Ok(())
    }



}

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct CreateVestingAccount<'info>{
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        space = 8 + VestingAccount::INIT_SPACE,
        payer = signer,
        seeds = [company_name.as_ref()],
        bump,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        token::mint = mint,
        token::authority = treasury_account,
        payer = signer,
        seeds = [b"treasury", company_name.as_bytes()],
        bump,
    )]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    
}

#[derive(Accounts)]
pub struct CreateEmployeeVestingAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub beneficiary: SystemAccount<'info>,

    #[account(
        has_one = owner,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    #[account(
        init,
        space = 8 + EmployeeVestingAccount::INIT_SPACE,
        payer = owner,
        seeds = [b"employee_vesting", vesting_account.key().as_ref(), beneficiary.key().as_ref()],
        bump,
    )]
    pub employee_vesting_account: Account<'info, EmployeeVestingAccount>,

    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct VestingAccount {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub treasury_account: Pubkey,
    #[max_len(64)]
    pub company_name: String,
    pub treatury_bump: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EmployeeVestingAccount {
    pub beneficiary: Pubkey,
    pub start_time: i64, // Unix timestamp in seconds
    pub end_time: i64,
    pub cliff_time: i64,
    pub vesting_acccount: Pubkey,
    pub amount: u64,
    pub total_claimed: u64,
    pub bump: u8,
}