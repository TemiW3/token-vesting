import { PublicKey, Keypair } from '@solana/web3.js'
import { describe } from 'node:test'
import * as anchor from '@coral-xyz/anchor'
import { createMint } from 'spl-token-bankrun'
import { BanksClient, Clock, ProgramTestContext, startAnchor } from 'solana-bankrun'
import { BankrunProvider } from 'anchor-bankrun'
import IDL from '../target/idl/vesting.json'
import { Vesting } from '../target/types/vesting'
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system'
import { BN, Program } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token'

describe('vesting smart contract tests', () => {
  let beneficiary: Keypair
  let context: ProgramTestContext
  let provider: BankrunProvider
  let program: Program<Vesting>
  let banksClient: BanksClient
  let employer: Keypair
  let mint: PublicKey
  let beneficiaryProvider: BankrunProvider
  let program2: Program<Vesting>
  let vestingAccountKey: PublicKey
  const companyName = 'TestCompany'
  let treasuryTokenAccount: PublicKey
  let employeeAccount: PublicKey
  beforeAll(async () => {
    beneficiary = new anchor.web3.Keypair()

    context = await startAnchor(
      '',
      [
        {
          name: 'vesting',
          programId: new PublicKey(IDL.address),
        },
      ],
      [
        {
          address: beneficiary.publicKey,
          info: {
            lamports: 1_000_000_000,
            data: Buffer.alloc(0),
            owner: SYSTEM_PROGRAM_ID,
            executable: false,
          },
        },
      ],
    )

    provider = new BankrunProvider(context)
    anchor.setProvider(provider)

    program = new Program<Vesting>(IDL as Vesting, provider)

    banksClient = context.banksClient

    employer = provider.wallet.payer

    // @ts-ignore
    mint = await createMint(banksClient, employer, employer.publicKey, null, 2)

    beneficiaryProvider = new BankrunProvider(context)
    beneficiaryProvider.wallet = new NodeWallet(beneficiary)

    program2 = new Program<Vesting>(IDL as Vesting, beneficiaryProvider)
    ;[vestingAccountKey] = PublicKey.findProgramAddressSync([Buffer.from(companyName)], program.programId)
    ;[treasuryTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury'), Buffer.from(companyName)],
      program.programId,
    )
    ;[employeeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('employee_vesting'), vestingAccountKey.toBuffer(), beneficiary.publicKey.toBuffer()],
      program.programId,
    )
  })

  it('should create a vesting account', async () => {
    const tx = await program.methods
      .createVestingAccount(companyName)
      .accounts({
        signer: employer.publicKey,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' })

    const vestingAccountData = await program.account.vestingAccount.fetch(vestingAccountKey, 'confirmed')

    console.log('Transaction signature for create vesting account', tx)
    console.log('Vesting account data:', vestingAccountData)
  })

  it('should fund treasury token account', async () => {
    const amount = 10_000 * 10 ** 9

    const mintTx = await mintTo(
      // @ts-expect-error - Type error in spl-token-bankrun dependency
      banksClient,
      employer,
      mint,
      treasuryTokenAccount,
      employer,
      amount,
    )
    console.log('Mint transaction signature:', mintTx)
  })

  it('should create employee vesting account', async () => {
    const tx2 = await program.methods
      .createEmployeeVestingAccount(new BN(0), new BN(1000), new BN(100), new BN(0))
      .accounts({
        beneficiary: beneficiary.publicKey,
        vestingAccount: vestingAccountKey,
      })
      .rpc({ commitment: 'confirmed', skipPreflight: true })

    console.log('Transaction signature for create employee vesting account', tx2)
    console.log('Employee account:', employeeAccount.toBase58())
  })

  it('should claim the employee vested tokens', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const currentClock = await banksClient.getClock()
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        1000n,
      ),
    )

    const tx3 = await program2.methods
      .claimTokens(companyName)
      .accounts({
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' })

    console.log('Transaction signature for claim tokens', tx3)
  })
})
