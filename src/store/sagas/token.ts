import { call, SagaGenerator } from 'typed-redux-saga'
import { getConnection } from './connection'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createMint, getMint, Mint, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { getTokenProgramId } from '@utils/utils'
import { getSession } from '@store/hooks/session'

export function* createToken(
  decimals: number,
  freezeAuthority?: string,
  mintAuthority?: string
): SagaGenerator<string> {
  const session = getSession()
  if (!session) throw Error('No session provided')

  const connection = yield* call(getConnection)
  const keypair = Keypair.generate()

  const token = yield* call(
    createMint,
    connection,
    keypair,
    mintAuthority ? new PublicKey(mintAuthority) : session.walletPublicKey,
    freezeAuthority ? new PublicKey(freezeAuthority) : null,
    decimals,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  )
  return token.toString()
}
export function* getTokenDetails(address: string): SagaGenerator<Mint> {
  const connection = yield* call(getConnection)
  const programId = yield* call(getTokenProgramId, connection, new PublicKey(address))
  const mint = yield* call(getMint, connection, new PublicKey(address), undefined, programId)
  return mint
}

export function* mintToken(tokenAddress: string, recipient: string, amount: number): Generator {
  const connection = yield* call(getConnection)
  const keypair = Keypair.generate()
  const programId = yield* call(getTokenProgramId, connection, new PublicKey(tokenAddress))

  // This should return txid in future
  yield* call(
    mintTo,
    connection,
    keypair,
    new PublicKey(tokenAddress),
    new PublicKey(recipient),
    keypair,
    amount,
    [],
    undefined,
    programId
  )
}
