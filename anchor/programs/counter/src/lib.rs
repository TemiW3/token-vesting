#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{self, Mint, TransferChecked, TokenAccount, TokenInterface}};

declare_id!("FqzkXZdwYjurnUKetJCAvaUw5WAqbwzU6gZEwydeEfqS");

#[program]
pub mod vesting {
    use core::time;

    use anchor_spl::token_interface;

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
            vesting_account: ctx.accounts.vesting_account.key(),
            amount,
            total_claimed: 0,
            bump: ctx.bumps.employee_vesting_account,
        };

        Ok(())
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>, _company_name: String) -> Result<()> {
        let employee_account = &mut ctx.accounts.employee_vesting_account;

        let now = Clock::get()?.unix_timestamp;

        if now < employee_account.cliff_time {
            return Err(ErrorCode::CliffNotReached.into());
        }

        let time_since_start = now.saturating_sub(employee_account.start_time);
        let total_vesting_time = employee_account.end_time.saturating_sub(employee_account.start_time);

        if (total_vesting_time == 0) {
            return Err(ErrorCode::InvalidVestingPeriod.into());
        }

        let vested_amount = if now >= employee_account.end_time{
            employee_account.amount
        } else {
           match employee_account.amount.checked_mul(time_since_start as u64){ // Calculate the vested amount based on the time elapsed
                Some(product) => {
                    product / total_vesting_time as u64
                }
                None => {
                    return Err(ErrorCode::CalcOverflow.into());
                }
           }
        };

        let claimable_amount = vested_amount.saturating_sub(employee_account.total_claimed);

        if claimable_amount == 0 {
            return Err(ErrorCode::NothingToClaim.into());
        }

        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.treasury_account.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let signer_seeds: &[&[&[u8]]] = &[
            &[b"treasury",
            ctx.accounts.vesting_account.company_name.as_ref(),
            &[ctx.accounts.vesting_account.treatury_bump]],
        ];

        let cpi_context = CpiContext::new(
            cpi_program,
            transfer_cpi_accounts,
        ).with_signer(signer_seeds);

        let decimals = ctx.accounts.mint.decimals;

        token_interface::transfer_checked(
            cpi_context,
            claimable_amount as u64,
            decimals,
        )?;

        employee_account.total_claimed += claimable_amount;


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

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        seeds = [b"employee_vesting", vesting_account.key().as_ref(), beneficiary.key().as_ref()],
        bump = employee_vesting_account.bump,
        has_one = beneficiary,
        has_one = vesting_account,
    )]
    pub employee_vesting_account: Account<'info, EmployeeVestingAccount>,

    #[account(
        mut,
        seeds = [company_name.as_bytes()],
        bump = vesting_account.bump,
        has_one = treasury_account,
        has_one = mint,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub treasury_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
        associated_token::token_program = token_program,
    )]
    pub beneficiary_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

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
    pub vesting_account: Pubkey,
    pub amount: u64,
    pub total_claimed: u64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Cliff not reached yet.")]
    CliffNotReached,
    #[msg("Invalid vesting period.")]
    InvalidVestingPeriod,
    #[msg("Calculation overflow occurred.")]
    CalcOverflow,
    #[msg("Nothing to claim.")]
    NothingToClaim,
}