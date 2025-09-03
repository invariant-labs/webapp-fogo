import { all, call, put, select, spawn, takeEvery, takeLatest } from 'typed-redux-saga'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { actions as swapActions } from '@store/reducers/swap'
import { swap } from '@store/selectors/swap'
import { poolsArraySortedByFees, tickMaps, tokens } from '@store/selectors/pools'
import { accounts } from '@store/selectors/solanaWallet'
import { createAccount, getWallet } from './wallet'
import { IWallet, Pair, routingEssentials } from '@invariant-labs/sdk-fogo'
import { getConnection, handleRpcError } from './connection'
import {
  ComputeBudgetProgram,
  PublicKey,
  SendTransactionError,
  TransactionExpiredTimeoutError,
  VersionedTransaction
} from '@solana/web3.js'
import {
  APPROVAL_DENIED_MESSAGE,
  COMMON_ERROR_MESSAGE,
  ErrorCodeExtractionKeys,
  MAX_CROSSES_IN_SINGLE_TX,
  SIGNING_SNACKBAR_CONFIG,
  TIMEOUT_ERROR_MESSAGE,
  WRAPPED_FOGO_ADDRESS
} from '@store/consts/static'
import { network, rpcAddress } from '@store/selectors/solanaConnection'
import { actions as connectionActions } from '@store/reducers/solanaConnection'
import { closeSnackbar } from 'notistack'
import {
  createLoaderKey,
  ensureApprovalDenied,
  ensureError,
  extractErrorCode,
  extractRuntimeErrorCode,
  formatNumberWithoutSuffix,
  getAmountFromSwapInstruction,
  mapErrorCodeToMessage,
  printBN,
  SwapTokenType
} from '@utils/utils'
import { getMarketProgram } from '@utils/web3/programs/amm'
import { actions as RPCAction, RpcStatus } from '@store/reducers/solanaConnection'
import { PayloadAction } from '@reduxjs/toolkit'
import {
  TICK_CROSSES_PER_IX,
  TwoHopSwap,
  TwoHopSwapCache
} from '@invariant-labs/sdk-fogo/lib/market'
import { PoolWithAddress } from '@store/reducers/pools'
import { getSession } from '@store/hooks/session'

export function* handleTwoHopSwap(): Generator {
  const loaderSwappingTokens = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  const tickmaps = yield* select(tickMaps)

  try {
    const allTokens = yield* select(tokens)
    const allPools = yield* select(poolsArraySortedByFees)
    const {
      slippage,
      tokenFrom,
      tokenTo,
      amountIn,
      firstPair,
      secondPair,
      tokenBetween,
      byAmountIn,
      amountOut
    } = yield* select(swap)

    // Should never be triggered
    if (!tokenBetween || !firstPair || !secondPair) {
      return
    }

    const wallet = yield* call(getWallet)
    const tokensAccounts = yield* select(accounts)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, wallet as IWallet)
    let firstPool = allPools.find(
      pool =>
        (tokenFrom.equals(pool.tokenX) &&
          tokenBetween.equals(pool.tokenY) &&
          firstPair.feeTier.fee.eq(pool.fee)) ||
        (tokenFrom.equals(pool.tokenY) &&
          tokenBetween.equals(pool.tokenX) &&
          firstPair.feeTier.fee.eq(pool.fee))
    )

    let secondPool = allPools.find(
      pool =>
        (tokenBetween.equals(pool.tokenX) &&
          tokenTo.equals(pool.tokenY) &&
          secondPair.feeTier.fee.eq(pool.fee)) ||
        (tokenBetween.equals(pool.tokenY) &&
          tokenTo.equals(pool.tokenX) &&
          secondPair.feeTier.fee.eq(pool.fee))
    )

    if (!firstPool) {
      const address = firstPair.getAddress(marketProgram.program.programId)
      const fetched = yield* call([marketProgram, marketProgram.getPool], firstPair)
      firstPool = { ...fetched, address } as PoolWithAddress
    }

    if (!secondPool) {
      const address = secondPair.getAddress(marketProgram.program.programId)
      const fetched = yield* call([marketProgram, marketProgram.getPool], secondPair)
      secondPool = { ...fetched, address } as PoolWithAddress
    }

    yield put(
      snackbarsActions.add({
        message: 'Swapping tokens...',
        variant: 'pending',
        persist: true,
        key: loaderSwappingTokens
      })
    )

    const firstXtoY = tokenFrom.equals(firstPool.tokenX)
    const secondXtoY = tokenBetween.equals(secondPool.tokenX)

    let fromAddress = tokensAccounts[tokenFrom.toString()]
      ? tokensAccounts[tokenFrom.toString()].address
      : null
    if (fromAddress === null) {
      fromAddress = yield* call(createAccount, tokenFrom)
    }
    let toAddress = tokensAccounts[tokenTo.toString()]
      ? tokensAccounts[tokenTo.toString()].address
      : null
    if (toAddress === null) {
      toAddress = yield* call(createAccount, tokenTo)
    }

    const params: TwoHopSwap = {
      swapHopOne: {
        pair: firstPair,
        xToY: firstXtoY
      },
      swapHopTwo: {
        pair: secondPair,
        xToY: secondXtoY
      },
      owner: wallet.publicKey,
      accountIn: fromAddress,
      accountOut: toAddress,
      amountIn,
      amountOut,
      slippage,
      byAmountIn
    }

    const cache: TwoHopSwapCache = {
      swapHopOne: {
        pool: firstPool,
        tickmap: tickmaps[firstPool.tickmap.toString()],
        tokenXProgram: allTokens[firstPool.tokenX.toString()].tokenProgram,
        tokenYProgram: allTokens[firstPool.tokenY.toString()].tokenProgram
      },
      swapHopTwo: {
        pool: secondPool,
        tickmap: tickmaps[secondPool.tickmap.toString()],
        tokenXProgram: allTokens[secondPool.tokenX.toString()].tokenProgram,
        tokenYProgram: allTokens[secondPool.tokenY.toString()].tokenProgram
      }
    }

    const prependendIxs = []
    const appendedIxs = []

    const swapTx = yield* call(
      [marketProgram, marketProgram.versionedTwoHopSwapTx],
      params,
      cache,
      // { tickCrosses: TICK_CROSSES_PER_IX },
      // { tickCrosses: TICK_CROSSES_PER_IX },
      undefined,
      undefined,
      prependendIxs,
      appendedIxs
    )

    const connection = yield* call(getConnection)

    yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    const signedTx = (yield* call([wallet, wallet.signTransaction], swapTx)) as VersionedTransaction

    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    const txid = yield* call([connection, connection.sendRawTransaction], signedTx.serialize(), {
      skipPreflight: false
    })

    yield* call([connection, connection.confirmTransaction], txid)

    yield put(swapActions.setSwapSuccess(!!txid.length))

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Tokens swapping failed. Please try again',
          variant: 'error',
          persist: false,
          txid
        })
      )
    } else {
      const txDetails = yield* call([connection, connection.getParsedTransaction], txid, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        if (txDetails.meta?.err) {
          if (txDetails.meta.logMessages) {
            const errorLog = txDetails.meta.logMessages.find(log =>
              log.includes(ErrorCodeExtractionKeys.ErrorNumber)
            )
            const errorCode = errorLog
              ?.split(ErrorCodeExtractionKeys.ErrorNumber)[1]
              .split(ErrorCodeExtractionKeys.Dot)[0]
              .trim()
            const message = mapErrorCodeToMessage(Number(errorCode))
            yield put(swapActions.setSwapSuccess(false))

            closeSnackbar(loaderSwappingTokens)
            yield put(snackbarsActions.remove(loaderSwappingTokens))
            closeSnackbar(loaderSigningTx)
            yield put(snackbarsActions.remove(loaderSigningTx))

            yield put(
              snackbarsActions.add({
                message,
                variant: 'error',
                persist: false
              })
            )
            return
          }
        }

        yield put(
          snackbarsActions.add({
            message: 'Tokens swapped successfully',
            variant: 'success',
            persist: false,
            txid
          })
        )

        const meta = txDetails.meta
        if (meta?.innerInstructions) {
          try {
            const tokenIn =
              allTokens[firstXtoY ? firstPool.tokenX.toString() : firstPool.tokenY.toString()]
            const tokenBetween =
              allTokens[secondXtoY ? secondPool.tokenX.toString() : secondPool.tokenY.toString()]
            const tokenOut =
              allTokens[secondXtoY ? secondPool.tokenY.toString() : secondPool.tokenX.toString()]

            const amountIn = getAmountFromSwapInstruction(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenIn.address.toString(),
              SwapTokenType.TokenIn
            )
            const amountBetween = getAmountFromSwapInstruction(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenBetween.address.toString(),
              SwapTokenType.TokenBetween
            )
            const amountOut = getAmountFromSwapInstruction(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenOut.address.toString(),
              SwapTokenType.TokenOut
            )

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'swap',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountIn, tokenIn.decimals)),
                  tokenBetweenAmount: formatNumberWithoutSuffix(
                    printBN(amountBetween, tokenBetween.decimals)
                  ),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountOut, tokenOut.decimals)),
                  tokenXIcon: tokenIn.logoURI,
                  tokenBetweenIcon: tokenBetween.logoURI,
                  tokenYIcon: tokenOut.logoURI,
                  tokenXSymbol: tokenIn.symbol ?? tokenIn.address.toString(),
                  tokenBetweenSymbol: tokenBetween.symbol ?? tokenBetween.address.toString(),
                  tokenYSymbol: tokenOut.symbol ?? tokenOut.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Sanity wrapper, should never be triggered
          }
        }
      } else {
        yield put(
          snackbarsActions.add({
            message: 'Tokens swapped successfully',
            variant: 'success',
            persist: false,
            txid
          })
        )
      }
    }

    closeSnackbar(loaderSwappingTokens)
    yield put(snackbarsActions.remove(loaderSwappingTokens))
  } catch (e: unknown) {
    const error = ensureError(e)
    let msg: string = ''
    if (error instanceof SendTransactionError) {
      const err = error.transactionError
      try {
        const errorCode = extractRuntimeErrorCode(err)
        msg = mapErrorCodeToMessage(errorCode)
      } catch {
        const errorCode = extractErrorCode(error)
        msg = mapErrorCodeToMessage(errorCode)
      }
    } else {
      try {
        const errorCode = extractErrorCode(error)
        msg = mapErrorCodeToMessage(errorCode)
      } catch (e: unknown) {
        const error = ensureError(e)
        msg = ensureApprovalDenied(error) ? APPROVAL_DENIED_MESSAGE : COMMON_ERROR_MESSAGE
      }
    }

    yield put(swapActions.setSwapSuccess(false))

    closeSnackbar(loaderSwappingTokens)
    yield put(snackbarsActions.remove(loaderSwappingTokens))
    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    if (error instanceof TransactionExpiredTimeoutError) {
      yield put(
        snackbarsActions.add({
          message: TIMEOUT_ERROR_MESSAGE,
          variant: 'info',
          persist: true,
          txid: error.signature
        })
      )
      yield put(connectionActions.setTimeoutError(true))
      yield put(RPCAction.setRpcStatus(RpcStatus.Error))
    } else {
      yield put(
        snackbarsActions.add({
          message: msg,
          variant: 'error',
          persist: false
        })
      )
    }

    yield* call(handleRpcError, error.message)
  }
}

export function* handleSwap(): Generator {
  const session = getSession()
  if (!session) throw Error('No session provided')

  const loaderSwappingTokens = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  const tickmaps = yield* select(tickMaps)

  try {
    const allTokens = yield* select(tokens)
    const allPools = yield* select(poolsArraySortedByFees)
    const {
      slippage,
      tokenFrom,
      tokenTo,
      amountIn,
      firstPair,
      estimatedPriceAfterSwap,
      tokenBetween,
      byAmountIn,
      amountOut
    } = yield* select(swap)

    if (tokenBetween) {
      return yield* call(handleTwoHopSwap)
    }

    // Should never be trigerred
    if (!firstPair) {
      return
    }

    const wallet = yield* call(getWallet)
    const tokensAccounts = yield* select(accounts)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, wallet as IWallet)
    const connection = yield* call(getConnection)

    const swapPool = allPools.find(
      pool =>
        (tokenFrom.equals(pool.tokenX) &&
          tokenTo.equals(pool.tokenY) &&
          firstPair?.feeTier.fee.eq(pool.fee)) ||
        (tokenFrom.equals(pool.tokenY) &&
          tokenTo.equals(pool.tokenX) &&
          firstPair?.feeTier.fee.eq(pool.fee))
    )

    if (!swapPool) {
      return
    }

    yield put(
      snackbarsActions.add({
        message: 'Swapping tokens...',
        variant: 'pending',
        persist: true,
        key: loaderSwappingTokens
      })
    )

    const isXtoY = tokenFrom.equals(swapPool.tokenX)

    let fromAddress = tokensAccounts[tokenFrom.toString()]
      ? tokensAccounts[tokenFrom.toString()].address
      : null
    if (fromAddress === null) {
      fromAddress = yield* call(createAccount, tokenFrom)
    }
    let toAddress = tokensAccounts[tokenTo.toString()]
      ? tokensAccounts[tokenTo.toString()].address
      : null
    if (toAddress === null) {
      toAddress = yield* call(createAccount, tokenTo)
    }

    const swapPair = new Pair(tokenFrom, tokenTo, {
      fee: swapPool.fee,
      tickSpacing: swapPool.tickSpacing
    })

    let txid

    const setCuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })
    const swapIx = yield* call(
      [marketProgram, marketProgram.swapIx],
      session,
      {
        pair: swapPair,
        xToY: isXtoY,
        amount: byAmountIn ? amountIn : amountOut,
        estimatedPriceAfterSwap,
        slippage: slippage,
        accountX: isXtoY ? fromAddress : toAddress,
        accountY: isXtoY ? toAddress : fromAddress,
        byAmountIn: byAmountIn
      },
      {
        pool: swapPool,
        tickmap: tickmaps[swapPool.tickmap.toString()],
        tokenXProgram: allTokens[swapPool.tokenX.toString()].tokenProgram,
        tokenYProgram: allTokens[swapPool.tokenY.toString()].tokenProgram
      },
      { tickCrosses: MAX_CROSSES_IN_SINGLE_TX }
    )

    txid = yield* call([session, session.sendTransaction], [setCuIx, swapIx])

    yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    const txSig = txid.signature
    yield put(swapActions.setSwapSuccess(!!txSig))
    if (!txid.signature.length) {
      yield put(
        snackbarsActions.add({
          message: 'Tokens swapping failed. Please try again',
          variant: 'error',
          persist: false,
          txid: txSig
        })
      )
    } else {
      const txDetails = yield* call([connection, connection.getParsedTransaction], txSig, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        if (txDetails.meta?.err) {
          if (txDetails.meta.logMessages) {
            const errorLog = txDetails.meta.logMessages.find(log =>
              log.includes(ErrorCodeExtractionKeys.ErrorNumber)
            )
            const errorCode = errorLog
              ?.split(ErrorCodeExtractionKeys.ErrorNumber)[1]
              .split(ErrorCodeExtractionKeys.Dot)[0]
              .trim()
            const message = mapErrorCodeToMessage(Number(errorCode))
            yield put(swapActions.setSwapSuccess(false))

            closeSnackbar(loaderSwappingTokens)
            yield put(snackbarsActions.remove(loaderSwappingTokens))
            closeSnackbar(loaderSigningTx)
            yield put(snackbarsActions.remove(loaderSigningTx))

            yield put(
              snackbarsActions.add({
                message,
                variant: 'error',
                persist: false
              })
            )
            return
          }
        }

        yield put(
          snackbarsActions.add({
            message: 'Tokens swapped successfully',
            variant: 'success',
            persist: false,
            txid
          })
        )

        const meta = txDetails.meta
        if (meta?.innerInstructions) {
          try {
            const tokenIn =
              allTokens[isXtoY ? swapPool.tokenX.toString() : swapPool.tokenY.toString()]
            const tokenOut =
              allTokens[isXtoY ? swapPool.tokenY.toString() : swapPool.tokenX.toString()]

            const amountIn = getAmountFromSwapInstruction(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenIn.address.toString(),
              SwapTokenType.TokenIn
            )
            const amountOut = getAmountFromSwapInstruction(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenOut.address.toString(),
              SwapTokenType.TokenOut
            )

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'swap',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountIn, tokenIn.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountOut, tokenOut.decimals)),
                  tokenXIcon: tokenIn.logoURI,
                  tokenYIcon: tokenOut.logoURI,
                  tokenXSymbol: tokenIn.symbol ?? tokenIn.address.toString(),
                  tokenYSymbol: tokenOut.symbol ?? tokenOut.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Sanity wrapper, should never be triggered
          }
        }
      } else {
        yield put(
          snackbarsActions.add({
            message: 'Tokens swapped successfully',
            variant: 'success',
            persist: false,
            txid: txSig
          })
        )
      }
    }

    closeSnackbar(loaderSwappingTokens)
    yield put(snackbarsActions.remove(loaderSwappingTokens))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    let msg: string = ''
    if (error instanceof SendTransactionError) {
      const err = error.transactionError
      try {
        const errorCode = extractRuntimeErrorCode(err)
        msg = mapErrorCodeToMessage(errorCode)
      } catch {
        const errorCode = extractErrorCode(error)
        msg = mapErrorCodeToMessage(errorCode)
      }
    } else {
      try {
        const errorCode = extractErrorCode(error)
        msg = mapErrorCodeToMessage(errorCode)
      } catch (e: unknown) {
        const error = ensureError(e)
        msg = ensureApprovalDenied(error) ? APPROVAL_DENIED_MESSAGE : COMMON_ERROR_MESSAGE
      }
    }

    yield put(swapActions.setSwapSuccess(false))

    closeSnackbar(loaderSwappingTokens)
    yield put(snackbarsActions.remove(loaderSwappingTokens))
    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    if (error instanceof TransactionExpiredTimeoutError) {
      yield put(
        snackbarsActions.add({
          message: TIMEOUT_ERROR_MESSAGE,
          variant: 'info',
          persist: true,
          txid: error.signature
        })
      )
      yield put(connectionActions.setTimeoutError(true))
      yield put(RPCAction.setRpcStatus(RpcStatus.Error))
    } else {
      yield put(
        snackbarsActions.add({
          message: msg,
          variant: 'error',
          persist: false
        })
      )
    }

    yield* call(handleRpcError, error.message)
  }
}

export function* handleGetTwoHopSwapData(
  action: PayloadAction<{ tokenFrom: PublicKey; tokenTo: PublicKey }>
): Generator {
  const { tokenFrom, tokenTo } = action.payload

  const networkType = yield* select(network)
  const rpc = yield* select(rpcAddress)
  const wallet = yield* call(getWallet)
  const market = yield* call(getMarketProgram, networkType, rpc, wallet as IWallet)

  const { whitelistTickmaps, poolSet, routeCandidates } = routingEssentials(
    tokenFrom,
    tokenTo,
    market.program.programId,
    market.network
  )

  const accounts = yield* call([market, market.fetchAccounts], {
    pools: Array.from(poolSet).map(pool => new PublicKey(pool)),
    tickmaps: whitelistTickmaps
  })

  for (const pool of poolSet) {
    if (!accounts.pools[pool]) {
      poolSet.delete(pool)
    }
  }

  for (let i = routeCandidates.length - 1; i >= 0; i--) {
    const [pairIn, pairOut] = routeCandidates[i]

    if (
      !accounts.pools[pairIn.getAddress(market.program.programId).toBase58()] ||
      !accounts.pools[pairOut.getAddress(market.program.programId).toBase58()]
    ) {
      const lastCandidate = routeCandidates.pop()!
      if (i !== routeCandidates.length) {
        routeCandidates[i] = lastCandidate
      }
    }
  }

  const accountsTickmaps = yield* call([market, market.fetchAccounts], {
    tickmaps: Array.from(poolSet)
      .filter(pool => !accounts.tickmaps[pool])
      .map(pool => accounts.pools[pool].tickmap)
  })
  accounts.tickmaps = { ...accounts.tickmaps, ...accountsTickmaps.tickmaps }

  const crossLimit =
    tokenFrom.toString() === WRAPPED_FOGO_ADDRESS || tokenTo.toString() === WRAPPED_FOGO_ADDRESS
      ? MAX_CROSSES_IN_SINGLE_TX
      : TICK_CROSSES_PER_IX
  const accountsTicks = yield* call([market, market.fetchAccounts], {
    ticks: market.gatherTwoHopTickAddresses(poolSet, tokenFrom, tokenTo, accounts, crossLimit)
  })
  accounts.ticks = { ...accounts.ticks, ...accountsTicks.ticks }

  yield put(swapActions.setTwoHopSwapData({ accounts }))
}

export function* swapHandler(): Generator {
  yield* takeEvery(swapActions.swap, handleSwap)
}

export function* getTwoHopSwapDataHandler(): Generator {
  yield* takeLatest(swapActions.getTwoHopSwapData, handleGetTwoHopSwapData)
}

export function* swapSaga(): Generator {
  yield* all([swapHandler, getTwoHopSwapDataHandler].map(spawn))
}
