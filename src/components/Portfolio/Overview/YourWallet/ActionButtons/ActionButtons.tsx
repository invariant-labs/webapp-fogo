import { TooltipHover } from '@common/TooltipHover/TooltipHover'
import { Box } from '@mui/material'
import { horizontalSwapIcon, newTabBtnIcon, plusIcon } from '@static/icons'
import { NetworkType, USDC_MAIN, USDC_TEST, WFOGO_MAIN, WFOGO_TEST } from '@store/consts/static'
import { StrategyConfig, WalletToken } from '@store/types/userOverview'
import { addressToTicker, ROUTES } from '@utils/utils'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { actions } from '@store/reducers/navigation'

interface IActionButtons {
  pool: WalletToken
  strategy: StrategyConfig
  currentNetwork: NetworkType
}

export const ActionButtons = ({ pool, strategy, currentNetwork }: IActionButtons) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()

  const { classes } = useStyles()

  const networkUrl = useMemo(() => {
    switch (currentNetwork) {
      case NetworkType.Mainnet:
        return ''
      case NetworkType.Testnet:
        return '?cluster=testnet'
      case NetworkType.Devnet:
        return '?cluster=devnet'
      default:
        return '?cluster=testnet'
    }
  }, [currentNetwork])

  return (
    <>
      <TooltipHover title='Add position'>
        <Box
          className={classes.actionIcon}
          onClick={() => {
            const sourceToken = addressToTicker(currentNetwork, strategy.tokenAddressA)
            const targetToken = strategy.tokenAddressB
              ? strategy.tokenAddressB
              : sourceToken === 'FOGO'
                ? currentNetwork === NetworkType.Mainnet
                  ? USDC_MAIN.address
                  : USDC_TEST.address
                : currentNetwork === NetworkType.Mainnet
                  ? WFOGO_MAIN.address
                  : WFOGO_TEST.address

            dispatch(actions.setNavigation({ address: location.pathname }))
            navigate(
              ROUTES.getNewPositionRoute(
                sourceToken,
                addressToTicker(currentNetwork, targetToken.toString()),
                strategy.feeTier
              ),
              {
                state: { referer: 'portfolio' }
              }
            )
          }}>
          <img src={plusIcon} height={30} width={30} alt='Add' />
        </Box>
      </TooltipHover>
      <TooltipHover title='Exchange'>
        <Box
          className={classes.actionIcon}
          onClick={() => {
            const sourceToken = addressToTicker(currentNetwork, pool.id.toString())
            const targetToken =
              sourceToken === 'FOGO'
                ? currentNetwork === NetworkType.Mainnet
                  ? USDC_MAIN.address
                  : USDC_TEST.address
                : currentNetwork === NetworkType.Mainnet
                  ? WFOGO_MAIN.address
                  : WFOGO_TEST.address
            navigate(
              ROUTES.getExchangeRoute(
                sourceToken,
                addressToTicker(currentNetwork, targetToken.toString())
              ),

              {
                state: { referer: 'portfolio' }
              }
            )
          }}>
          <img src={horizontalSwapIcon} height={30} width={30} alt='Add' />
        </Box>
      </TooltipHover>
      <TooltipHover title='Open in explorer'>
        <Box
          className={classes.actionIcon}
          onClick={() => {
            window.open(
              `https://explorer.fogo.io/address/${pool.id.toString()}/${networkUrl}`,
              '_blank',
              'noopener,noreferrer'
            )
          }}>
          <img height={30} width={30} src={newTabBtnIcon} alt={'Exchange'} />
        </Box>
      </TooltipHover>
    </>
  )
}
