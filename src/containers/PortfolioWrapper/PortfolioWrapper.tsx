import {
  ALLOW_SESSIONS,
  DEFAULT_STRATEGY,
  Intervals,
  NetworkType,
  POSITIONS_PER_PAGE,
  WFOGO_CLOSE_POSITION_LAMPORTS_MAIN,
  WFOGO_CLOSE_POSITION_LAMPORTS_TEST,
  WRAPPED_FOGO_ADDRESS
} from '@store/consts/static'
import { EmptyPlaceholder } from '@common/EmptyPlaceholder/EmptyPlaceholder'
import { calculatePriceSqrt, Pair } from '@invariant-labs/sdk-fogo'
import { getX, getY } from '@invariant-labs/sdk-fogo/lib/math'
import {
  calculateClaimAmount,
  DECIMAL,
  getMaxTick,
  getMinTick
} from '@invariant-labs/sdk-fogo/lib/utils'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { actions, LiquidityPools } from '@store/reducers/positions'
import { Status, actions as walletActions } from '@store/reducers/solanaWallet'
import {
  changeLiquidity,
  isLoadingPositionsList,
  lastPageSelector,
  lockedPositionsWithPoolsData,
  plotTicks,
  PositionData,
  positionListSwitcher,
  positionsWithPoolsData,
  positionWithPoolData,
  prices as priceData,
  shouldDisable,
  singlePositionData
} from '@store/selectors/positions'
import {
  address,
  balanceLoading,
  swapTokens,
  balance,
  overviewSwitch,
  poolTokens,
  status
} from '@store/selectors/solanaWallet'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  calcPriceBySqrtPrice,
  calcPriceByTickIndex,
  calcYPerXPriceBySqrtPrice,
  findStrategy,
  getMockedTokenPrice,
  getTokenPrice,
  printBN,
  ROUTES
} from '@utils/utils'
import { network, timeoutError } from '@store/selectors/solanaConnection'
import { actions as actionsStats } from '@store/reducers/stats'
import { actions as lockerActions } from '@store/reducers/locker'
import { actions as snackbarActions } from '@store/reducers/snackbars'
import { actions as navigationActions } from '@store/reducers/navigation'
import { Grid, useMediaQuery } from '@mui/material'
import { theme } from '@static/theme'
import useStyles from './styles'
import Portfolio from '@components/Portfolio/Portfolio'
import { VariantType } from 'notistack'
import { IPositionItem, TokenPriceData } from '@store/consts/types'
import { portfolioSearch } from '@store/selectors/navigation'
import { ISearchToken } from '@common/FilterSearch/FilterSearch'
import { useProcessedTokens } from '@store/hooks/userOverview/useProcessedToken'
import { PublicKey } from '@solana/web3.js'
import poolsSelectors, {
  autoSwapTicksAndTickMap,
  poolsArraySortedByFees
} from '@store/selectors/pools'
import { actions as poolsActions } from '@store/reducers/pools'
import { actions as positionsActions } from '@store/reducers/positions'
import { blurContent, unblurContent } from '@utils/uiUtils'
import { isSessionActive } from '@store/hooks/session'

const PortfolioWrapper = () => {
  const { classes } = useStyles()
  const isSm = useMediaQuery(theme.breakpoints.down('sm'))
  const [prices, setPrices] = useState<Record<string, number>>({})

  const walletAddress = useSelector(address)
  const list = useSelector(positionsWithPoolsData)
  const lockedList = useSelector(lockedPositionsWithPoolsData)
  const isLoading = useSelector(isLoadingPositionsList)
  const lastPage = useSelector(lastPageSelector)
  const currentNetwork = useSelector(network)
  const tokensList = useSelector(swapTokens)
  const isBalanceLoading = useSelector(balanceLoading)
  const pricesData = useSelector(priceData)
  const fogoBalance = useSelector(balance)

  const disabledButton = useSelector(shouldDisable)
  const positionListAlignment = useSelector(positionListSwitcher)
  const overviewSelectedTab = useSelector(overviewSwitch)
  const searchParamsToken = useSelector(portfolioSearch)
  const { processedTokens, isProcesing } = useProcessedTokens(prices, tokensList, isBalanceLoading)

  const [maxToken] = [...processedTokens].sort((a, b) => b.value - a.value)

  const isConnected = ALLOW_SESSIONS
    ? isSessionActive()
    : useSelector(status) === Status.Initialized

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const setSearchTokensValue = (tokens: ISearchToken[]) => {
    dispatch(
      navigationActions.setSearch({
        section: 'portfolioTokens',
        type: 'filteredTokens',
        filteredTokens: tokens
      })
    )
  }

  const setLastPage = (page: number) => {
    dispatch(actions.setLastPage(page))
  }

  useEffect(() => {
    if (list.length === 0) {
      setLastPage(1)
    }

    if (lastPage > Math.ceil(list.length / POSITIONS_PER_PAGE)) {
      setLastPage(lastPage === 1 ? 1 : lastPage - 1)
    }
  }, [list])

  const handleRefresh = () => {
    dispatch(actions.getPositionsList())
  }

  useEffect(() => {
    dispatch(actionsStats.getCurrentIntervalStats({ interval: Intervals.Daily }))
  }, [])

  const handleLockPosition = (index: number) => {
    dispatch(lockerActions.lockPosition({ index, network: currentNetwork }))
  }

  const [isChangeLiquidityModalShown, setIsChangeLiquidityModalShown] = useState(false)
  const [isAddLiquidity, setIsAddLiquidity] = useState(true)

  const canClosePosition = useMemo(() => {
    if (currentNetwork === NetworkType.Testnet) {
      return fogoBalance.gte(WFOGO_CLOSE_POSITION_LAMPORTS_TEST)
    } else {
      return fogoBalance.gte(WFOGO_CLOSE_POSITION_LAMPORTS_MAIN)
    }
  }, [fogoBalance, currentNetwork])
  const handleClosePosition = (index: number) => {
    canClosePosition
      ? dispatch(
          actions.closePosition({
            positionIndex: index,
            onSuccess: () => {
              navigate(ROUTES.PORTFOLIO)
            }
          })
        )
      : dispatch(
          snackbarActions.add({
            message: 'Not enough FOGO balance to close position',
            variant: 'error',
            persist: false
          })
        )
  }

  const handleClaimFee = (index: number, isLocked: boolean) => {
    dispatch(actions.claimFee({ index, isLocked }))
  }

  const calculateUnclaimedFees = (position: PositionData) => {
    const [bnX, bnY] = calculateClaimAmount({
      position: position,
      tickLower: position.lowerTick,
      tickUpper: position.upperTick,
      tickCurrent: position.poolData.currentTickIndex,
      feeGrowthGlobalX: position.poolData.feeGrowthGlobalX,
      feeGrowthGlobalY: position.poolData.feeGrowthGlobalY
    })

    const xValue =
      +printBN(bnX, position.tokenX.decimals) *
      (pricesData.data[position.tokenX.assetAddress.toString()] ?? 0)
    const yValue =
      +printBN(bnY, position.tokenY.decimals) *
      (pricesData.data[position.tokenY.assetAddress.toString()] ?? 0)

    const unclaimedFeesInUSD = xValue + yValue
    return {
      usdValue: unclaimedFeesInUSD,
      isClaimAvailable:
        +printBN(bnX, position.tokenX.decimals) > 0 || +printBN(bnY, position.tokenY.decimals) > 0
    }
  }

  const data: IPositionItem[] = useMemo(
    () =>
      list.map(position => {
        const lowerPrice = calcYPerXPriceBySqrtPrice(
          calculatePriceSqrt(position.lowerTickIndex),
          position.tokenX.decimals,
          position.tokenY.decimals
        )
        const upperPrice = calcYPerXPriceBySqrtPrice(
          calculatePriceSqrt(position.upperTickIndex),
          position.tokenX.decimals,
          position.tokenY.decimals
        )

        const minTick = getMinTick(position.poolData.tickSpacing)
        const maxTick = getMaxTick(position.poolData.tickSpacing)

        const min = Math.min(lowerPrice, upperPrice)
        const max = Math.max(lowerPrice, upperPrice)

        let tokenXLiq, tokenYLiq

        try {
          tokenXLiq = +printBN(
            getX(
              position.liquidity,
              calculatePriceSqrt(position.upperTickIndex),
              position.poolData.sqrtPrice,
              calculatePriceSqrt(position.lowerTickIndex)
            ),
            position.tokenX.decimals
          )
        } catch {
          tokenXLiq = 0
        }

        try {
          tokenYLiq = +printBN(
            getY(
              position.liquidity,
              calculatePriceSqrt(position.upperTickIndex),
              position.poolData.sqrtPrice,
              calculatePriceSqrt(position.lowerTickIndex)
            ),
            position.tokenY.decimals
          )
        } catch {
          tokenYLiq = 0
        }

        const currentPrice = calcYPerXPriceBySqrtPrice(
          position.poolData.sqrtPrice,
          position.tokenX.decimals,
          position.tokenY.decimals
        )

        const valueX = tokenXLiq + tokenYLiq / currentPrice
        const valueY = tokenYLiq + tokenXLiq * currentPrice

        const { usdValue, isClaimAvailable } = calculateUnclaimedFees(position)
        return {
          tokenXName: position.tokenX.symbol,
          isUnknownX: position.tokenX.isUnknown ?? false,
          isUnknownY: position.tokenY.isUnknown ?? false,
          tokenYName: position.tokenY.symbol,
          tokenXIcon: position.tokenX.logoURI,
          tokenYIcon: position.tokenY.logoURI,
          poolAddress: position.poolData.address,
          liquidity: position.liquidity,
          poolData: position.poolData,
          fee: +printBN(position.poolData.fee, DECIMAL - 2),
          min,
          max,
          position,
          valueX,
          valueY,
          address: walletAddress.toString(),
          id: position.id.toString() + '_' + position.pool.toString(),
          isActive: currentPrice >= min && currentPrice <= max,
          currentPrice,
          tokenXLiq,
          tokenYLiq,
          network: currentNetwork,
          isFullRange: position.lowerTickIndex === minTick && position.upperTickIndex === maxTick,
          isLocked: position.isLocked,
          unclaimedFeesInUSD: { value: usdValue, loading: position.ticksLoading, isClaimAvailable }
        }
      }),
    [list, pricesData]
  )

  const lockedData: IPositionItem[] = useMemo(
    () =>
      lockedList.map(position => {
        const lowerPrice = calcYPerXPriceBySqrtPrice(
          calculatePriceSqrt(position.lowerTickIndex),
          position.tokenX.decimals,
          position.tokenY.decimals
        )
        const upperPrice = calcYPerXPriceBySqrtPrice(
          calculatePriceSqrt(position.upperTickIndex),
          position.tokenX.decimals,
          position.tokenY.decimals
        )

        const minTick = getMinTick(position.poolData.tickSpacing)
        const maxTick = getMaxTick(position.poolData.tickSpacing)

        const min = Math.min(lowerPrice, upperPrice)
        const max = Math.max(lowerPrice, upperPrice)

        let tokenXLiq, tokenYLiq

        try {
          tokenXLiq = +printBN(
            getX(
              position.liquidity,
              calculatePriceSqrt(position.upperTickIndex),
              position.poolData.sqrtPrice,
              calculatePriceSqrt(position.lowerTickIndex)
            ),
            position.tokenX.decimals
          )
        } catch {
          tokenXLiq = 0
        }

        try {
          tokenYLiq = +printBN(
            getY(
              position.liquidity,
              calculatePriceSqrt(position.upperTickIndex),
              position.poolData.sqrtPrice,
              calculatePriceSqrt(position.lowerTickIndex)
            ),
            position.tokenY.decimals
          )
        } catch {
          tokenYLiq = 0
        }

        const currentPrice = calcYPerXPriceBySqrtPrice(
          position.poolData.sqrtPrice,
          position.tokenX.decimals,
          position.tokenY.decimals
        )

        const valueX = tokenXLiq + tokenYLiq / currentPrice
        const valueY = tokenYLiq + tokenXLiq * currentPrice

        const { usdValue, isClaimAvailable } = calculateUnclaimedFees(position)
        return {
          tokenXName: position.tokenX.symbol,
          tokenYName: position.tokenY.symbol,
          isUnknownX: position.tokenX.isUnknown ?? false,
          isUnknownY: position.tokenY.isUnknown ?? false,
          tokenXIcon: position.tokenX.logoURI,
          tokenYIcon: position.tokenY.logoURI,
          fee: +printBN(position.poolData.fee, DECIMAL - 2),
          min,
          max,
          valueX,
          position,
          valueY,
          poolAddress: position.poolData.address,
          liquidity: position.liquidity,
          poolData: position.poolData,
          address: walletAddress.toString(),
          id: position.id.toString() + '_' + position.pool.toString(),
          isActive: currentPrice >= min && currentPrice <= max,
          currentPrice,
          tokenXLiq,
          tokenYLiq,
          network: currentNetwork,
          isFullRange: position.lowerTickIndex === minTick && position.upperTickIndex === maxTick,
          isLocked: position.isLocked,
          unclaimedFeesInUSD: { value: usdValue, loading: position.ticksLoading, isClaimAvailable }
        }
      }),
    [lockedList, pricesData]
  )
  const handleSnackbar = (message: string, variant: VariantType) => {
    dispatch(
      snackbarsActions.add({
        message: message,
        variant: variant,
        persist: false
      })
    )
  }

  const onAddPositionClick = () => {
    dispatch(navigationActions.setNavigation({ address: location.pathname }))
    if (maxToken) {
      const strategy = findStrategy(maxToken.id.toString())
      navigate(
        ROUTES.getNewPositionRoute(strategy.tokenAddressA, strategy.tokenAddressB, strategy.feeTier)
      )
    } else
      navigate(
        ROUTES.getNewPositionRoute(
          DEFAULT_STRATEGY.tokenA,
          DEFAULT_STRATEGY.tokenB,
          DEFAULT_STRATEGY.feeTier
        )
      )
  }

  const [positionId, setPositionId] = useState('')
  const [tokenXPriceData, setTokenXPriceData] = useState<TokenPriceData | undefined>(undefined)
  const [tokenYPriceData, setTokenYPriceData] = useState<TokenPriceData | undefined>(undefined)

  const singlePosition = useSelector(singlePositionData(positionId))
  const positionPreview = useSelector(positionWithPoolData)
  const position = singlePosition ?? positionPreview ?? undefined

  const tokens = useSelector(poolTokens)
  const poolsList = useSelector(poolsArraySortedByFees)
  const autoSwapPoolData = useSelector(poolsSelectors.autoSwapPool)
  const { ticks: autoSwapTicks, tickmap: autoSwapTickMap } = useSelector(autoSwapTicksAndTickMap)
  const isLoadingAutoSwapPool = useSelector(poolsSelectors.isLoadingAutoSwapPool)
  const isLoadingAutoSwapPoolTicksOrTickMap = useSelector(
    poolsSelectors.isLoadingAutoSwapPoolTicksOrTickMap
  )
  const { success: changeLiquiditySuccess, inProgress: changeLiquidityInProgress } =
    useSelector(changeLiquidity)
  const isTimeoutError = useSelector(timeoutError)
  const { allData: ticksData, loading: ticksLoading } = useSelector(plotTicks)

  const tokenXLiquidity = useMemo(() => {
    if (position) {
      try {
        return +printBN(
          getX(
            position.liquidity,
            calculatePriceSqrt(position.upperTickIndex),
            position.poolData.sqrtPrice,
            calculatePriceSqrt(position.lowerTickIndex)
          ),
          position.tokenX.decimals
        )
      } catch {
        return 0
      }
    }

    return 0
  }, [position])

  const tokenYLiquidity = useMemo(() => {
    if (position) {
      try {
        return +printBN(
          getY(
            position.liquidity,
            calculatePriceSqrt(position.upperTickIndex),
            position.poolData.sqrtPrice,
            calculatePriceSqrt(position.lowerTickIndex)
          ),
          position.tokenY.decimals
        )
      } catch {
        return 0
      }
    }

    return 0
  }, [position])

  const [tokenXClaim, tokenYClaim] = useMemo(() => {
    if (
      position?.ticksLoading === false &&
      position?.poolData &&
      typeof position?.lowerTick !== 'undefined' &&
      typeof position?.upperTick !== 'undefined'
    ) {
      const [bnX, bnY] = calculateClaimAmount({
        position,
        tickLower: position.lowerTick,
        tickUpper: position.upperTick,
        tickCurrent: position.poolData.currentTickIndex,
        feeGrowthGlobalX: position.poolData.feeGrowthGlobalX,
        feeGrowthGlobalY: position.poolData.feeGrowthGlobalY
      })

      return [+printBN(bnX, position.tokenX.decimals), +printBN(bnY, position.tokenY.decimals)]
    }

    return [0, 0]
  }, [position])

  useEffect(() => {
    if (!position) {
      return
    }
    const xAddr = position.tokenX.assetAddress.toString()
    setTokenXPriceData({
      price: prices[xAddr] ?? getMockedTokenPrice(position.tokenX.symbol, currentNetwork)
    })

    const yAddr = position.tokenY.assetAddress.toString()
    setTokenYPriceData({
      price: prices[yAddr] ?? getMockedTokenPrice(position.tokenY.symbol, currentNetwork)
    })
  }, [position?.id])

  const min = useMemo(
    () =>
      position
        ? calcYPerXPriceBySqrtPrice(
            calculatePriceSqrt(position.lowerTickIndex),
            position.tokenX.decimals,
            position.tokenY.decimals
          )
        : 0,
    [position?.lowerTickIndex, position?.id.toString()]
  )
  const max = useMemo(
    () =>
      position
        ? calcYPerXPriceBySqrtPrice(
            calculatePriceSqrt(position.upperTickIndex),
            position.tokenX.decimals,
            position.tokenY.decimals
          )
        : 0,
    [position?.upperTickIndex, position?.id.toString()]
  )
  const current = useMemo(
    () =>
      position?.poolData
        ? calcPriceBySqrtPrice(
            position.poolData.sqrtPrice,
            true,
            position.tokenX.decimals,
            position.tokenY.decimals
          )
        : 0,
    [position, position?.id.toString()]
  )

  const leftRange = useMemo(() => {
    if (position) {
      return {
        index: position.lowerTickIndex,
        x: calcPriceByTickIndex(
          position.lowerTickIndex,
          true,
          position.tokenX.decimals,
          position.tokenY.decimals
        )
      }
    }

    return {
      index: 0,
      x: 0
    }
  }, [position?.id])

  const rightRange = useMemo(() => {
    if (position) {
      return {
        index: position.upperTickIndex,
        x: calcPriceByTickIndex(
          position.upperTickIndex,
          true,
          position.tokenX.decimals,
          position.tokenY.decimals
        )
      }
    }

    return {
      index: 0,
      x: 0
    }
  }, [position?.id])

  const getPoolData = (pair: Pair) => {
    dispatch(poolsActions.getPoolData(pair))
  }

  const setShouldNotUpdateRange = () => {
    dispatch(positionsActions.setShouldNotUpdateRange(true))
  }

  const setChangeLiquiditySuccess = (value: boolean) => {
    dispatch(positionsActions.setChangeLiquiditySuccess(value))
  }

  useEffect(() => {
    if (isChangeLiquidityModalShown) {
      blurContent()
    } else {
      unblurContent()
    }
  }, [isChangeLiquidityModalShown])

  const openPosition = (id: string) => {
    setPositionId(id)
    setIsChangeLiquidityModalShown(true)
  }
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      dispatch(actions.setPrices(prices))
    }
  }, [prices])

  useEffect(() => {
    const loadPrices = async (): Promise<void> => {
      const prices = await getTokenPrice(currentNetwork)
      if (prices) {
        const transformedPrices = Object.fromEntries(
          Object.entries(prices).map(([key, value]) => [key, value.price])
        )

        setPrices(transformedPrices)
      }
    }

    loadPrices()
  }, [])
  return isConnected ? (
    <Portfolio
      prices={prices}
      selectedFilters={searchParamsToken.filteredTokens}
      setSelectedFilters={setSearchTokensValue}
      shouldDisable={disabledButton}
      isBalanceLoading={isBalanceLoading}
      handleSnackbar={handleSnackbar}
      initialPage={lastPage}
      setLastPage={setLastPage}
      handleRefresh={handleRefresh}
      onAddPositionClick={onAddPositionClick}
      currentNetwork={currentNetwork}
      data={data}
      lockedData={lockedData}
      loading={isLoading}
      showNoConnected={!isConnected}
      itemsPerPage={POSITIONS_PER_PAGE}
      noConnectedBlockerProps={{
        title: 'Start exploring liquidity pools right now!',
        descCustomText: 'Or, connect your wallet to see existing positions, and create a new one!'
      }}
      length={list.length}
      lockedLength={lockedList.length}
      handleLockPosition={handleLockPosition}
      handleClosePosition={handleClosePosition}
      handleClaimFee={handleClaimFee}
      positionListAlignment={positionListAlignment}
      setPositionListAlignment={(positionType: LiquidityPools) =>
        dispatch(actions.setPositionListSwitcher(positionType))
      }
      overviewSelectedTab={overviewSelectedTab}
      handleOverviewSwitch={option => dispatch(walletActions.setOverviewSwitch(option))}
      processedTokens={processedTokens}
      isProcesing={isProcesing}
      tokenXAddress={position?.tokenX.assetAddress ?? new PublicKey(WRAPPED_FOGO_ADDRESS)}
      tokenYAddress={position?.tokenY.assetAddress ?? new PublicKey(WRAPPED_FOGO_ADDRESS)}
      leftRange={leftRange}
      rightRange={rightRange}
      tokens={tokens}
      allPools={poolsList}
      currentPrice={current}
      tokenX={{
        name: position?.tokenX.symbol || '',
        icon: position?.tokenX.logoURI || '',
        decimal: position?.tokenX.decimals || 0,
        balance: +printBN(position?.tokenX.balance, position?.tokenX.decimals || 0),
        liqValue: tokenXLiquidity,
        claimValue: tokenXClaim,
        usdValue:
          typeof tokenXPriceData?.price === 'undefined'
            ? undefined
            : tokenXPriceData.price *
              +printBN(position?.tokenX.balance, position?.tokenX.decimals || 0)
      }}
      tokenXPriceData={tokenXPriceData}
      tokenY={{
        name: position?.tokenY.symbol || '',
        icon: position?.tokenY.logoURI || '',
        decimal: position?.tokenY.decimals || 0,
        balance: +printBN(position?.tokenY.balance, position?.tokenY.decimals || 0),
        liqValue: tokenYLiquidity,
        claimValue: tokenYClaim,
        usdValue:
          typeof tokenYPriceData?.price === 'undefined'
            ? undefined
            : tokenYPriceData.price *
              +printBN(position?.tokenY.balance, position?.tokenY.decimals || 0)
      }}
      tokenYPriceData={tokenYPriceData}
      fee={position?.poolData.fee}
      min={min}
      max={max}
      ticksLoading={ticksLoading || !position}
      getPoolData={getPoolData}
      setShouldNotUpdateRange={setShouldNotUpdateRange}
      autoSwapPoolData={autoSwapPoolData}
      autoSwapTicks={autoSwapTicks}
      autoSwapTickMap={autoSwapTickMap}
      isLoadingAutoSwapPool={isLoadingAutoSwapPool}
      isLoadingAutoSwapPoolTicksOrTickMap={isLoadingAutoSwapPoolTicksOrTickMap}
      ticksData={ticksData}
      changeLiquiditySuccess={changeLiquiditySuccess}
      changeLiquidityInProgress={changeLiquidityInProgress}
      setChangeLiquiditySuccess={setChangeLiquiditySuccess}
      reloadHandler={() => {
        if (!position) {
          return
        }

        dispatch(
          actions.getCurrentPlotTicks({
            poolIndex: position.poolData.poolIndex,
            isXtoY: true
          })
        )
      }}
      isTimeoutError={isTimeoutError}
      changeLiquidity={(liquidity, slippage, isAddLiquidity, isClosePosition, xAmount, yAmount) => {
        if (!position) {
          return
        }

        if (isAddLiquidity) {
          console.log(xAmount)
          console.log(yAmount)
          dispatch(
            actions.addLiquidity({
              positionIndex: position.positionIndex,
              liquidity,
              slippage,
              isClosePosition,
              xAmount,
              yAmount
            })
          )
        } else {
          dispatch(
            actions.removeLiquidity({
              positionIndex: position.positionIndex,
              liquidity,
              slippage,
              isClosePosition,
              xAmount,
              yAmount,
              onSuccess: () => {
                navigate(ROUTES.PORTFOLIO)

                setIsChangeLiquidityModalShown(false)
              }
            })
          )
        }
      }}
      swapAndAddLiquidity={(
        xAmount,
        yAmount,
        swapAmount,
        xToY,
        byAmountIn,
        estimatedPriceAfterSwap,
        crossedTicks,
        swapSlippage,
        positionSlippage,
        minUtilizationPercentage,
        poolIndex,
        liquidity
      ) => {
        if (!autoSwapPoolData || !autoSwapTickMap || !position) {
          return
        }

        dispatch(
          actions.swapAndAddLiquidity({
            xAmount,
            yAmount,
            tokenX:
              (xToY ? position?.tokenX : position?.tokenY)?.assetAddress ||
              new PublicKey(WRAPPED_FOGO_ADDRESS),
            tokenY:
              (xToY ? position?.tokenY : position?.tokenX)?.assetAddress ||
              new PublicKey(WRAPPED_FOGO_ADDRESS),
            swapAmount,
            byAmountIn,
            xToY,
            swapPool: autoSwapPoolData,
            swapPoolTickmap: autoSwapTickMap,
            swapSlippage,
            estimatedPriceAfterSwap,
            crossedTicks,
            positionPair: {
              fee: position.poolData.fee,
              tickSpacing: position.poolData.tickSpacing
            },
            positionPoolIndex: poolIndex,
            positionPoolPrice: position.poolData.sqrtPrice,
            positionSlippage,
            lowerTick: position.lowerTickIndex,
            upperTick: position.upperTickIndex,
            liquidityDelta: liquidity,
            minUtilizationPercentage,
            isSamePool: position.poolData.address.equals(autoSwapPoolData.address),
            positionIndex: position.positionIndex
          })
        )
      }}
      positionLiquidity={position?.liquidity}
      isChangeLiquidityModalShown={isChangeLiquidityModalShown}
      setIsChangeLiquidityModalShown={setIsChangeLiquidityModalShown}
      isAddLiquidity={isAddLiquidity}
      setIsAddLiquidity={setIsAddLiquidity}
      openPosition={openPosition}
      isConnected={isConnected}
      onConnectWallet={() => {
        dispatch(walletActions.connect(false))
      }}
    />
  ) : (
    <Grid className={classes.emptyContainer}>
      <EmptyPlaceholder
        newVersion
        themeDark
        style={isSm ? { paddingTop: 8 } : {}}
        roundedCorners={true}
        mainTitle='Wallet is not connected'
        desc='No liquidity positions to show'
        withButton={false}
        connectButton={true}
        walletConnected={isConnected}
        onConnectWallet={() => {
          dispatch(walletActions.connect(false))
        }}
        onDisconnectWallet={() => {
          dispatch(walletActions.disconnect())
        }}
      />
    </Grid>
  )
}

export default PortfolioWrapper
