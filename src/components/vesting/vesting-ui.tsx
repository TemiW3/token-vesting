'use client'

import { Keypair, PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useVestingProgram, useVestingProgramAccount } from './vesting-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useWallet } from '@solana/wallet-adapter-react'

export function CounterCreate() {
  const { createVestingAccount } = useVestingProgram()
  const [companyName, setCompanyName] = useState('')
  const [mint, setMint] = useState('')
  const { publicKey } = useWallet()

  return (
    <div>
      <input
        type="text"
        placeholder="Company Name"
        className="input input-bordered w-full mb-2"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />
      <Button onClick={() => initialize.mutateAsync(Keypair.generate())} disabled={initialize.isPending}>
        Create {initialize.isPending && '...'}
      </Button>
    </div>
  )
}

export function CounterList() {
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
            <CounterCard key={account.publicKey.toString()} account={account.publicKey} />
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

function CounterCard({ account }: { account: PublicKey }) {
  const { accountQuery, incrementMutation, setMutation, decrementMutation, closeMutation } = useVestingProgramAccount({
    account,
  })

  const count = useMemo(() => accountQuery.data?.count ?? 0, [accountQuery.data?.count])

  return accountQuery.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>Counter: {count}</CardTitle>
        <CardDescription>
          Account: <ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => incrementMutation.mutateAsync()}
            disabled={incrementMutation.isPending}
          >
            Increment
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const value = window.prompt('Set value to:', count.toString() ?? '0')
              if (!value || parseInt(value) === count || isNaN(parseInt(value))) {
                return
              }
              return setMutation.mutateAsync(parseInt(value))
            }}
            disabled={setMutation.isPending}
          >
            Set
          </Button>
          <Button
            variant="outline"
            onClick={() => decrementMutation.mutateAsync()}
            disabled={decrementMutation.isPending}
          >
            Decrement
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!window.confirm('Are you sure you want to close this account?')) {
                return
              }
              return closeMutation.mutateAsync()
            }}
            disabled={closeMutation.isPending}
          >
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
