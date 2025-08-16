# Token Vesting (Solana + Anchor + Next.js)

A full-stack token vesting dApp for Solana:

- Next.js 15 + React 19 + Tailwind CSS 4 for the frontend
- Wallet Adapter + Explorer links + cluster switcher (devnet/testnet/local)
- Anchor 0.30 program implementing linear vesting with a cliff and PDA-backed treasury
- Jest + solana-bankrun tests for fast, deterministic program testing


## Tech Stack

- Frontend: Next.js, React, Tailwind CSS, TanStack Query, Jotai, lucide-react, sonner
- Solana: Anchor, @solana/web3.js, @solana/wallet-adapter, @solana/spl-token
- Tests: Jest, solana-bankrun, spl-token-bankrun, anchor-bankrun
- TypeScript throughout with path aliases via `tsconfig.json`


## Repository Structure

```
anchor/                # Anchor workspace
  programs/vesting/    # On-chain program (Rust)
  tests/               # Jest + bankrun tests
  target/              # IDL, types, and build artifacts (generated)
  Anchor.toml          # Anchor configuration

src/                   # Next.js app
  app/                 # App Router pages
  components/          # UI + data-access hooks
    vesting/           # Vesting UI + client hooks

package.json           # Scripts for web + anchor
tsconfig.json          # Path aliases: @project/anchor and @/*
```


## Prerequisites

- Node.js 20+ and npm
- Rust toolchain (stable)
- Solana CLI 1.18+ (`solana --version`)
- Anchor CLI 0.30+ (install per Anchor docs)
- A Solana wallet (e.g., Phantom) installed in your browser for the frontend


## Installation

```bash
npm install
```


## Quickstart (Local Development)

1) Build the Anchor program

```bash
npm run anchor-build
```

2) Start a local validator and deploy the program (terminal A)

```bash
npm run anchor-localnet
```

3) Start the web app (terminal B)

```bash
npm run dev
```

4) Open the app at http://localhost:3000 and switch the cluster to `local` (header cluster selector).

5) Connect your wallet. The UI for vesting is at `/vesting`.


## Deploy to Devnet

- Airdrop SOL to your deployer: `solana airdrop 2 -u devnet`
- Deploy:

```bash
npm run anchor -- deploy --provider.cluster devnet
```

The frontend derives the program ID from the IDL (`anchor/target/idl/vesting.json`). If you rotate keys or deploy a new program ID, run:

```bash
npm run anchor -- keys sync
npm run anchor-build
```

This updates the on-chain `declare_id!`, Anchor config, and IDL address used by the frontend helpers.


## Using the App

- Create a Vesting Account: Provide a `Company Name` and a token `Mint Address`. This initializes a company vesting account and a PDA treasury Token Account that will hold tokens to be vested.
- Create Employee Vesting: For any vesting account, provide `startTime`, `endTime`, `cliffTime` (all Unix seconds), `amount` (in base units, see Token Decimals), and `beneficiary` (wallet address).
- Claiming: The `claim_tokens` instruction lets the beneficiary claim any vested amount after the cliff. The example tests demonstrate claims; you can wire a claim button in the UI using the same instruction if needed.

Tip: get the current Unix time with `date +%s`.


## Token Decimals and Amounts

- All token amounts are in base units. For example, if your mint has 9 decimals and you want to vest 1.5 tokens, set `amount = 1.5 * 10^9 = 1500000000`.
- The program reads `mint.decimals` during transfer and uses `transfer_checked` for safety.


## Program Overview (Anchor)

Program ID is derived from the IDL and can be viewed in the UI header on `/vesting`. The core logic lives in `anchor/programs/vesting/src/lib.rs`.

### Instructions

- `create_vesting_account(company_name: String)`
  - Seeds: `vesting_account` PDA at `[company_name]`
  - Also initializes `treasury_account` PDA token account at `["treasury", company_name]` with authority set to itself (PDA)
  - Stores `owner` (signer), `mint`, `treasury_account`, `company_name`, bumps

- `create_employee_vesting_account(start_time: i64, end_time: i64, amount: u64, cliff_time: i64)`
  - Only `vesting_account.owner` (the employer) can create
  - Creates `employee_vesting_account` PDA at `["employee_vesting", vesting_account.key(), beneficiary]`
  - Persists `beneficiary`, schedule times, total allocation `amount`, and `total_claimed = 0`

- `claim_tokens(company_name: String)`
  - Called by the `beneficiary`
  - Enforces cliff; computes linear vesting between `start_time` and `end_time`, then transfers the claimable difference using CPI `transfer_checked`
  - Signs with treasury PDA seeds `["treasury", company_name, [treatury_bump]]`

### Accounts

- `VestingAccount`:
  - `owner: Pubkey` (employer)
  - `mint: Pubkey`
  - `treasury_account: Pubkey` (PDA token account)
  - `company_name: String` (<= 64 chars)
  - `treatury_bump: u8` (typo in field name is intentional in code)
  - `bump: u8`

- `EmployeeVestingAccount`:
  - `beneficiary: Pubkey`
  - `start_time: i64`, `end_time: i64`, `cliff_time: i64` (Unix seconds)
  - `vesting_account: Pubkey`
  - `amount: u64` (total allocation, base units)
  - `total_claimed: u64`
  - `bump: u8`

### Errors

- `CliffNotReached`
- `InvalidVestingPeriod` (end_time must be >= start_time)
- `CalcOverflow` (defensive checked math)
- `NothingToClaim`


## PDA Addresses (Derivation)

```ts
import { PublicKey } from '@solana/web3.js'

// Program ID from IDL or via getVestingProgramId(cluster)
const programId = new PublicKey('...')

const companyName = 'MyCompany'
const [vestingAccount] = PublicKey.findProgramAddressSync([
  Buffer.from(companyName),
], programId)

const [treasuryTokenAccount] = PublicKey.findProgramAddressSync([
  Buffer.from('treasury'),
  Buffer.from(companyName),
], programId)

const beneficiary = new PublicKey('...')
const [employeeVestingAccount] = PublicKey.findProgramAddressSync([
  Buffer.from('employee_vesting'),
  vestingAccount.toBuffer(),
  beneficiary.toBuffer(),
], programId)
```


## Frontend Integration

Path alias `@project/anchor` maps to `anchor/src` and exposes:

- `getVestingProgram(provider, address?) => Program<Vesting>`
- `getVestingProgramId(cluster) => PublicKey`
- `VESTING_PROGRAM_ID` derived from the IDL

Hooks (see `src/components/vesting/`):

- `useVestingProgram()`
  - `accounts`: fetch all vesting accounts
  - `getProgramAccount`: verify program account existence
  - `createVestingAccount.mutateAsync({ companyName, mint })`

- `useVestingProgramAccount({ account })`
  - `accountQuery`: fetch a specific vesting account
  - `createEmployeeVestingAccount.mutateAsync({ startTime, endTime, cliffTime, amount, beneficiary })`

Cluster selection and explorer links are provided via `ClusterProvider` (`devnet`, `testnet`, `local`) and `ExplorerLink`.


## Funding the Treasury Token Account

After creating a vesting account you must fund its PDA `treasury_account` with the mint you selected. Using the SPL CLI:

```bash
# Example: mint 100 tokens (with 2 decimals this is 100 * 10^2 = 10000)
spl-token mint <MINT_ADDRESS> <RAW_AMOUNT> <TREASURY_PDA_TOKEN_ACCOUNT>
```

If you need to compute the `TREASURY_PDA_TOKEN_ACCOUNT`, see the PDA derivation snippet above.


## Testing (Bankrun)

Fast, deterministic tests run entirely in-process with bankrun:

```bash
npm run anchor-test
```

`anchor/tests/bankrun.spec.ts` covers:
- Creating a vesting account
- Minting and funding the treasury token account
- Creating an employee vesting account
- Advancing the clock and claiming vested tokens


## Scripts

- `npm run dev` – Start Next.js dev server
- `npm run build` – Build the web app
- `npm run start` – Start the production server
- `npm run lint` – Lint
- `npm run format` / `npm run format:check` – Prettier
- `npm run anchor` – Run any Anchor CLI command inside `anchor/`
- `npm run anchor-build` – `anchor build`
- `npm run anchor-localnet` – `anchor localnet` (validator + deploy)
- `npm run anchor-test` – Run Jest + bankrun tests


## Troubleshooting

- UI says “Program account not found”
  - Ensure you deployed to the selected cluster
  - Rebuild the program so the IDL (and its address) is up-to-date: `npm run anchor-build`
  - If keys were rotated: `npm run anchor -- keys sync && npm run anchor-build`

- Claims revert with `CliffNotReached` or `NothingToClaim`
  - Verify schedule times and current clock; on devnet/local, ensure enough time has passed

- Wrong amounts
  - Use base units. Multiply human-readable tokens by `10^decimals`

- Devnet RPC connectivity
  - Use the cluster selector or configure a custom RPC endpoint in the cluster UI


## Security

This code is for educational purposes and has not been audited. Use at your own risk. Review and adapt to your production security requirements (authority management, pausing, revocation, program upgrade strategy, comprehensive tests, etc.).
