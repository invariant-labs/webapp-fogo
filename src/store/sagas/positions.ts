import { call, put, takeEvery, take, select, all, spawn, takeLatest } from 'typed-redux-saga'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { actions as poolsActions, ListPoolsResponse, ListType } from '@store/reducers/pools'
import { createAccount } from './wallet'
import { getConnection, handleRpcError } from './connection'
import {
  actions,
  ChangeLiquidityData,
  ClosePositionData,
  GetCurrentTicksData,
  InitPositionData,
  PositionWithAddress,
  SwapAndAddLiquidityData,
  SwapAndCreatePosition
} from '@store/reducers/positions'
import { PayloadAction } from '@reduxjs/toolkit'
import { poolsArraySortedByFees, tokens } from '@store/selectors/pools'
import { IWallet, Pair, sleep } from '@invariant-labs/sdk-fogo'
import { accounts } from '@store/selectors/solanaWallet'
import { actions as RPCAction, RpcStatus } from '@store/reducers/solanaConnection'
import {
  Transaction,
  Keypair,
  TransactionExpiredTimeoutError,
  PublicKey,
  ParsedInstruction,
  SendTransactionError,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import {
  COMMON_ERROR_MESSAGE,
  ErrorCodeExtractionKeys,
  SIGNING_SNACKBAR_CONFIG,
  TIMEOUT_ERROR_MESSAGE
} from '@store/consts/static'
import {
  plotTicks,
  lockedPositionsWithPoolsData,
  positionsList,
  positionsWithPoolsData
} from '@store/selectors/positions'
import { GuardPredicate } from '@redux-saga/types'
import { network, rpcAddress } from '@store/selectors/solanaConnection'
import { closeSnackbar } from 'notistack'
import { getLockerProgram, getMarketProgram } from '@utils/web3/programs/amm'
import {
  createLiquidityPlot,
  createLoaderKey,
  createPlaceholderLiquidityPlot,
  ensureError,
  extractErrorCode,
  extractRuntimeErrorCode,
  formatNumberWithoutSuffix,
  getAmountFromInitPositionInstruction,
  getLiquidityTicksByPositionsList,
  getPositionByIdAndPoolAddress,
  getPositionsAddressesFromRange,
  getTicksFromAddresses,
  TokenType,
  mapErrorCodeToMessage,
  printBN,
  getAmountFromClaimFeeInstruction,
  getAmountFromClosePositionInstruction,
  getTokenProgramId,
  getSwapAmountFromSwapAndAddLiquidity,
  getAddAmountFromSwapAndAddLiquidity,
  SwapTokenType
} from '@utils/utils'
import { actions as connectionActions } from '@store/reducers/solanaConnection'
import { ClaimAllFee } from '@invariant-labs/sdk-fogo/lib/market'
import { parseTick, Position } from '@invariant-labs/sdk-fogo/lib/market'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { unknownTokenIcon } from '@static/icons'
import { calculateClaimAmount } from '@invariant-labs/sdk-fogo/lib/utils'
import { getSession } from '@store/hooks/session'

export function* handleSwapAndInitPosition(
  action: PayloadAction<SwapAndCreatePosition>
): Generator {
  const session = getSession()
  if (!session) throw Error('No session provided')
  const loaderCreatePosition = createLoaderKey()
  const loaderSigningTx = createLoaderKey()

  try {
    const allTokens = yield* select(tokens)

    yield put(
      snackbarsActions.add({
        message: 'Creating position',
        variant: 'pending',
        persist: true,
        key: loaderCreatePosition
      })
    )

    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const userPositionList = yield* select(positionsList)
    const allPools = yield* select(poolsArraySortedByFees)
    const ticks = yield* select(plotTicks)
    const session = getSession()
    if (!session) throw Error('No session provided')
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)

    const swapPair = new Pair(action.payload.tokenX, action.payload.tokenY, {
      fee: action.payload.swapPool.fee,
      tickSpacing: action.payload.swapPool.tickSpacing
    })

    const tokensAccounts = yield* select(accounts)

    let userTokenX = tokensAccounts[action.payload.tokenX.toString()]
      ? tokensAccounts[action.payload.tokenX.toString()].address
      : null

    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, action.payload.tokenX)
    }

    let userTokenY = tokensAccounts[action.payload.tokenY.toString()]
      ? tokensAccounts[action.payload.tokenY.toString()].address
      : null

    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, action.payload.tokenY)
    }

    const swapAndCreateOnDifferentPools = action.payload.isSamePool
      ? undefined
      : {
          positionPair: new Pair(action.payload.tokenX, action.payload.tokenY, {
            fee: action.payload.positionPair.fee,
            tickSpacing: action.payload.positionPair.tickSpacing
          }),
          positionPoolPrice: action.payload.positionPoolPrice,
          positionSlippage: action.payload.positionSlippage
        }

    const upperTickExists =
      !ticks.hasError &&
      !ticks.loading &&
      ticks.rawTickIndexes.find(t => t === action.payload.upperTick) !== undefined
        ? true
        : undefined
    const lowerTickExists =
      !ticks.hasError &&
      !ticks.loading &&
      ticks.rawTickIndexes.find(t => t === action.payload.lowerTick) !== undefined
        ? true
        : undefined

    const tx = yield* call(
      [marketProgram, marketProgram.versionedSwapAndCreatePositionTx],
      session,
      {
        amountX: action.payload.xAmount,
        amountY: action.payload.yAmount,
        swapPair,
        userTokenX,
        userTokenY,
        lowerTick: action.payload.lowerTick,
        upperTick: action.payload.upperTick,
        owner: session.walletPublicKey,
        slippage: action.payload.swapSlippage,
        amount: action.payload.swapAmount,
        xToY: action.payload.xToY,
        byAmountIn: action.payload.byAmountIn,
        estimatedPriceAfterSwap: action.payload.estimatedPriceAfterSwap,
        minUtilizationPercentage: action.payload.minUtilizationPercentage,
        swapAndCreateOnDifferentPools,
        liquidityDelta: action.payload.liquidityDelta
      },
      { tickIndexes: action.payload.crossedTicks },
      {
        position: {
          lowerTickExists,
          upperTickExists,
          pool:
            action.payload.positionPoolIndex !== null
              ? allPools[action.payload.positionPoolIndex]
              : undefined,
          tokenXProgramAddress: allTokens[action.payload.tokenX.toString()].tokenProgram,
          tokenYProgramAddress: allTokens[action.payload.tokenY.toString()].tokenProgram,
          positionsList: !userPositionList.loading ? userPositionList : undefined
        },
        swap: {
          tickmap: action.payload.swapPoolTickmap,
          pool: action.payload.swapPool
        }
      },
      [],
      [],
      []
    )

    const xToY = action.payload.xToY

    const { signature: txid } = yield* call([session, session.sendTransaction], tx)
    // yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    // // const signedTx = (yield* call([wallet, wallet.signTransaction], tx)) as VersionedTransaction

    // closeSnackbar(loaderSigningTx)
    // yield put(snackbarsActions.remove(loaderSigningTx))

    // const txid = yield* call([connection, connection.sendTransaction], signedTx)

    // yield* call([connection, connection.confirmTransaction], txid)

    yield put(actions.setInitPositionSuccess(!!txid.length))

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Position adding failed. Please try again.',
          variant: 'error',
          persist: false,
          txid
        })
      )
    } else {
      yield put(
        snackbarsActions.add({
          message: 'Position added successfully.',
          variant: 'success',
          persist: false,
          txid
        })
      )

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
            yield put(actions.setInitPositionSuccess(false))

            closeSnackbar(loaderCreatePosition)
            yield put(snackbarsActions.remove(loaderCreatePosition))
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

        const meta = txDetails.meta
        const tokenX = xToY
          ? allTokens[swapPair.tokenX.toString()]
          : allTokens[swapPair.tokenY.toString()]
        const tokenY = xToY
          ? allTokens[swapPair.tokenY.toString()]
          : allTokens[swapPair.tokenX.toString()]

        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const targetInner = meta.innerInstructions[2] ?? meta.innerInstructions[0]
            targetInner.instructions.slice(1, 3)
            const tokenXDeposit = targetInner.instructions
              .slice(5)
              .find(
                (ix): ix is ParsedInstruction =>
                  (ix as ParsedInstruction).parsed?.info?.mint === tokenX.address.toString()
              )?.parsed?.info?.tokenAmount

            const tokenYDeposit = targetInner.instructions
              .slice(5)
              .find(
                (ix): ix is ParsedInstruction =>
                  (ix as ParsedInstruction).parsed?.info?.mint === tokenY.address.toString()
              )?.parsed?.info?.tokenAmount

            const tokenXExchange = targetInner.instructions
              .slice(1, 3)
              .find(
                (ix): ix is ParsedInstruction =>
                  (ix as ParsedInstruction).parsed.info?.mint === tokenX.address.toString()
              )?.parsed.info.tokenAmount.amount

            const tokenYExchange = targetInner.instructions
              .slice(1, 3)
              .find(
                (ix): ix is ParsedInstruction =>
                  (ix as ParsedInstruction).parsed.info?.mint === tokenY.address.toString()
              )?.parsed.info.tokenAmount.amount

            const amountX = tokenXDeposit?.amount
            const amountY = tokenYDeposit?.amount
            const tokenXDecimal = tokenXDeposit?.decimals
            const tokenYDecimal = tokenYDeposit?.decimals

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'deposit',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenXDecimal)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenYDecimal)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY.symbol ?? tokenY.address.toString(),
                  tokenXAmountAutoSwap: formatNumberWithoutSuffix(
                    printBN(tokenXExchange, tokenX.decimals)
                  ),
                  tokenYAmountAutoSwap: formatNumberWithoutSuffix(
                    printBN(tokenYExchange, tokenY.decimals)
                  ),
                  tokenXIconAutoSwap: tokenX.logoURI,
                  tokenYIconAutoSwap: tokenY.logoURI
                },

                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }

      yield put(actions.getPositionsList())
    }

    closeSnackbar(loaderCreatePosition)
    yield put(snackbarsActions.remove(loaderCreatePosition))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    yield put(actions.setInitPositionSuccess(false))

    closeSnackbar(loaderCreatePosition)
    yield put(snackbarsActions.remove(loaderCreatePosition))
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

    yield* call(handleRpcError, (error as Error).message)
  }
}
export function* handleInitPosition(action: PayloadAction<InitPositionData>): Generator {
  const loaderCreatePosition = createLoaderKey()
  const loaderSigningTx = createLoaderKey()

  try {
    const allTokens = yield* select(tokens)

    const session = getSession()

    if (!session) {
      throw Error('No session provided')
    }
    yield put(
      snackbarsActions.add({
        message: 'Creating position...',
        variant: 'pending',
        persist: true,
        key: loaderCreatePosition
      })
    )

    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)

    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)

    const allPools = yield* select(poolsArraySortedByFees)
    const ticks = yield* select(plotTicks)
    const pair = new Pair(action.payload.tokenX, action.payload.tokenY, {
      fee: action.payload.fee,
      tickSpacing: action.payload.tickSpacing
    })

    const userPositionList = yield* select(positionsList)

    const tokensAccounts = yield* select(accounts)

    let userTokenX = tokensAccounts[action.payload.tokenX.toString()]
      ? tokensAccounts[action.payload.tokenX.toString()].address
      : null

    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, action.payload.tokenX)
    }

    let userTokenY = tokensAccounts[action.payload.tokenY.toString()]
      ? tokensAccounts[action.payload.tokenY.toString()].address
      : null

    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, action.payload.tokenY)
    }

    let tx: Transaction
    let createPoolTx: Transaction | null = null
    let poolSigners: Keypair[] = []

    if (action.payload.initPool) {
      const txs = yield* call(
        [marketProgram, marketProgram.createPoolWithSqrtPriceAndPositionTx],
        session,
        {
          pair,
          userTokenX,
          userTokenY,
          lowerTick: action.payload.lowerTick,
          upperTick: action.payload.upperTick,
          liquidityDelta: action.payload.liquidityDelta,
          owner: session.walletPublicKey,
          slippage: action.payload.slippage,
          knownPrice: action.payload.knownPrice
        },
        undefined,
        {
          tokenXProgramAddress: allTokens[action.payload.tokenX.toString()].tokenProgram,
          tokenYProgramAddress: allTokens[action.payload.tokenY.toString()].tokenProgram,
          positionsList: !userPositionList.loading ? userPositionList : undefined
        }
      )
      tx = txs.createPositionTx
      createPoolTx = txs.createPoolTx
      poolSigners = txs.createPoolSigners
    } else {
      tx = yield* call(
        [marketProgram, marketProgram.createPositionTx],
        session,
        {
          pair,
          userTokenX,
          userTokenY,
          lowerTick: action.payload.lowerTick,
          upperTick: action.payload.upperTick,
          liquidityDelta: action.payload.liquidityDelta,
          owner: session.walletPublicKey,
          slippage: action.payload.slippage,
          knownPrice: action.payload.knownPrice
        },
        {
          lowerTickExists:
            !ticks.hasError &&
            !ticks.loading &&
            ticks.rawTickIndexes.find(t => t === action.payload.lowerTick) !== undefined
              ? true
              : undefined,
          upperTickExists:
            !ticks.hasError &&
            !ticks.loading &&
            ticks.rawTickIndexes.find(t => t === action.payload.upperTick) !== undefined
              ? true
              : undefined,
          pool: action.payload.poolIndex !== null ? allPools[action.payload.poolIndex] : undefined,
          tokenXProgramAddress: allTokens[action.payload.tokenX.toString()].tokenProgram,
          tokenYProgramAddress: allTokens[action.payload.tokenY.toString()].tokenProgram,
          positionsList: !userPositionList.loading ? userPositionList : undefined
        }
      )
    }

    if (createPoolTx) {
      const { blockhash, lastValidBlockHeight } = yield* call([
        connection,
        connection.getLatestBlockhash
      ])
      const messageV0 = new TransactionMessage({
        payerKey: session.payer,
        recentBlockhash: blockhash,
        instructions: createPoolTx.instructions
      }).compileToV0Message([])
      const txV = new VersionedTransaction(messageV0)
      txV.sign(poolSigners)
      const { signature: txidV } = yield* call(
        [session, session.adapter.sendTransaction],
        undefined,
        txV
      )
      yield* call([connection, connection.confirmTransaction], {
        blockhash,
        lastValidBlockHeight,
        signature: txidV
      })
    }

    yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    const txResult = yield* call([session, session.sendTransaction], tx.instructions)

    const { signature: txid, type: resultType } = txResult

    // const txid = yield* call(sendAndConfirmRawTransaction, connection, signedTx.serialize(), {
    //   skipPreflight: false
    // })

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Position adding failed. Please try again',
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
          if (txDetails.meta.logMessages && resultType === 1) {
            const resultError = txResult.error as any

            const customError = resultError?.InstructionError[1]?.Custom

            const errorLog = txDetails.meta.logMessages.find(log =>
              log.includes(ErrorCodeExtractionKeys.ErrorNumber)
            )

            const errorCode = errorLog
              ?.split(ErrorCodeExtractionKeys.ErrorNumber)[1]
              .split(ErrorCodeExtractionKeys.Dot)[0]
              .trim()
            const message = mapErrorCodeToMessage(Number(customError ?? errorCode))
            yield put(actions.setInitPositionSuccess(false))

            closeSnackbar(loaderCreatePosition)
            yield put(snackbarsActions.remove(loaderCreatePosition))
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
        } else {
          yield put(actions.setInitPositionSuccess(true))
          yield put(
            snackbarsActions.add({
              message: 'Position added successfully',
              variant: 'success',
              persist: false,
              txid
            })
          )
        }

        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const { amount: amountX, token: tokenXAddress } = getAmountFromInitPositionInstruction(
              meta,
              TokenType.TokenX
            )
            const { amount: amountY, token: tokenYAddress } = getAmountFromInitPositionInstruction(
              meta,
              TokenType.TokenY
            )

            const tokenX = allTokens[tokenXAddress]
            const tokenY = tokenYAddress ? allTokens[tokenYAddress] : null

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'deposit',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY?.decimals || 0)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY?.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY?.symbol ?? tokenY?.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }

      yield put(actions.getPositionsList())
    }

    closeSnackbar(loaderCreatePosition)
    yield put(snackbarsActions.remove(loaderCreatePosition))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    yield put(actions.setInitPositionSuccess(false))

    closeSnackbar(loaderCreatePosition)
    yield put(snackbarsActions.remove(loaderCreatePosition))
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

export function* handleGetCurrentPlotTicks(action: PayloadAction<GetCurrentTicksData>): Generator {
  const allPools = yield* select(poolsArraySortedByFees)
  const allTokens = yield* select(tokens)

  const { poolIndex, isXtoY } = action.payload

  const xDecimal = allTokens[allPools[poolIndex].tokenX.toString()].decimals
  const yDecimal = allTokens[allPools[poolIndex].tokenY.toString()].decimals

  try {
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)

    const rawTicks = yield* call(
      [marketProgram, marketProgram.getAllTicks],
      new Pair(allPools[poolIndex].tokenX, allPools[poolIndex].tokenY, {
        fee: allPools[poolIndex].fee,
        tickSpacing: allPools[poolIndex].tickSpacing
      })
    )

    const { list } = yield* select(positionsList)
    const userTicks = getLiquidityTicksByPositionsList(
      allPools[poolIndex],
      list,
      isXtoY,
      xDecimal,
      yDecimal
    )

    const ticksData = createLiquidityPlot(
      rawTicks,
      allPools[poolIndex],
      action.payload.isXtoY,
      xDecimal,
      yDecimal
    )

    yield put(
      actions.setPlotTicks({
        allPlotTicks: ticksData,
        userPlotTicks: userTicks,
        rawTickIndexes: rawTicks.map(t => t.index)
      })
    )
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    const data = createPlaceholderLiquidityPlot(
      action.payload.isXtoY,
      10,
      allPools[poolIndex].tickSpacing,
      xDecimal,
      yDecimal
    )
    yield put(actions.setErrorPlotTicks(data))

    yield* call(handleRpcError, error.message)
  }
}

export function* handleGetPositionsList() {
  try {
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const session = getSession()
    if (!session) throw Error('No session provided')
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    const lockerProgram = yield* call(getLockerProgram, networkType, rpc, {} as IWallet)

    if (!session.walletPublicKey) {
      yield* put(actions.setLockedPositionsList([]))
      yield* put(actions.setPositionsList([[], { head: 0, bump: 0 }, false]))
      return
    }

    const { head, bump } = yield* call(
      [marketProgram, marketProgram.getPositionList],
      session.walletPublicKey
    )

    const { list, addresses } = yield* all({
      list: call(
        [marketProgram, marketProgram.getPositionsFromRange],
        session.walletPublicKey,
        0,
        head - 1
      ),
      addresses: call(
        getPositionsAddressesFromRange,
        marketProgram,
        session.walletPublicKey,
        0,
        head - 1
      )
    })

    const pools = new Set(list.map(pos => pos.pool.toString()))

    const [lockerAuth] = lockerProgram.getUserLocksAddress(session.walletPublicKey)

    let lockedPositions: (Position & { address: PublicKey })[] = []

    try {
      const { head: lockedHead } = yield* call(
        [marketProgram, marketProgram.getPositionList],
        lockerAuth
      )

      const { lockedList, lockedAddresses } = yield* all({
        lockedList: call(
          [marketProgram, marketProgram.getPositionsFromRange],
          lockerAuth,
          0,
          lockedHead - 1
        ),
        lockedAddresses: call(
          getPositionsAddressesFromRange,
          marketProgram,
          lockerAuth,
          0,
          lockedHead - 1
        )
      })

      lockedPositions = lockedList.map((position, index) => ({
        ...position,
        address: lockedAddresses[index]
      }))
    } catch (e: unknown) {
      const error = ensureError(e)
      console.log(error)

      lockedPositions = []
    }

    lockedPositions.forEach(lock => {
      pools.add(lock.pool.toString())
    })

    yield* put(
      poolsActions.getPoolsDataForList({
        addresses: Array.from(pools),
        listType: ListType.POSITIONS
      })
    )
    yield* take(poolsActions.addPoolsForList.type)

    const poolsList = yield* select(poolsArraySortedByFees)
    const positions = list.map((position, index) => {
      return {
        ...position,
        address: addresses[index]
      }
    })

    const positionsWithTicks: PositionWithAddress[] = []
    const tickAddresses = new Set<PublicKey>()

    const totalPositions = [...positions, ...lockedPositions]
    for (const position of totalPositions) {
      const pool = poolsList.find(pool => pool.address.toString() === position.pool.toString())

      if (!pool) {
        continue
      }

      const pair = new Pair(pool.tokenX, pool.tokenY, {
        fee: pool.fee,
        tickSpacing: pool.tickSpacing
      })

      const lowerTickAddress = marketProgram.getTickAddress(pair, position.lowerTickIndex)
      const upperTickAddress = marketProgram.getTickAddress(pair, position.upperTickIndex)

      tickAddresses.add(lowerTickAddress.tickAddress).add(upperTickAddress.tickAddress)
    }

    const ticks = yield* call(getTicksFromAddresses, marketProgram, [...tickAddresses])

    let offset = 0

    for (let i = 0; i < positions.length; i++) {
      if (!ticks[i] || !ticks[i + 1]) {
        continue
      }
      const lowerTick = parseTick(ticks[offset]!)
      const upperTick = parseTick(ticks[offset + 1]!)

      positionsWithTicks[i] = {
        ...positions[i],
        lowerTick: lowerTick,
        upperTick: upperTick,
        ticksLoading: false
      }
      offset += 2
    }
    const lockedPositionsWithTicks: PositionWithAddress[] = []

    for (let i = 0; i < lockedPositions.length; i++) {
      if (!ticks[i] || !ticks[i + 1]) {
        continue
      }

      const lowerTick = parseTick(ticks[offset]!)
      const upperTick = parseTick(ticks[offset + 1]!)

      lockedPositionsWithTicks[i] = {
        ...lockedPositions[i],
        lowerTick: lowerTick,
        upperTick: upperTick,
        ticksLoading: false
      }
      offset += 2
    }

    yield* put(
      poolsActions.getPoolsDataForList({
        addresses: Array.from(pools),
        listType: ListType.POSITIONS
      })
    )

    const pattern: GuardPredicate<PayloadAction<ListPoolsResponse>> = (
      action
    ): action is PayloadAction<ListPoolsResponse> => {
      return (
        typeof action?.payload?.listType !== 'undefined' &&
        action.payload.listType === ListType.POSITIONS
      )
    }

    yield* take(pattern)

    yield* put(actions.setLockedPositionsList(lockedPositionsWithTicks))
    yield* put(actions.setPositionsList([positionsWithTicks, { head, bump }, true]))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* put(actions.setLockedPositionsList([]))
    yield* put(actions.setPositionsList([[], { head: 0, bump: 0 }, false]))

    yield* call(handleRpcError, error.message)
  }
}

export function* handleClaimFee(action: PayloadAction<{ index: number; isLocked: boolean }>) {
  const loaderClaimFee = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  const session = getSession()
  if (!session) throw Error('No session provided')
  try {
    const allTokens = yield* select(tokens)
    const data = action.payload.isLocked ? lockedPositionsWithPoolsData : positionsWithPoolsData
    const allPositionsData = yield* select(data)
    const position = allPositionsData[action.payload.index]
    const poolForIndex = position.poolData

    yield put(
      snackbarsActions.add({
        message: 'Claiming fee...',
        variant: 'pending',
        persist: true,
        key: loaderClaimFee
      })
    )

    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    const lockerProgram = yield* call(getLockerProgram, networkType, rpc, {} as IWallet)

    const tokensAccounts = yield* select(accounts)

    let userTokenX = tokensAccounts[poolForIndex.tokenX.toString()]
      ? tokensAccounts[poolForIndex.tokenX.toString()].address
      : null

    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, poolForIndex.tokenX)
    }

    let userTokenY = tokensAccounts[poolForIndex.tokenY.toString()]
      ? tokensAccounts[poolForIndex.tokenY.toString()].address
      : null

    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, poolForIndex.tokenY)
    }

    const tx = new Transaction()
    const pair = new Pair(poolForIndex.tokenX, poolForIndex.tokenY, {
      fee: poolForIndex.fee,
      tickSpacing: poolForIndex.tickSpacing
    })
    if (action.payload.isLocked) {
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 230000
        })
      )
      const ix = yield* call([lockerProgram, lockerProgram.claimFeeIx], session, {
        authorityListIndex: action.payload.index,
        market: marketProgram as any,
        pair,
        userTokenX,
        userTokenY
      })

      tx.add(...ix)
    } else {
      const ix = yield* call(
        [marketProgram, marketProgram.claimFeeIx],
        session,
        {
          pair,
          userTokenX,
          userTokenY,
          owner: session.walletPublicKey,
          index: action.payload.index
        },
        {
          position: position,
          pool: poolForIndex,
          tokenXProgram: allTokens[poolForIndex.tokenX.toString()].tokenProgram,
          tokenYProgram: allTokens[poolForIndex.tokenY.toString()].tokenProgram
        }
      )
      tx.add(ix)
    }

    const txResult = yield* call([session, session.sendTransaction], tx.instructions)

    const { signature: txid } = txResult

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Failed to claim fee. Please try again',
          variant: 'error',
          persist: false,
          txid
        })
      )
    } else {
      yield put(actions.getPositionsList())

      yield put(
        snackbarsActions.add({
          message: 'Fee claimed successfully',
          variant: 'success',
          persist: false,
          txid
        })
      )

      const txDetails = yield* call([connection, connection.getParsedTransaction], txid, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        const meta = txDetails.meta
        if (meta?.preTokenBalances && meta.postTokenBalances) {
          try {
            const amountX = getAmountFromClaimFeeInstruction(meta, TokenType.TokenX)
            const amountY = getAmountFromClaimFeeInstruction(meta, TokenType.TokenY)

            const tokenX = allTokens[pair.tokenX.toString()]
            const tokenY = allTokens[pair.tokenY.toString()]

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'claim',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY.decimals)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY.symbol ?? tokenY.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }
    }

    yield put(actions.getSinglePosition(action.payload))

    closeSnackbar(loaderClaimFee)
    yield put(snackbarsActions.remove(loaderClaimFee))
    yield put(actions.setFeesLoader(false))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)
    yield put(actions.setFeesLoader(false))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    closeSnackbar(loaderClaimFee)
    yield put(snackbarsActions.remove(loaderClaimFee))
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

export function* handleClaimAllFees() {
  const loaderClaimAllFees = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  const session = getSession()
  if (!session) throw Error('No session provided')
  try {
    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const allTokens = yield* select(tokens)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    const positionsData = yield* select(positionsWithPoolsData)
    const filteredPositions = positionsData.filter(position => {
      const [bnX, bnY] = calculateClaimAmount({
        position: position,
        tickLower: position.lowerTick,
        tickUpper: position.upperTick,
        tickCurrent: position.poolData.currentTickIndex,
        feeGrowthGlobalX: position.poolData.feeGrowthGlobalX,
        feeGrowthGlobalY: position.poolData.feeGrowthGlobalY
      })

      return !bnX.isZero() || !bnY.isZero()
    })
    const tokensAccounts = yield* select(accounts)

    if (filteredPositions.length === 0) {
      return
    }
    if (filteredPositions.length === 1) {
      const claimFeeAction = actions.claimFee({ index: 0, isLocked: filteredPositions[0].isLocked })
      return yield* call(handleClaimFee, claimFeeAction)
    }

    yield* put(actions.setAllClaimLoader(true))
    yield put(
      snackbarsActions.add({
        message: 'Claiming all fees',
        variant: 'pending',
        persist: true,
        key: loaderClaimAllFees
      })
    )
    for (const position of filteredPositions) {
      const pool = positionsData[position.positionIndex].poolData
      if (!tokensAccounts[pool.tokenX.toString()]) {
        yield* call(createAccount, pool.tokenX)
      }
      if (!tokensAccounts[pool.tokenY.toString()]) {
        yield* call(createAccount, pool.tokenY)
      }
    }
    const formattedPositions = filteredPositions.map(position => ({
      pair: new Pair(position.poolData.tokenX, position.poolData.tokenY, {
        fee: position.poolData.fee,
        tickSpacing: position.poolData.tickSpacing
      }),
      index: position.positionIndex,
      lowerTickIndex: position.lowerTickIndex,
      upperTickIndex: position.upperTickIndex
    }))

    const accountToMint = {}

    for (const position of formattedPositions) {
      const tokenX = position.pair.tokenX
      const tokenY = position.pair.tokenY
      if (!accountToMint[tokenX.toString()]) {
        const tokenAccountX = tokensAccounts[tokenX.toString()]
        if (tokenAccountX) {
          accountToMint[tokenAccountX.address.toString()] = tokenX.toString()
        } else {
          const programId =
            allTokens[tokenX.toString()].tokenProgram ??
            (yield* call(getTokenProgramId, connection, tokenX))
          const ataX = getAssociatedTokenAddressSync(
            tokenX,
            session.walletPublicKey,
            false,
            programId
          )
          accountToMint[ataX.toString()] = tokenX.toString()
        }
      }
      if (!accountToMint[tokenY.toString()]) {
        const tokenAccountY = tokensAccounts[tokenY.toString()]
        if (tokenAccountY) {
          accountToMint[tokenAccountY.address.toString()] = tokenY.toString()
        } else {
          const programId =
            allTokens[tokenY.toString()].tokenProgram ??
            (yield* call(getTokenProgramId, connection, tokenY))
          const ataY = getAssociatedTokenAddressSync(
            tokenY,
            session.walletPublicKey,
            false,
            programId
          )
          accountToMint[ataY.toString()] = tokenY.toString()
        }
      }
    }

    const txs = yield* call([marketProgram, marketProgram.claimAllFeesTxs], session, {
      positions: formattedPositions
    } as ClaimAllFee)
    yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    for (const { tx } of txs) {
      const { blockhash, lastValidBlockHeight } = yield* call([
        connection,
        connection.getLatestBlockhash
      ])

      const { signature: txid } = yield* call([session, session.sendTransaction], tx.instructions)

      yield* call([connection, connection.confirmTransaction], {
        signature: txid,
        blockhash,
        lastValidBlockHeight
      })

      const txDetails = yield* call([connection, connection.getParsedTransaction], txid, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          for (const metaInstructions of meta.innerInstructions) {
            try {
              const splTransfers = metaInstructions.instructions.filter(
                ix =>
                  (ix as ParsedInstruction).parsed.info.tokenAmount !== undefined ||
                  (ix as ParsedInstruction).parsed.info.amount !== undefined
              ) as ParsedInstruction[]

              let tokenXAmount = '0'
              let tokenYAmount = '0'
              let tokenXIcon = unknownTokenIcon
              let tokenYIcon = unknownTokenIcon
              let tokenYSymbol = 'Unknown'
              let tokenXSymbol = 'Unknown'

              splTransfers.map((transfer, index) => {
                const token =
                  allTokens[
                    transfer.parsed.info?.mint || accountToMint[transfer.parsed.info?.destination]
                  ]
                const amount =
                  transfer.parsed.info?.tokenAmount?.amount || transfer.parsed.info.amount
                if (index === 0) {
                  tokenYAmount = formatNumberWithoutSuffix(printBN(amount, token.decimals))
                  tokenYIcon = token.logoURI
                } else if (index === 1) {
                  tokenXAmount = formatNumberWithoutSuffix(printBN(amount, token.decimals))
                  tokenXIcon = token.logoURI
                  tokenYSymbol = token.symbol ?? token.address.toString()
                }
              })

              yield put(
                snackbarsActions.add({
                  tokensDetails: {
                    ikonType: 'claim',
                    tokenXAmount: tokenXAmount,
                    tokenYAmount: tokenYAmount,
                    tokenXIcon: tokenXIcon,
                    tokenYIcon: tokenYIcon,
                    tokenXSymbol: tokenXSymbol,
                    tokenYSymbol: tokenYSymbol
                  },
                  persist: false
                })
              )
            } catch {
              // Should never be triggered
            }
          }
        }
      }

      if (!txid.length) {
        yield put(
          snackbarsActions.add({
            message: 'Failed to claim some fees. Please try again.',
            variant: 'error',
            persist: false,
            txid
          })
        )
      }
    }

    yield put(
      snackbarsActions.add({
        message: 'All fees claimed successfully.',
        variant: 'success',
        persist: false
      })
    )

    for (const position of positionsData) {
      yield put(
        actions.getSinglePosition({ index: position.positionIndex, isLocked: position.isLocked })
      )
    }

    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))
    closeSnackbar(loaderClaimAllFees)
    yield put(snackbarsActions.remove(loaderClaimAllFees))

    yield sleep(500)
    yield put(actions.getPositionsList())

    yield* put(actions.setAllClaimLoader(false))
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)
    yield* put(actions.setAllClaimLoader(false))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    closeSnackbar(loaderClaimAllFees)
    yield put(snackbarsActions.remove(loaderClaimAllFees))
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

export function* handleClosePosition(action: PayloadAction<ClosePositionData>) {
  const session = getSession()
  if (!session) throw Error('No session provided')

  const loaderClosePosition = createLoaderKey()
  const loaderSigningTx = createLoaderKey()

  try {
    const allTokens = yield* select(tokens)
    const allPositionsData = yield* select(positionsWithPoolsData)
    const poolForIndex = allPositionsData[action.payload.positionIndex].poolData
    const position = allPositionsData[action.payload.positionIndex]

    yield put(actions.setShouldDisable(true))

    yield put(
      snackbarsActions.add({
        message: 'Closing position...',
        variant: 'pending',
        persist: true,
        key: loaderClosePosition
      })
    )

    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    const tokensAccounts = yield* select(accounts)

    let userTokenX = tokensAccounts[poolForIndex.tokenX.toString()]
      ? tokensAccounts[poolForIndex.tokenX.toString()].address
      : null

    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, poolForIndex.tokenX)
    }

    let userTokenY = tokensAccounts[poolForIndex.tokenY.toString()]
      ? tokensAccounts[poolForIndex.tokenY.toString()].address
      : null

    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, poolForIndex.tokenY)
    }

    const pair = new Pair(poolForIndex.tokenX, poolForIndex.tokenY, {
      fee: poolForIndex.fee,
      tickSpacing: poolForIndex.tickSpacing
    })

    const ix = yield* call(
      [marketProgram, marketProgram.removePositionIx],
      session,
      {
        pair,
        owner: session.walletPublicKey,
        index: action.payload.positionIndex,
        userTokenX,
        userTokenY
      },
      {
        position,
        pool: poolForIndex,
        tokenXProgram: allTokens[poolForIndex.tokenX.toString()].tokenProgram,
        tokenYProgram: allTokens[poolForIndex.tokenY.toString()].tokenProgram
      }
    )

    yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    // const signedTx = (yield* call([wallet, wallet.signTransaction], tx)) as Transaction

    closeSnackbar(loaderSigningTx)
    yield put(snackbarsActions.remove(loaderSigningTx))

    const { signature: txid } = yield* call([session, session.sendTransaction], [ix])

    // const txid = yield* call(sendAndConfirmRawTransaction, connection, signedTx.serialize(), {
    //   skipPreflight: false
    // })

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Failed to close position. Please try again',
          variant: 'error',
          persist: false,
          txid
        })
      )
    } else {
      yield put(
        snackbarsActions.add({
          message: 'Position closed successfully',
          variant: 'success',
          persist: false,
          txid
        })
      )

      const txDetails = yield* call([connection, connection.getParsedTransaction], txid, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const amountX = getAmountFromClosePositionInstruction(meta, TokenType.TokenX)
            const amountY = getAmountFromClosePositionInstruction(meta, TokenType.TokenY)

            const tokenX = allTokens[pair.tokenX.toString()]
            const tokenY = allTokens[pair.tokenY.toString()]

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'withdraw',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY.decimals)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY.symbol ?? tokenY.address.toString()
                },
                persist: false
              })
            )
          } catch {}
        }
      }
    }

    yield* put(actions.getPositionsList())

    action.payload.onSuccess()
    yield put(actions.setShouldDisable(false))

    closeSnackbar(loaderClosePosition)
    yield put(snackbarsActions.remove(loaderClosePosition))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    closeSnackbar(loaderClosePosition)
    yield put(actions.setShouldDisable(false))

    yield put(snackbarsActions.remove(loaderClosePosition))
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

export function* handleAddLiquidity(action: PayloadAction<ChangeLiquidityData>): Generator {
  const data = action.payload
  const positionsData = yield* select(positionsWithPoolsData)
  const position = positionsData[data.positionIndex]
  const loaderAddLiquidity = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  const session = getSession()
  if (!session) throw Error('No session provided')
  try {
    yield put(
      snackbarsActions.add({
        message: 'Adding liquidity...',
        variant: 'pending',
        persist: true,
        key: loaderAddLiquidity
      })
    )
    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    // marketProgram.setWallet({
    //   signAllTransactions: wallet.signAllTransactions,
    //   signTransaction: wallet.signTransaction,
    //   publicKey: wallet.publicKey
    // } as IWallet)
    const tokensAccounts = yield* select(accounts)
    const allTokens = yield* select(tokens)
    const pair = new Pair(position.poolData.tokenX, position.poolData.tokenY, {
      fee: position.poolData.fee,
      tickSpacing: position.poolData.tickSpacing
    })
    let userTokenX = tokensAccounts[position.poolData.tokenX.toString()]
      ? tokensAccounts[position.poolData.tokenX.toString()].address
      : null
    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, position.poolData.tokenX)
    }
    let userTokenY = tokensAccounts[position.poolData.tokenY.toString()]
      ? tokensAccounts[position.poolData.tokenY.toString()].address
      : null
    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, position.poolData.tokenY)
    }

    const changeLiquidityIx = yield* call(
      [marketProgram, marketProgram.changeLiquidityIx],
      session,
      {
        pair,
        knownPrice: position.poolData.sqrtPrice,
        slippage: data.slippage,
        index: data.positionIndex,
        lowerTickIndex: position.lowerTick.index,
        upperTickIndex: position.upperTick.index,
        liquidityDelta: data.liquidity,
        addLiquidity: true,
        owner: session.walletPublicKey,
        accountX: userTokenX,
        accountY: userTokenY
      }
    )

    const txResult = yield* call([session, session.sendTransaction], [changeLiquidityIx])

    const { signature: txId, type: resultType } = txResult

    if (!txId.length) {
      yield put(actions.setChangeLiquiditySuccess(false))
      closeSnackbar(loaderAddLiquidity)
      yield put(snackbarsActions.remove(loaderAddLiquidity))
      return yield put(
        snackbarsActions.add({
          message: 'Adding liquidity failed. Please try again',
          variant: 'error',
          persist: false,
          txid: txId
        })
      )
    } else {
      const txDetails = yield* call([connection, connection.getParsedTransaction], txId, {
        maxSupportedTransactionVersion: 0
      })

      if (txDetails) {
        if (txDetails.meta?.err) {
          if (txDetails.meta.logMessages && resultType === 1) {
            const resultError = txResult.error as any

            const customError = resultError?.InstructionError[1]?.Custom

            const errorLog = txDetails.meta.logMessages.find(log =>
              log.includes(ErrorCodeExtractionKeys.ErrorNumber)
            )
            const errorCode = errorLog
              ?.split(ErrorCodeExtractionKeys.ErrorNumber)[1]
              .split(ErrorCodeExtractionKeys.Dot)[0]
              .trim()
            const message = mapErrorCodeToMessage(Number(customError ?? errorCode))
            yield put(actions.setChangeLiquiditySuccess(false))
            closeSnackbar(loaderAddLiquidity)
            yield put(snackbarsActions.remove(loaderAddLiquidity))
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

        yield put(actions.setChangeLiquiditySuccess(true))
        yield put(
          snackbarsActions.add({
            message: 'Liquidity added',
            variant: 'success',
            persist: false,
            txid: txId
          })
        )

        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const { amount: amountX, token: tokenXAddress } = getAmountFromInitPositionInstruction(
              meta,
              TokenType.TokenX
            )
            const { amount: amountY, token: tokenYAddress } = getAmountFromInitPositionInstruction(
              meta,
              TokenType.TokenY
            )

            const tokenX = allTokens[tokenXAddress]
            const tokenY = tokenYAddress ? allTokens[tokenYAddress] : null

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'deposit',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY?.decimals || 0)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY?.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY?.symbol ?? tokenY?.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }
    }
    yield put(actions.getSinglePosition({ index: data.positionIndex, isLocked: false }))
    yield put(actions.setChangeLiquiditySuccess(true))
    closeSnackbar(loaderAddLiquidity)
    yield put(snackbarsActions.remove(loaderAddLiquidity))
  } catch (e: unknown) {
    yield put(actions.setChangeLiquiditySuccess(false))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }
    closeSnackbar(loaderAddLiquidity)
    yield put(snackbarsActions.remove(loaderAddLiquidity))
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

export function* handleRemoveLiquidity(action: PayloadAction<ChangeLiquidityData>): Generator {
  const data = action.payload
  const positionsData = yield* select(positionsWithPoolsData)
  const position = positionsData[data.positionIndex]
  const session = getSession()
  if (!session) throw Error('No session provided')
  if (data.isClosePosition) {
    return yield* call(handleClosePosition, {
      payload: {
        positionIndex: data.positionIndex,
        onSuccess: data.onSuccess || (() => {}),
        isRemoveLiquidity: true
      },
      type: 'positions/closePosition'
    })
  }
  const loaderRemoveLiquidity = createLoaderKey()
  const loaderSigningTx = createLoaderKey()
  try {
    yield put(
      snackbarsActions.add({
        message: 'Removing liquidity...',
        variant: 'pending',
        persist: true,
        key: loaderRemoveLiquidity
      })
    )
    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    // marketProgram.setWallet({
    //   signAllTransactions: wallet.signAllTransactions,
    //   signTransaction: wallet.signTransaction,
    //   publicKey: wallet.publicKey
    // } as IWallet)
    const tokensAccounts = yield* select(accounts)
    const allTokens = yield* select(tokens)
    const pair = new Pair(position.poolData.tokenX, position.poolData.tokenY, {
      fee: position.poolData.fee,
      tickSpacing: position.poolData.tickSpacing
    })
    let userTokenX = tokensAccounts[position.poolData.tokenX.toString()]
      ? tokensAccounts[position.poolData.tokenX.toString()].address
      : null
    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, position.poolData.tokenX)
    }
    let userTokenY = tokensAccounts[position.poolData.tokenY.toString()]
      ? tokensAccounts[position.poolData.tokenY.toString()].address
      : null
    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, position.poolData.tokenY)
    }

    const changeLiquidityIx = yield* call(
      [marketProgram, marketProgram.changeLiquidityIx],
      session,
      {
        pair,
        knownPrice: position.poolData.sqrtPrice,
        slippage: data.slippage,
        index: data.positionIndex,
        lowerTickIndex: position.lowerTick.index,
        upperTickIndex: position.upperTick.index,
        liquidityDelta: data.liquidity,
        addLiquidity: false,
        owner: session.walletPublicKey,
        accountX: userTokenX,
        accountY: userTokenY
      }
    )

    const txResult = yield* call([session, session.sendTransaction], [changeLiquidityIx])

    const { signature: txId, type: resultType } = txResult

    if (!txId.length) {
      yield put(actions.setChangeLiquiditySuccess(false))
      closeSnackbar(loaderRemoveLiquidity)
      yield put(snackbarsActions.remove(loaderRemoveLiquidity))
      return yield put(
        snackbarsActions.add({
          message: 'Removing liquidity failed. Please try again',
          variant: 'error',
          persist: false,
          txid: txId
        })
      )
    } else {
      const txDetails = yield* call([connection, connection.getParsedTransaction], txId, {
        maxSupportedTransactionVersion: 0
      })
      if (txDetails) {
        if (txDetails.meta?.err) {
          if (txDetails.meta.logMessages && resultType === 1) {
            const resultError = txResult.error as any

            const customError = resultError?.InstructionError[1]?.Custom

            const errorLog = txDetails.meta.logMessages.find(log =>
              log.includes(ErrorCodeExtractionKeys.ErrorNumber)
            )
            const errorCode = errorLog
              ?.split(ErrorCodeExtractionKeys.ErrorNumber)[1]
              .split(ErrorCodeExtractionKeys.Dot)[0]
              .trim()
            const message = mapErrorCodeToMessage(Number(customError ?? errorCode))
            yield put(actions.setChangeLiquiditySuccess(false))
            closeSnackbar(loaderRemoveLiquidity)
            yield put(snackbarsActions.remove(loaderRemoveLiquidity))
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

        yield put(actions.setChangeLiquiditySuccess(true))
        yield put(
          snackbarsActions.add({
            message: 'Liquidity removed',
            variant: 'success',
            persist: false,
            txid: txId
          })
        )

        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const { amount: amountX } = getAmountFromInitPositionInstruction(meta, TokenType.TokenX)
            const { amount: amountY } = getAmountFromInitPositionInstruction(meta, TokenType.TokenY)

            const tokenX = allTokens[pair.tokenX.toString()]
            const tokenY = allTokens[pair.tokenY.toString()]

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'withdraw',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY.decimals)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY.symbol ?? tokenY.address.toString()
                },
                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }
    }
    yield put(actions.getSinglePosition({ index: data.positionIndex, isLocked: false }))
    yield put(actions.setChangeLiquiditySuccess(true))
    closeSnackbar(loaderRemoveLiquidity)
    yield put(snackbarsActions.remove(loaderRemoveLiquidity))
  } catch (e: unknown) {
    yield put(actions.setChangeLiquiditySuccess(false))
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
        msg = COMMON_ERROR_MESSAGE
      }
    }
    closeSnackbar(loaderRemoveLiquidity)
    yield put(snackbarsActions.remove(loaderRemoveLiquidity))
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

export function* handleSwapAndAddLiquidity(
  action: PayloadAction<SwapAndAddLiquidityData>
): Generator {
  const session = getSession()
  if (!session) throw Error('No session provided')
  const loaderAddPosition = createLoaderKey()
  const loaderSigningTx = createLoaderKey()

  try {
    const allTokens = yield* select(tokens)

    yield put(
      snackbarsActions.add({
        message: 'Adding liquidity',
        variant: 'pending',
        persist: true,
        key: loaderAddPosition
      })
    )

    const connection = yield* call(getConnection)
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const allPools = yield* select(poolsArraySortedByFees)

    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)

    const swapPair = new Pair(action.payload.tokenX, action.payload.tokenY, {
      fee: action.payload.swapPool.fee,
      tickSpacing: action.payload.swapPool.tickSpacing
    })

    const tokensAccounts = yield* select(accounts)

    let userTokenX = tokensAccounts[swapPair.tokenX.toString()]
      ? tokensAccounts[swapPair.tokenX.toString()].address
      : null

    if (userTokenX === null) {
      userTokenX = yield* call(createAccount, swapPair.tokenX)
    }

    let userTokenY = tokensAccounts[swapPair.tokenY.toString()]
      ? tokensAccounts[swapPair.tokenY.toString()].address
      : null

    if (userTokenY === null) {
      userTokenY = yield* call(createAccount, swapPair.tokenY)
    }

    const swapAndAddOnDifferentPools = action.payload.isSamePool
      ? undefined
      : {
          positionPair: new Pair(action.payload.tokenX, action.payload.tokenY, {
            fee: action.payload.positionPair.fee,
            tickSpacing: action.payload.positionPair.tickSpacing
          }),
          positionPoolPrice: action.payload.positionPoolPrice,
          positionSlippage: action.payload.positionSlippage
        }

    const tx = yield* call(
      [marketProgram, marketProgram.versionedSwapAndIncreaseLiquidityTx],
      session,
      {
        amountX: action.payload.xAmount,
        amountY: action.payload.yAmount,
        swapPair,
        userTokenX,
        userTokenY,
        owner: session.walletPublicKey,
        slippage: action.payload.swapSlippage,
        amount: action.payload.swapAmount,
        xToY: action.payload.xToY,
        byAmountIn: action.payload.byAmountIn,
        estimatedPriceAfterSwap: action.payload.estimatedPriceAfterSwap,
        minUtilizationPercentage: action.payload.minUtilizationPercentage,
        swapAndCreateOnDifferentPools: swapAndAddOnDifferentPools,
        liquidityDelta: action.payload.liquidityDelta,
        positionIndex: action.payload.positionIndex
      },
      { tickIndexes: action.payload.crossedTicks },
      {
        position: {
          pool:
            action.payload.positionPoolIndex !== null
              ? allPools[action.payload.positionPoolIndex]
              : undefined,
          lowerTick: action.payload.lowerTick,
          upperTick: action.payload.upperTick,
          tokenXProgramAddress: allTokens[action.payload.tokenX.toString()].tokenProgram,
          tokenYProgramAddress: allTokens[action.payload.tokenY.toString()].tokenProgram
        },
        swap: {
          tickmap: action.payload.swapPoolTickmap,
          pool: action.payload.swapPool
        }
      },
      [],
      [],
      []
    )

    // yield put(snackbarsActions.add({ ...SIGNING_SNACKBAR_CONFIG, key: loaderSigningTx }))

    // const signedTx = (yield* call([wallet, wallet.signTransaction], tx)) as VersionedTransaction

    // closeSnackbar(loaderSigningTx)
    // yield put(snackbarsActions.remove(loaderSigningTx))

    // const txid = yield* call([connection, connection.sendTransaction], signedTx)

    // yield* call([connection, connection.confirmTransaction], txid)

    const { signature: txid } = yield* call([session, session.sendTransaction], tx)

    yield put(actions.setChangeLiquiditySuccess(!!txid.length))

    if (!txid.length) {
      yield put(
        snackbarsActions.add({
          message: 'Liquidity adding failed. Please try again.',
          variant: 'error',
          persist: false,
          txid
        })
      )
    } else {
      yield put(
        snackbarsActions.add({
          message: 'Liquidity added.',
          variant: 'success',
          persist: false,
          txid
        })
      )

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
            yield put(actions.setChangeLiquiditySuccess(false))

            closeSnackbar(loaderAddPosition)
            yield put(snackbarsActions.remove(loaderAddPosition))
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

        const meta = txDetails.meta
        if (meta?.innerInstructions && meta.innerInstructions) {
          try {
            const tokenIn = action.payload.xToY
              ? allTokens[swapPair.tokenX.toString()]
              : allTokens[swapPair.tokenY.toString()]
            const tokenOut = action.payload.xToY
              ? allTokens[swapPair.tokenY.toString()]
              : allTokens[swapPair.tokenX.toString()]

            const amountX = getAddAmountFromSwapAndAddLiquidity(meta, TokenType.TokenX)
            const amountY = getAddAmountFromSwapAndAddLiquidity(meta, TokenType.TokenY)

            const swapAmountIn = getSwapAmountFromSwapAndAddLiquidity(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenIn.address.toString(),
              SwapTokenType.TokenIn
            )
            const swapAmountOut = getSwapAmountFromSwapAndAddLiquidity(
              meta,
              marketProgram.programAuthority.address.toString(),
              tokenOut.address.toString(),
              SwapTokenType.TokenOut
            )

            const tokenX = allTokens[swapPair.tokenX.toString()]
            const tokenY = allTokens[swapPair.tokenY.toString()]

            yield put(
              snackbarsActions.add({
                tokensDetails: {
                  ikonType: 'deposit',
                  tokenXAmount: formatNumberWithoutSuffix(printBN(amountX, tokenX.decimals)),
                  tokenYAmount: formatNumberWithoutSuffix(printBN(amountY, tokenY.decimals)),
                  tokenXIcon: tokenX.logoURI,
                  tokenYIcon: tokenY.logoURI,
                  tokenXSymbol: tokenX.symbol ?? tokenX.address.toString(),
                  tokenYSymbol: tokenY.symbol ?? tokenY.address.toString(),
                  tokenXAmountAutoSwap: formatNumberWithoutSuffix(
                    printBN(swapAmountIn, tokenIn.decimals)
                  ),
                  tokenYAmountAutoSwap: formatNumberWithoutSuffix(
                    printBN(swapAmountOut, tokenOut.decimals)
                  ),
                  tokenXIconAutoSwap: tokenIn.logoURI,
                  tokenYIconAutoSwap: tokenOut.logoURI
                },

                persist: false
              })
            )
          } catch {
            // Should never be triggered
          }
        }
      }

      yield put(actions.getSinglePosition({ index: action.payload.positionIndex, isLocked: false }))
      yield put(actions.setChangeLiquiditySuccess(true))
    }

    closeSnackbar(loaderAddPosition)
    yield put(snackbarsActions.remove(loaderAddPosition))
  } catch (e: unknown) {
    yield put(actions.setChangeLiquiditySuccess(false))

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
        msg = COMMON_ERROR_MESSAGE
      }
    }

    yield put(actions.setChangeLiquiditySuccess(false))

    closeSnackbar(loaderAddPosition)
    yield put(snackbarsActions.remove(loaderAddPosition))
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

    yield* call(handleRpcError, (error as Error).message)
  }
}

export function* handleGetSinglePosition(
  action: PayloadAction<{ index: number; isLocked: boolean }>
) {
  try {
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const session = getSession()
    if (!session) throw Error('No session provided')
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)
    const lockerProgram = yield* call(getLockerProgram, networkType, rpc, {} as IWallet)
    const [lockerAuth] = lockerProgram.getUserLocksAddress(session.walletPublicKey)
    const poolsList = yield* select(poolsArraySortedByFees)

    const position = yield* call(
      [marketProgram, marketProgram.getPosition],
      action.payload.isLocked ? lockerAuth : session.walletPublicKey,
      action.payload.index
    )

    const pool = poolsList.find(pool => pool.address.toString() === position.pool.toString())
    if (!pool) {
      return
    }

    const pair = new Pair(pool.tokenX, pool.tokenY, {
      fee: pool.fee,
      tickSpacing: pool.tickSpacing
    })

    yield put(poolsActions.getPoolData(pair))

    const { lowerTick, upperTick } = yield* all({
      lowerTick: call([marketProgram, marketProgram.getTick], pair, position.lowerTickIndex),
      upperTick: call([marketProgram, marketProgram.getTick], pair, position.upperTickIndex)
    })

    yield put(
      actions.setSinglePosition({
        index: action.payload.index,
        isLocked: action.payload.isLocked,
        position,
        lowerTick,
        upperTick
      })
    )
  } catch (e: unknown) {
    const error = ensureError(e)
    console.log(error)

    yield* call(handleRpcError, error.message)
  }
}

export function* handleGetPreviewPosition(action: PayloadAction<string>) {
  try {
    const parts = action.payload.split('_')
    if (parts.length !== 2) {
      throw new Error('Invalid position id')
    }
    const [id, poolAddress] = parts
    const networkType = yield* select(network)
    const rpc = yield* select(rpcAddress)
    const marketProgram = yield* call(getMarketProgram, networkType, rpc, {} as IWallet)

    const position = yield* call(getPositionByIdAndPoolAddress, marketProgram, id, poolAddress)

    if (position) {
      yield* put(
        poolsActions.getPoolsDataForList({
          addresses: [position.pool.toString()],
          listType: ListType.POSITIONS
        })
      )
    }
    const poolsList = yield* select(poolsArraySortedByFees)

    const pool = poolsList.find(pool => pool.address.toString() === poolAddress.toString())
    if (!pool || !position) {
      yield* put(actions.setPosition(null))
      return
    }

    const pair = new Pair(pool.tokenX, pool.tokenY, {
      fee: pool.fee,
      tickSpacing: pool.tickSpacing
    })

    const { lowerTick, upperTick } = yield* all({
      lowerTick: call([marketProgram, marketProgram.getTick], pair, position.lowerTickIndex),
      upperTick: call([marketProgram, marketProgram.getTick], pair, position.upperTickIndex)
    })

    yield* put(actions.setPosition({ ...position, lowerTick, upperTick, ticksLoading: false }))
  } catch {
    yield* put(actions.setPosition(null))
  }
}

export function* initPositionHandler(): Generator {
  yield* takeEvery(actions.initPosition, handleInitPosition)
}
export function* swapAndInitPositionHandler(): Generator {
  yield* takeLatest(actions.swapAndInitPosition, handleSwapAndInitPosition)
}
export function* getCurrentPlotTicksHandler(): Generator {
  yield* takeLatest(actions.getCurrentPlotTicks, handleGetCurrentPlotTicks)
}
export function* getPositionsListHandler(): Generator {
  yield* takeLatest(actions.getPositionsList, handleGetPositionsList)
}
export function* claimFeeHandler(): Generator {
  yield* takeEvery(actions.claimFee, handleClaimFee)
}

export function* claimAllFeeHandler(): Generator {
  yield* takeEvery(actions.claimAllFee, handleClaimAllFees)
}

export function* closePositionHandler(): Generator {
  yield* takeEvery(actions.closePosition, handleClosePosition)
}

export function* addLiquidityHandler(): Generator {
  yield* takeEvery(actions.addLiquidity, handleAddLiquidity)
}

export function* swapAndAddLiquidityHandler(): Generator {
  yield* takeEvery(actions.swapAndAddLiquidity, handleSwapAndAddLiquidity)
}

export function* removeLiquidityHandler(): Generator {
  yield* takeEvery(actions.removeLiquidity, handleRemoveLiquidity)
}

export function* getSinglePositionHandler(): Generator {
  yield* takeEvery(actions.getSinglePosition, handleGetSinglePosition)
}
export function* getPositionHandler(): Generator {
  yield* takeEvery(actions.getPreviewPosition, handleGetPreviewPosition)
}

export function* positionsSaga(): Generator {
  yield all(
    [
      initPositionHandler,
      swapAndInitPositionHandler,
      getCurrentPlotTicksHandler,
      getPositionsListHandler,
      claimFeeHandler,
      claimAllFeeHandler,
      closePositionHandler,
      getSinglePositionHandler,
      getPositionHandler,
      addLiquidityHandler,
      swapAndAddLiquidityHandler,
      removeLiquidityHandler
    ].map(spawn)
  )
}
