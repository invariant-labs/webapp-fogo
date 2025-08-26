import { PublicKey, TransactionInstruction, VersionedTransaction } from '@solana/web3.js'
import type { TransactionResult } from '@fogo/sessions-sdk'
import { TransactionResultType } from '@fogo/sessions-sdk'

export type InstructionLike =
  | TransactionInstruction
  | {
      programId: PublicKey
      keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>
      data: Uint8Array | Buffer
    }

export type TransactionMessageBytes = Uint8Array
export type SignaturesMap = Readonly<Record<string, Uint8Array>>

export type SendTxInput =
  | InstructionLike[]
  | VersionedTransaction
  | Readonly<{ messageBytes: TransactionMessageBytes; signatures: SignaturesMap }>

export type SendTxFn = (input: SendTxInput) => Promise<TransactionResult>

export type EstablishedSession = {
  type: 'Established'
  walletPublicKey: PublicKey
  sessionPublicKey: PublicKey
  payer: PublicKey
  sendTransaction: SendTxFn
}

let current: EstablishedSession | null = null
export const setSession = (s: EstablishedSession | null) => {
  current = s
}
export const getSession = () => current
export const isSessionActive = () => current !== null

export { TransactionResultType }
