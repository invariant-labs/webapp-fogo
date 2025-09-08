import {
  all,
  call,
  put,
  SagaGenerator,
  select,
  spawn,
  takeLatest,
  takeLeading
} from 'typed-redux-saga'
import {
  airdropQuantities,
  airdropTokens,
  NetworkType,
  WRAPPED_FOGO_ADDRESS
} from '@store/consts/static'
import { Token as StoreToken } from '@store/consts/types'
import { BN } from '@coral-xyz/anchor'
import { actions as poolsActions } from '@store/reducers/pools'
import { actions as positionsActions } from '@store/reducers/positions'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { actions, ITokenAccount, Status } from '@store/reducers/solanaWallet'
import { tokens } from '@store/selectors/pools'
import { network } from '@store/selectors/solanaConnection'
import { accounts } from '@store/selectors/solanaWallet'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import {
  ParsedAccountData,
  PublicKey,
  sendAndConfirmRawTransaction,
  Signer,
  SystemProgram,
  Transaction,
  AccountInfo,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import { closeSnackbar } from 'notistack'
import { getConnection, handleRpcError } from './connection'
import { getTokenDetails } from './token'
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { disconnectWallet, getFogoWallet } from '@utils/web3/wallet'
import { WalletAdapter } from '@utils/web3/adapters/types'
import airdropAdmin from '@store/consts/airdropAdmin'
import { createLoaderKey, ensureError, getTokenMetadata, getTokenProgramId } from '@utils/utils'
import { PayloadAction } from '@reduxjs/toolkit'
import { getSession, isSessionActive } from '@store/hooks/session'

export function* getWallet(): SagaGenerator<WalletAdapter> {
  const wallet = yield* call(getFogoWallet)

  return wallet
}
export function* getBalance(pubKey: PublicKey): SagaGenerator<BN> {
  yield* put(actions.setIsFogoBalanceLoading(true))
  const connection = yield* call(getConnection)
  const balance = yield* call([connection, connection.getBalance], pubKey)

  yield* put(actions.setBalance(new BN(balance)))
  yield* put(actions.setIsFogoBalanceLoading(false))
}

export function* handleBalance(): Generator {
  const session = getSession()

  if (!session?.walletPublicKey) {
    return
  }

  yield* put(actions.setAddress(session?.walletPublicKey))
  yield* call(getBalance, session?.walletPublicKey)
  yield* call(fetchTokensAccounts)
  yield* call(fetchUnknownTokensAccounts)
}

interface IparsedTokenInfo {
  mint: string
  owner: string
  tokenAmount: {
    amount: string
    decimals: number
    uiAmount: number
  }
}
interface TokenAccountInfo {
  pubkey: PublicKey
  account: AccountInfo<ParsedAccountData>
}

export function* fetchTokensAccounts(): Generator {
  const connection = yield* call(getConnection)
  const session = getSession()
  if (!session) {
    return
  }

  yield* put(actions.setIsTokenBalanceLoading(true))

  const { splTokensAccounts, token2022TokensAccounts } = yield* all({
    splTokensAccounts: call(
      [connection, connection.getParsedTokenAccountsByOwner],
      session.walletPublicKey,
      {
        programId: TOKEN_PROGRAM_ID
      }
    ),
    token2022TokensAccounts: call(
      [connection, connection.getParsedTokenAccountsByOwner],
      session.walletPublicKey,
      {
        programId: TOKEN_2022_PROGRAM_ID
      }
    )
  })

  const mergedAccounts: TokenAccountInfo[] = [
    ...splTokensAccounts.value,
    ...token2022TokensAccounts.value
  ]

  const newAccounts: ITokenAccount[] = []
  for (const account of mergedAccounts) {
    const info: IparsedTokenInfo = account.account.data.parsed.info
    newAccounts.push({
      programId: new PublicKey(info.mint),
      balance: new BN(info.tokenAmount.amount),
      address: account.pubkey,
      decimals: info.tokenAmount.decimals
    })
  }

  yield* put(actions.setTokenAccounts(newAccounts))
  yield* put(actions.setIsTokenBalanceLoading(false))
}

export function* fetchUnknownTokensAccounts(): Generator {
  const connection = yield* call(getConnection)

  const session = getSession()
  if (!session) {
    return
  }

  yield put(actions.setIsUnknownBlanceLoading(true))

  const { splTokensAccounts, token2022TokensAccounts } = yield* all({
    splTokensAccounts: call(
      [connection, connection.getParsedTokenAccountsByOwner],
      session?.walletPublicKey,
      { programId: TOKEN_PROGRAM_ID }
    ),
    token2022TokensAccounts: call(
      [connection, connection.getParsedTokenAccountsByOwner],
      session?.walletPublicKey,
      { programId: TOKEN_2022_PROGRAM_ID }
    )
  })

  const mergedAccounts: TokenAccountInfo[] = [
    ...splTokensAccounts.value,
    ...token2022TokensAccounts.value
  ]

  const allTokens = yield* select(tokens)

  const unknownAccounts = mergedAccounts.filter(account => {
    const info: IparsedTokenInfo = account.account.data.parsed.info
    return !allTokens[info.mint]
  })

  const calls = unknownAccounts.map(account => {
    return call(function* () {
      const info: IparsedTokenInfo = account.account.data.parsed.info
      const programId = yield* call(getTokenProgramId, connection, new PublicKey(info.mint))
      const metadata = yield* call(
        getTokenMetadata,
        connection,
        info.mint,
        info.tokenAmount.decimals,
        programId
      )
      return { mint: info.mint, token: metadata }
    })
  })

  const results: Array<{ mint: string; token: StoreToken }> = yield* all(calls)

  const unknownTokens: Record<string, StoreToken> = {}
  for (const { mint, token } of results) {
    unknownTokens[mint] = token
  }

  yield put(poolsActions.addTokens(unknownTokens))
  yield put(actions.setIsUnknownBlanceLoading(false))
}

export function* handleAirdrop(): Generator {
  const session = getSession()
  if (!session) {
    yield put(
      snackbarsActions.add({
        message: 'Connect your wallet first',
        variant: 'warning',
        persist: false
      })
    )
    return
  }

  const loaderKey = createLoaderKey()

  const networkType = yield* select(network)

  try {
    if (networkType === NetworkType.Testnet) {
      // if (fogoBalance.lt(WFOGO_MIN_FAUCET_FEE_TEST)) {
      //   yield put(
      //     snackbarsActions.add({
      //       message: 'Do not have enough FOGO to claim faucet',
      //       variant: 'error',
      //       persist: false
      //     })
      //   )
      //   return
      // }

      yield* put(actions.showThankYouModal(true))
      yield put(
        snackbarsActions.add({
          message: 'Airdrop in progress...',
          variant: 'pending',
          persist: true,
          key: loaderKey
        })
      )

      // transfer sol
      yield* call(transferAirdropFOGO)
      yield* call(
        getCollateralTokenAirdrop,
        airdropTokens[networkType],
        airdropQuantities[networkType]
      )
    } else {
      yield put(
        snackbarsActions.add({
          message: 'You can claim faucet only on testnet!',
          variant: 'success',
          persist: false
        })
      )
    }

    closeSnackbar(loaderKey)
    yield put(snackbarsActions.remove(loaderKey))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    closeSnackbar(loaderKey)
    yield put(snackbarsActions.remove(loaderKey))

    yield put(
      snackbarsActions.add({
        message: 'Failed to get a faucet',
        variant: 'error',
        persist: false
      })
    )
  }
}
export function* getCollateralTokenAirdrop(
  collateralsAddresses: PublicKey[],
  collateralsQuantities: number[]
): Generator {
  const session = getSession()
  console.log(window)
  if (!session) throw new Error('No session provided')
  const instructions: TransactionInstruction[] = []
  yield* call(setEmptyAccounts, collateralsAddresses)
  const tokensAccounts = yield* select(accounts)
  for (const [index, collateral] of collateralsAddresses.entries()) {
    instructions.push(
      createMintToInstruction(
        collateral,
        tokensAccounts[collateral.toString()].address,
        airdropAdmin.publicKey,
        collateralsQuantities[index],
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }
  const connection = yield* call(getConnection)
  const { blockhash } = yield* call([connection, connection.getLatestBlockhash])
  const messageV0 = new TransactionMessage({
    payerKey: session.payer,
    recentBlockhash: blockhash,
    instructions: instructions
  }).compileToV0Message([])
  const tx = new VersionedTransaction(messageV0)

  tx.sign([airdropAdmin as Signer])
  const { signature: txid } = yield* call([session, session.adapter.sendTransaction], undefined, tx)

  if (!txid.length) {
    yield put(
      snackbarsActions.add({
        message: 'Failed to airdrop testnet tokens. Please try again',
        variant: 'error',
        persist: false,
        txid
      })
    )
  } else {
    yield put(
      snackbarsActions.add({
        message: 'You will soon receive airdrop of tokens',
        variant: 'success',
        persist: false
      })
    )
  }
}
export function* setEmptyAccounts(addresses: PublicKey[]): Generator {
  const tokensAccounts = yield* select(accounts)
  const acc: PublicKey[] = []
  for (const address of addresses) {
    const accountAddress = tokensAccounts[address.toString()]
      ? tokensAccounts[address.toString()].address
      : null
    if (accountAddress == null) {
      acc.push(address)
    }
  }
  if (acc.length !== 0) {
    yield* call(createMultipleAccounts, acc)
  }
}

export function* transferAirdropFOGO(): Generator {
  const session = getSession()
  if (!session) {
    return
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: airdropAdmin.publicKey,
      toPubkey: session.walletPublicKey,
      lamports: 10000000
    })
  )
  const connection = yield* call(getConnection)
  const { blockhash, lastValidBlockHeight } = yield* call([
    connection,
    connection.getLatestBlockhash
  ])
  tx.feePayer = airdropAdmin.publicKey
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.sign(airdropAdmin as Signer)

  const txid = yield* call(sendAndConfirmRawTransaction, connection, tx.serialize(), {
    skipPreflight: false
  })

  if (!txid.length) {
    yield put(
      snackbarsActions.add({
        message: 'Failed to airdrop testnet FOGO. Please try again',
        variant: 'error',
        persist: false,
        txid
      })
    )
  } else {
    yield put(
      snackbarsActions.add({
        message: 'Testnet FOGO airdrop successfully',
        variant: 'success',
        persist: false,
        txid
      })
    )
  }
}

export function* getTokenAirdrop(addresses: PublicKey[], quantities: number[]): Generator {
  const wallet = yield* call(getWallet)
  const instructions: TransactionInstruction[] = []
  yield* call(setEmptyAccounts, addresses)
  const tokensAccounts = yield* select(accounts)
  for (const [index, address] of addresses.entries()) {
    instructions.push(
      createMintToInstruction(
        address,
        tokensAccounts[address.toString()].address,
        airdropAdmin.publicKey,
        quantities[index],
        [],
        TOKEN_PROGRAM_ID
      )
    )
  }
  const tx = instructions.reduce((tx, ix) => tx.add(ix), new Transaction())
  const connection = yield* call(getConnection)
  const { blockhash, lastValidBlockHeight } = yield* call([
    connection,
    connection.getLatestBlockhash
  ])
  tx.feePayer = wallet.publicKey
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.partialSign(airdropAdmin)

  const signedTx = (yield* call([wallet, wallet.signTransaction], tx)) as Transaction

  yield* call([connection, connection.sendRawTransaction], signedTx.serialize(), {
    skipPreflight: true
  })
}

export function* signAndSend(wallet: WalletAdapter, tx: Transaction): SagaGenerator<string> {
  const connection = yield* call(getConnection)
  const { blockhash, lastValidBlockHeight } = yield* call([
    connection,
    connection.getLatestBlockhash
  ])
  tx.feePayer = wallet.publicKey
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  const signedTx = (yield* call([wallet, wallet.signTransaction], tx)) as Transaction
  const signature = yield* call([connection, connection.sendRawTransaction], signedTx.serialize())
  return signature
}

export function* createAccount(tokenAddress: PublicKey): SagaGenerator<PublicKey> {
  const wallet = yield* call(getWallet)
  const session = getSession()
  if (!session) throw Error('No session provided')

  const associatedAccount = yield* call(
    getAssociatedTokenAddress,
    tokenAddress,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const ix = createAssociatedTokenAccountInstruction(
    session.sessionPublicKey,
    associatedAccount,
    wallet.publicKey,
    tokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  yield* call([session, session.sendTransaction], [ix])

  const token = yield* call(getTokenDetails, tokenAddress.toString())
  yield* put(
    actions.addTokenAccount({
      programId: tokenAddress,
      balance: new BN(0),
      address: associatedAccount,
      decimals: token.decimals
    })
  )
  const allTokens = yield* select(tokens)
  if (!allTokens[tokenAddress.toString()]) {
    yield* put(
      poolsActions.addTokens({
        [tokenAddress.toString()]: {
          name: tokenAddress.toString(),
          symbol: `${tokenAddress.toString().slice(0, 4)}...${tokenAddress.toString().slice(-4)}`,
          decimals: token.decimals,
          address: tokenAddress,
          logoURI: '/unknownToken.svg',
          isUnknown: true
        }
      })
    )
  }
  yield* call(sleep, 1000) // Give time to subscribe to new token
  return associatedAccount
}

export function* createMultipleAccounts(tokenAddress: PublicKey[]): SagaGenerator<PublicKey[]> {
  const session = getSession()
  if (!session) throw Error('No session provided')
  const connection = yield* call(getConnection)
  const ixs: TransactionInstruction[] = []
  const associatedAccs: PublicKey[] = []

  for (const address of tokenAddress) {
    const programId = yield* call(getTokenProgramId, connection, address)
    const associatedAccount = yield* call(
      getAssociatedTokenAddress,
      address,
      session.walletPublicKey,
      false,
      programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    associatedAccs.push(associatedAccount)
    const ix = createAssociatedTokenAccountInstruction(
      session.payer,
      associatedAccount,
      session.walletPublicKey,
      address,
      programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    ixs.push(ix)
  }
  yield* call([session, session.sendTransaction], ixs)

  const allTokens = yield* select(tokens)
  const unknownTokens: Record<string, StoreToken> = {}
  for (const [index, address] of tokenAddress.entries()) {
    const token = yield* call(getTokenDetails, tokenAddress[index].toString())
    yield* put(
      actions.addTokenAccount({
        programId: address,
        balance: new BN(0),
        address: associatedAccs[index],
        decimals: token.decimals
      })
    )
    // Give time to subscribe to new token
    yield* call(sleep, 1000)

    if (!allTokens[tokenAddress[index].toString()]) {
      unknownTokens[tokenAddress[index].toString()] = {
        name: tokenAddress[index].toString(),
        symbol: `${tokenAddress[index].toString().slice(0, 4)}...${tokenAddress[index]
          .toString()
          .slice(-4)}`,
        decimals: token.decimals,
        address: tokenAddress[index],
        logoURI: '/unknownToken.svg',
        isUnknown: true
      }
    }
  }

  yield* put(poolsActions.addTokens(unknownTokens))

  return associatedAccs
}

export function* init(): Generator {
  const sessionActive = isSessionActive()

  try {
    if (sessionActive) {
      yield* put(actions.setStatus(Status.Init))

      yield* put(
        snackbarsActions.add({
          message: 'Wallet connected',
          variant: 'success',
          persist: false
        })
      )
    } else {
      yield* put(actions.setStatus(Status.Uninitialized))
      return
    }

    yield* put(actions.setStatus(Status.Initialized))
    yield* call(handleBalance)
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)
  }
}

export const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
export function* sendSol(amount: BN, recipient: PublicKey): SagaGenerator<string> {
  const wallet = yield* call(getWallet)
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient,
      lamports: amount.toNumber()
    })
  )

  const txid = yield* call(signAndSend, wallet, transaction)
  return txid
}

export function* handleConnect(action: PayloadAction<boolean>): Generator {
  try {
    yield* call(init, action.payload)
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* call(handleRpcError, error.message)
  }
}

export function* handleChangeWalletInExtenstion(): Generator {
  try {
    yield* call(init, false)
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* call(handleRpcError, error.message)
  }
}

export function* handleDisconnect(): Generator {
  try {
    yield* call(disconnectWallet)
    yield* put(actions.resetState())
    yield* put(positionsActions.setPositionsList([[], { head: 0, bump: 0 }, false]))
    yield* put(positionsActions.setLockedPositionsList([]))

    // yield* put(bondsActions.setUserVested({}))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* call(handleRpcError, error.message)
  }
}

export function* handleUnwrapWFOGO(): Generator {
  const wallet = yield* call(getWallet)
  const connection = yield* call(getConnection)
  const allAccounts = yield* select(accounts)

  const loaderUnwrapWFOGO = createLoaderKey()

  const wrappedFogoAccountPublicKeys: PublicKey[] = []
  Object.entries(allAccounts).map(([address, token]) => {
    if (
      address === WRAPPED_FOGO_ADDRESS &&
      token.balance.gt(new BN(0) && wrappedFogoAccountPublicKeys.length < 10)
    ) {
      wrappedFogoAccountPublicKeys.push(token.address)
    }
  })

  if (!wrappedFogoAccountPublicKeys) {
    return
  }

  try {
    yield put(
      snackbarsActions.add({
        message: 'Unwraping Wrapped FOGO...',
        variant: 'pending',
        persist: true,
        key: loaderUnwrapWFOGO
      })
    )

    const unwrapTx = new Transaction()

    wrappedFogoAccountPublicKeys.forEach(wrappedFogoAccountPublicKey => {
      const unwrapIx = createCloseAccountInstruction(
        wrappedFogoAccountPublicKey,
        wallet.publicKey,
        wallet.publicKey,
        [],
        TOKEN_PROGRAM_ID
      )

      unwrapTx.add(unwrapIx)
    })

    const { blockhash, lastValidBlockHeight } = yield* call([
      connection,
      connection.getLatestBlockhash
    ])
    unwrapTx.recentBlockhash = blockhash
    unwrapTx.lastValidBlockHeight = lastValidBlockHeight
    unwrapTx.feePayer = wallet.publicKey

    const unwrapSignedTx = (yield* call([wallet, wallet.signTransaction], unwrapTx)) as Transaction

    const unwrapTxid = yield* call(
      sendAndConfirmRawTransaction,
      connection,
      unwrapSignedTx.serialize(),
      {
        skipPreflight: false
      }
    )

    if (!unwrapTxid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Wrapped FOGO unwrap failed. Try to unwrap it in your wallet',
          variant: 'warning',
          persist: false,
          txid: unwrapTxid
        })
      )
    } else {
      yield put(
        snackbarsActions.add({
          message: 'FOGO unwrapped successfully',
          variant: 'success',
          persist: false,
          txid: unwrapTxid
        })
      )
    }

    yield* put(actions.getBalance())
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* call(handleRpcError, error.message)
  }

  closeSnackbar(loaderUnwrapWFOGO)
  yield put(snackbarsActions.remove(loaderUnwrapWFOGO))
}

export function* changeWalletInExtenstionHandler(): Generator {
  yield takeLatest(actions.changeWalletInExtension, handleChangeWalletInExtenstion)
}
export function* connectHandler(): Generator {
  yield takeLatest(actions.connect, handleConnect)
}

export function* disconnectHandler(): Generator {
  yield takeLatest(actions.disconnect, handleDisconnect)
}

export function* airdropSaga(): Generator {
  yield takeLeading(actions.airdrop, handleAirdrop)
}

export function* handleBalanceSaga(): Generator {
  yield takeLeading(actions.getBalance, handleBalance)
}

export function* unwrapWFOGOHandler(): Generator {
  yield takeLeading(actions.unwrapWFOGO, handleUnwrapWFOGO)
}

export function* walletSaga(): Generator {
  yield all(
    [
      airdropSaga,
      connectHandler,
      disconnectHandler,
      handleBalanceSaga,
      unwrapWFOGOHandler,
      changeWalletInExtenstionHandler
    ].map(spawn)
  )
}
