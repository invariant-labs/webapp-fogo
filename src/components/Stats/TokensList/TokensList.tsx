import TokenListItem from '../TokenListItem/TokenListItem'
import React, { useEffect, useMemo, useState } from 'react'
import { colors, theme } from '@static/theme'
import { Grid, useMediaQuery } from '@mui/material'
import {
  BTC_TEST,
  Intervals,
  ITEMS_PER_PAGE,
  NetworkType,
  SortTypeTokenList,
  USDC_TEST,
  WFOGO_TEST
} from '@store/consts/static'
import { InputPagination } from '@common/Pagination/InputPagination/InputPagination'
import { VariantType } from 'notistack'
import { Keypair } from '@solana/web3.js'
import { useDispatch, useSelector } from 'react-redux'
import { tokenSearch } from '@store/selectors/navigation'
import { actions } from '@store/reducers/navigation'
import { EmptyPlaceholder } from '@common/EmptyPlaceholder/EmptyPlaceholder'
import { useStyles } from './style'

export interface ITokensListData {
  icon: string
  name: string
  symbol: string
  price: number
  volume: number
  TVL: number
  address: string
  isFavourite: boolean
  isUnknown: boolean
}

export interface ITokensList {
  initialLength: number
  data: ITokensListData[]
  network: NetworkType
  copyAddressHandler: (message: string, variant: VariantType) => void
  isLoading: boolean
  interval: Intervals
  switchFavouriteTokens: (tokenAddress: string) => void
}

const tokens = [BTC_TEST, USDC_TEST, WFOGO_TEST]

const generateMockData = () => {
  return Array.from({ length: ITEMS_PER_PAGE }, (_, index) => ({
    icon: tokens[index % tokens.length].logoURI,
    name: tokens[index % tokens.length].name,
    symbol: tokens[index % tokens.length].symbol,
    price: Math.random() * 100,
    volume: Math.random() * 10000,
    TVL: Math.random() * 10000,
    address: Keypair.generate().publicKey.toString(),
    isUnknown: false,
    isFavourite: false
  }))
}

const TokensList: React.FC<ITokensList> = ({
  data,
  initialLength,
  network,
  copyAddressHandler,
  isLoading,
  interval,
  switchFavouriteTokens
}) => {
  const [initialDataLength, setInitialDataLength] = useState(initialLength)
  const { classes, cx } = useStyles()
  const dispatch = useDispatch()
  const searchParams = useSelector(tokenSearch)
  const page = searchParams.pageNumber
  const [sortType, setSortType] = React.useState(searchParams.sortType)

  useEffect(() => {
    dispatch(actions.setSearch({ section: 'statsTokens', type: 'sortType', sortType }))
  }, [sortType])

  const isXsDown = useMediaQuery(theme.breakpoints.down('xs'))

  const sortedData = useMemo(() => {
    if (isLoading) {
      return generateMockData()
    }

    switch (sortType) {
      case SortTypeTokenList.NAME_ASC:
        return data.sort((a, b) =>
          isXsDown
            ? a.symbol.localeCompare(b.symbol)
            : `${a.name} (${a.symbol})`.localeCompare(`${b.name} (${b.symbol})`)
        )
      case SortTypeTokenList.NAME_DESC:
        return data.sort((a, b) =>
          isXsDown
            ? b.symbol.localeCompare(a.symbol)
            : `${b.name} (${b.symbol})`.localeCompare(`${a.name} (${a.symbol})`)
        )
      case SortTypeTokenList.PRICE_ASC:
        return data.sort((a, b) => a.price - b.price)
      case SortTypeTokenList.PRICE_DESC:
        return data.sort((a, b) => b.price - a.price)
      // case SortTypeTokenList.CHANGE_ASC:
      //   return data.sort((a, b) => a.priceChange - b.priceChange)
      // case SortTypeTokenList.CHANGE_DESC:
      //   return data.sort((a, b) => b.priceChange - a.priceChange)
      case SortTypeTokenList.VOLUME_ASC:
        return data.sort((a, b) => (a.volume === b.volume ? a.TVL - b.TVL : a.volume - b.volume))
      case SortTypeTokenList.VOLUME_DESC:
        return data.sort((a, b) => (a.volume === b.volume ? b.TVL - a.TVL : b.volume - a.volume))
      case SortTypeTokenList.TVL_ASC:
        return data.sort((a, b) => (a.TVL === b.TVL ? a.volume - b.volume : a.TVL - b.TVL))
      case SortTypeTokenList.TVL_DESC:
        return data.sort((a, b) => (a.TVL === b.TVL ? b.volume - a.volume : b.TVL - a.TVL))
    }
  }, [data, sortType, isXsDown])
  useEffect(() => {
    setInitialDataLength(initialLength)
  }, [initialLength])

  const handleChangePagination = (newPage: number) => {
    dispatch(
      actions.setSearch({
        section: 'statsTokens',
        type: 'pageNumber',
        pageNumber: newPage
      })
    )
  }

  const getEmptyRowsCount = () => {
    const displayedItems = paginator(page).data.length
    const rowNumber = initialDataLength < ITEMS_PER_PAGE ? initialDataLength : ITEMS_PER_PAGE

    return Math.max(rowNumber - displayedItems, 0)
  }

  function paginator(currentPage: number) {
    const page = currentPage || 1
    const offset = (page - 1) * ITEMS_PER_PAGE
    const paginatedItems = sortedData.slice(offset).slice(0, ITEMS_PER_PAGE)
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE)

    return {
      page: page,
      totalPages: totalPages,
      data: paginatedItems
    }
  }

  const totalItems = useMemo(() => sortedData.length, [sortedData])
  const lowerBound = useMemo(() => (page - 1) * ITEMS_PER_PAGE + 1, [page])
  const upperBound = useMemo(() => Math.min(page * ITEMS_PER_PAGE, totalItems), [totalItems, page])

  const pages = useMemo(() => Math.ceil(data.length / ITEMS_PER_PAGE), [data])
  const isCenterAligment = useMediaQuery(theme.breakpoints.down(1280))
  const height = useMemo(
    () => (initialDataLength > ITEMS_PER_PAGE ? (isCenterAligment ? 176 : 90) : 69),
    [initialDataLength, isCenterAligment]
  )

  return (
    <Grid
      container
      classes={{ root: classes.container }}
      className={cx({ [classes.loadingOverlay]: isLoading })}>
      <>
        <TokenListItem
          displayType='header'
          onSort={setSortType}
          sortType={sortType}
          interval={interval}
        />
        {data.length > 0 || isLoading ? (
          <>
            {paginator(page).data.map((token, index) => {
              return (
                <TokenListItem
                  key={index}
                  displayType='tokens'
                  itemNumber={index + 1 + (page - 1) * ITEMS_PER_PAGE}
                  icon={token.icon}
                  name={token.name}
                  symbol={token.symbol}
                  price={token.price}
                  // priceChange={token.priceChange}
                  volume={token.volume}
                  TVL={token.TVL}
                  address={token.address}
                  isUnknown={token.isUnknown}
                  network={network}
                  copyAddressHandler={copyAddressHandler}
                  interval={interval}
                  isFavourite={token.isFavourite}
                  switchFavouriteTokens={switchFavouriteTokens}
                />
              )
            })}
            {getEmptyRowsCount() > 0 &&
              new Array(getEmptyRowsCount()).fill('').map((_, index) => (
                <div
                  key={`empty-row-${index}`}
                  style={{
                    borderBottom:
                      getEmptyRowsCount() - 1 === index
                        ? `2px solid ${colors.invariant.light}`
                        : `0px solid ${colors.invariant.light}`
                  }}
                  className={cx(classes.emptyRow)}
                />
              ))}
          </>
        ) : (
          <Grid container className={classes.emptyContainer}>
            <EmptyPlaceholder
              height={initialDataLength < ITEMS_PER_PAGE ? initialDataLength * 69 : 688}
              newVersion
              mainTitle={`You don't have any favourite tokens yet...`}
              desc={'You can add them by clicking the star icon next to the token!'}
              withButton={false}
            />
          </Grid>
        )}
        <Grid
          className={classes.pagination}
          sx={{
            height: height
          }}>
          {pages > 1 && (
            <InputPagination
              pages={pages}
              defaultPage={page}
              handleChangePage={handleChangePagination}
              variant='center'
              page={page}
              borderTop={false}
              pagesNumeration={{
                lowerBound: lowerBound,
                totalItems: totalItems,
                upperBound: upperBound
              }}
            />
          )}
        </Grid>
      </>
    </Grid>
  )
}

export default TokensList
