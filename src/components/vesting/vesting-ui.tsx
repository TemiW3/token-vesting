'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useVestingProgram, useVestingProgramAccount } from './vesting-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useWallet } from '@solana/wallet-adapter-react'

export function VestingCreate() {
  const { createVestingAccount } = useVestingProgram()
  const [companyName, setCompanyName] = useState('')
  const [mint, setMint] = useState('')
  const { publicKey } = useWallet()

  const isFormValid = companyName.length > 0 && mint.length > 0

  const handleSubmit = () => {
    if (publicKey && isFormValid) {
      createVestingAccount.mutateAsync({
        companyName: companyName,
        mint: mint,
      })
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="hero py-[64px]">
          <div className="hero-content text-center">
            <p className="text-lg">Please connect your wallet to create a vesting account.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Company Name"
        className="input input-bordered w-full mb-2"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Mint Address"
        className="input input-bordered w-full mb-2"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
      />
      <Button onClick={handleSubmit} disabled={!isFormValid || createVestingAccount.isPending} className="w-full">
        Create New vesting Account {createVestingAccount.isPending && '...'}
      </Button>
    </div>
  )
}

export function VestingList() {
  const { accounts, getProgramAccount } = useVestingProgram()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      {accounts.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : accounts.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts.data?.map((account) => (
            <VestingCard key={account.publicKey.toString()} account={account.publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No accounts</h2>
          No accounts found. Create one above to get started.
        </div>
      )}
    </div>
  )
}

function VestingCard({ account }: { account: PublicKey }) {
  const { accountQuery, createEmployeeVestingAccount } = useVestingProgramAccount({
    account,
  })

  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [cliffTime, setCliffTime] = useState(0)
  const [amount, setAmount] = useState(0)
  const [beneficiary, setBeneficiary] = useState('')

  const companyName = useMemo(
    () => accountQuery.data?.companyName ?? 'Unknown Company',
    [accountQuery.data?.companyName],
  )

  return accountQuery.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>Vesting Account: {companyName}</CardTitle>
        <CardDescription>
          Account: <ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Start Time (Unix Timestamp)"
            className="input input-bordered w-full mb-2"
            value={startTime || ''}
            onChange={(e) => setStartTime(parseInt(e.target.value))}
          />
          <input
            type="text"
            placeholder="End Time (Unix Timestamp)"
            className="input input-bordered w-full mb-2"
            value={endTime || ''}
            onChange={(e) => setEndTime(parseInt(e.target.value))}
          />
          <input
            type="text"
            placeholder="Total Allocation"
            className="input input-bordered w-full mb-2"
            value={amount || ''}
            onChange={(e) => setAmount(parseInt(e.target.value))}
          />
          <input
            type="text"
            placeholder="Cliff Time (Unix Timestamp)"
            className="input input-bordered w-full mb-2"
            value={cliffTime || ''}
            onChange={(e) => setCliffTime(parseInt(e.target.value))}
          />
          <input
            type="text"
            placeholder="Beneficiary Wallet address"
            className="input input-bordered w-full mb-2"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
          />

          <Button
            variant="outline"
            onClick={() =>
              createEmployeeVestingAccount.mutateAsync({
                startTime,
                endTime,
                cliffTime,
                amount,
                beneficiary,
              })
            }
            disabled={createEmployeeVestingAccount.isPending}
          >
            Create Employee Vesting Account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
