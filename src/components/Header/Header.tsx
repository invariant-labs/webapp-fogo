import NavbarButton from '@components/Navbar/NavbarButton'
import { CardMedia, Grid, useMediaQuery } from '@mui/material'
import { logoShortIcon, logoTitleIcon } from '@static/icons'
import { theme } from '@static/theme'
import { RPC, NetworkType } from '@store/consts/static'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useStyles from './style'
import { ISelectChain, ISelectNetwork } from '@store/consts/types'
import { RpcStatus } from '@store/reducers/solanaConnection'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { Bar } from '@components/Bar/Bar'
import { ROUTES } from '@utils/utils'
import { isEstablished, useSession } from '@fogo/sessions-sdk-react'
import { getSession, SendTxInput, setSession } from '@store/hooks/session'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { useDispatch } from 'react-redux'

import ChangeWalletButton from './HeaderButton/ChangeWalletButton'
import { actions as walletActions } from '@store/reducers/solanaWallet'

export interface IHeader {
  address: PublicKey
  onNetworkSelect: (networkType: NetworkType, rpcAddress: string, rpcName?: string) => void
  onConnectWallet: () => void
  walletConnected: boolean
  landing: string
  typeOfNetwork: NetworkType
  rpc: string
  onFaucet: () => void
  onDisconnectWallet: () => void
  defaultTestnetRPC: string
  onCopyAddress: () => void
  activeChain: ISelectChain
  onChainSelect: (chain: ISelectChain) => void
  network: NetworkType
  defaultMainnetRPC: string
  rpcStatus: RpcStatus
  walletBalance: BN | null
}

export const Header: React.FC<IHeader> = ({
  onNetworkSelect,
  landing,
  typeOfNetwork,
  rpc,
  onFaucet,
  onChainSelect
}) => {
  const { classes } = useStyles()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))

  const routes = [
    'exchange',
    'liquidity',
    'portfolio',
    // ...(typeOfNetwork === NetworkType.Testnet ? ['creator'] : []),
    'statistics'
  ]

  const otherRoutesToHighlight: Record<string, RegExp[]> = {
    liquidity: [/^liquidity\/*/, /^poolDetails\/*/],
    exchange: [/^exchange\/*/],
    portfolio: [/^portfolio\/*/, /^newPosition\/*/, /^position\/*/]
    // ...(typeOfNetwork === NetworkType.Testnet ? { creator: [/^creator\/*/] } : {})
  }

  const [activePath, setActive] = useState('exchange')
  const [sessionConnected, setSessionConnected] = useState(false)

  useEffect(() => {
    setActive(landing)
  }, [landing])

  const session = useSession()
  const hookSession = getSession()

  useEffect(() => {
    if (isEstablished(session)) {
      dispatch(
        snackbarsActions.add({
          message: 'Wallet connected',
          variant: 'success',
          persist: false
        })
      )

      setSession({
        type: 'Established',
        walletPublicKey: session.walletPublicKey,
        sessionPublicKey: session.sessionPublicKey,
        payer: session.payer,
        adapter: session.adapter,
        sendTransaction: (input: SendTxInput) => session.sendTransaction(input as any)
      })

      setSessionConnected(true)
      dispatch(walletActions.connect(false))
    } else {
      if (sessionConnected) {
        dispatch(
          snackbarsActions.add({
            message: 'Wallet disconnected',
            variant: 'success',
            persist: false
          })
        )

        setSessionConnected(false)
      }
      setSession(null)
      dispatch(walletActions.resetState())
    }
  }, [session])

  const testnetRPCs: ISelectNetwork[] = [
    {
      networkType: NetworkType.Testnet,
      rpc: RPC.TEST,
      rpcName: 'Fogo Testnet'
    }
  ]

  const mainnetRPCs: ISelectNetwork[] = [
    {
      networkType: NetworkType.Mainnet,
      rpc: RPC.MAIN,
      rpcName: 'Fogo'
    }
  ]

  const devnetRPCs: ISelectNetwork[] = []

  const rpcs = [...testnetRPCs, ...mainnetRPCs, ...devnetRPCs]

  return (
    <Grid container>
      <Grid container className={classes.root}>
        <Grid container item className={classes.leftSide}>
          <CardMedia
            className={classes.logo}
            image={logoTitleIcon}
            onClick={() => {
              if (!activePath.startsWith('exchange')) {
                navigate(ROUTES.EXCHANGE)
              }
            }}
          />
        </Grid>

        <Grid
          container
          item
          className={classes.routers}
          sx={{
            display: { lg: 'flex' },
            [theme.breakpoints.down(1200)]: {
              display: 'none'
            }
          }}>
          {routes.map(path => (
            <Link key={`path-${path}`} to={`/${path}`} className={classes.link}>
              <NavbarButton
                name={path}
                onClick={e => {
                  if (path === 'exchange' && activePath.startsWith('exchange')) {
                    e.preventDefault()
                  }

                  setActive(path)
                }}
                active={
                  path === activePath ||
                  (!!otherRoutesToHighlight[path] &&
                    otherRoutesToHighlight[path].some(pathRegex => pathRegex.test(activePath)))
                }
              />
            </Link>
          ))}
        </Grid>

        <Grid container item className={classes.buttons}>
          <CardMedia
            className={classes.logoShort}
            image={logoShortIcon}
            onClick={() => {
              if (!activePath.startsWith('exchange')) {
                navigate(ROUTES.EXCHANGE)
              }
            }}
          />

          <Bar
            rpcs={rpcs}
            activeNetwork={typeOfNetwork}
            activeRPC={rpc}
            onNetworkChange={onNetworkSelect}
            onChainChange={onChainSelect}
            onFaucet={onFaucet}
          />

          <ChangeWalletButton
            address={hookSession?.walletPublicKey?.toString()}
            isSmDown={isSmDown}
            walletConnected={session.type === 7}
            name=''
            enableModal
          />
        </Grid>
      </Grid>
    </Grid>
  )
}
export default Header
