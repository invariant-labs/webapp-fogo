import Header from '@components/Header/Header'
import { RPC, CHAINS, RECOMMENDED_RPC_ADDRESS, NetworkType } from '@store/consts/static'
import { actions, RpcStatus } from '@store/reducers/solanaConnection'
import { actions as walletActions } from '@store/reducers/solanaWallet'
import { network, rpcAddress, rpcStatus } from '@store/selectors/solanaConnection'
import { address, balance, thankYouModalShown } from '@store/selectors/solanaWallet'
import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { actions as snackbarsActions } from '@store/reducers/snackbars'
import { Chain } from '@store/consts/types'
import { RpcErrorModal } from '@components/RpcErrorModal/RpcErrorModal'
import { ThankYouModal } from '@components/Modals/ThankYouModal/ThankYouModal'
import { ensureError, generateHash, ROUTES } from '@utils/utils'
import { isSessionActive } from '@store/hooks/session'

export const HeaderWrapper: React.FC = () => {
  const dispatch = useDispatch()
  const currentNetwork = useSelector(network)
  const currentRpc = useSelector(rpcAddress)
  const isThankYouModalShown = useSelector(thankYouModalShown)
  const walletBalance = useSelector(balance)
  const location = useLocation()
  const walletAddress = useSelector(address)
  const navigate = useNavigate()
  const walletConnected = isSessionActive()

  const hideThankYouModal = () => {
    dispatch(walletActions.showThankYouModal(false))
  }
  useEffect(() => {
    const debugHeadings = () => {
      const headings = document.querySelectorAll('._heading_1ifo2_557')

      headings.forEach((heading, index) => {
        console.log(`Heading ${index}:`, {
          text: heading.textContent,
          innerHTML: heading.innerHTML,
          element: heading
        })
      })
    }

    setTimeout(debugHeadings, 1000)
  }, [])
  useEffect(() => {
    if (currentNetwork === NetworkType.Devnet) {
      dispatch(actions.setNetwork(NetworkType.Testnet))
      dispatch(actions.setRPCAddress(RPC.TEST))
    }
  }, [])

  const shouldResetRpc = useMemo(() => {
    const STORAGE_KEY = 'INVARIANT_RPC_HASH'

    const currentAddresses =
      RECOMMENDED_RPC_ADDRESS[NetworkType.Mainnet] +
      RECOMMENDED_RPC_ADDRESS[NetworkType.Testnet] +
      RECOMMENDED_RPC_ADDRESS[NetworkType.Devnet]

    const currentHash = generateHash(currentAddresses)

    try {
      const storedHash = localStorage.getItem(STORAGE_KEY)

      if (storedHash === null || currentHash !== storedHash) {
        localStorage.setItem(STORAGE_KEY, currentHash)
        return true
      }

      return false
    } catch (e: unknown) {
      const error = ensureError(e)
      console.error('Error accessing localStorage:', error)
      return true
    }
  }, [])

  const defaultTestnetRPC = useMemo(() => {
    const lastRPC = localStorage.getItem(`INVARIANT_RPC_Fogo_${NetworkType.Testnet}`)

    if (lastRPC === null || shouldResetRpc) {
      localStorage.setItem(
        `INVARIANT_RPC_Fogo_${NetworkType.Testnet}`,
        RECOMMENDED_RPC_ADDRESS[NetworkType.Testnet]
      )
      dispatch(actions.setRPCAddress(RECOMMENDED_RPC_ADDRESS[currentNetwork]))
      dispatch(actions.setRpcStatus(RpcStatus.Uninitialized))
    }
    return lastRPC === null || shouldResetRpc ? RPC.TEST : lastRPC
  }, [shouldResetRpc])

  const defaultMainnetRPC = useMemo(() => {
    const lastRPC = localStorage.getItem(`INVARIANT_RPC_Fogo_${NetworkType.Mainnet}`)

    if (lastRPC === null || shouldResetRpc) {
      localStorage.setItem(
        `INVARIANT_RPC_Fogo_${NetworkType.Mainnet}`,
        RECOMMENDED_RPC_ADDRESS[NetworkType.Mainnet]
      )
      dispatch(actions.setRPCAddress(RECOMMENDED_RPC_ADDRESS[currentNetwork]))
      dispatch(actions.setRpcStatus(RpcStatus.Uninitialized))
    }

    return lastRPC === null || shouldResetRpc ? RPC.MAIN : lastRPC
  }, [shouldResetRpc])

  const activeChain = CHAINS.find(chain => chain.name === Chain.Fogo) ?? CHAINS[0]

  const currentRpcStatus = useSelector(rpcStatus)

  const useDefaultRpc = () => {
    localStorage.setItem(
      `INVARIANT_RPC_Fogo_${currentNetwork}`,
      RECOMMENDED_RPC_ADDRESS[currentNetwork]
    )
    dispatch(actions.setRPCAddress(RECOMMENDED_RPC_ADDRESS[currentNetwork]))
    dispatch(actions.setRpcStatus(RpcStatus.Uninitialized))
    localStorage.setItem('IS_RPC_WARNING_IGNORED', 'false')
    window.location.reload()
  }

  const useCurrentRpc = () => {
    dispatch(actions.setRpcStatus(RpcStatus.IgnoredWithError))
    localStorage.setItem('IS_RPC_WARNING_IGNORED', 'true')
  }

  return (
    <>
      {currentRpcStatus === RpcStatus.Error &&
        currentRpc !== RECOMMENDED_RPC_ADDRESS[currentNetwork] && (
          <RpcErrorModal
            rpcAddress={currentRpc}
            useDefaultRpc={useDefaultRpc}
            useCurrentRpc={useCurrentRpc}
          />
        )}
      {isThankYouModalShown && <ThankYouModal hideModal={hideThankYouModal} />}
      <Header
        address={walletAddress}
        onNetworkSelect={(network, rpcAddress) => {
          if (rpcAddress && rpcAddress !== currentRpc) {
            localStorage.setItem(`INVARIANT_RPC_Fogo_${network}`, rpcAddress)
            dispatch(actions.setRPCAddress(rpcAddress))
            dispatch(actions.setRpcStatus(RpcStatus.Uninitialized))
            localStorage.setItem('IS_RPC_WARNING_IGNORED', 'false')
            window.location.reload()
          }

          if (network !== currentNetwork) {
            if (location.pathname.startsWith(ROUTES.EXCHANGE)) {
              navigate(ROUTES.EXCHANGE)
            }

            if (location.pathname.startsWith(ROUTES.NEW_POSITION)) {
              navigate(ROUTES.NEW_POSITION)
            }

            dispatch(actions.setNetwork(network))
          }
        }}
        onConnectWallet={() => {
          dispatch(walletActions.connect(false))
        }}
        landing={location.pathname.substring(1)}
        walletConnected={walletConnected}
        onDisconnectWallet={() => {
          dispatch(walletActions.disconnect())
        }}
        onFaucet={() => dispatch(walletActions.airdrop())}
        typeOfNetwork={currentNetwork}
        rpc={currentRpc}
        defaultTestnetRPC={defaultTestnetRPC}
        onCopyAddress={() => {
          navigator.clipboard.writeText(walletAddress.toString())

          dispatch(
            snackbarsActions.add({
              message: 'Wallet address copied',
              variant: 'success',
              persist: false
            })
          )
        }}
        activeChain={activeChain}
        onChainSelect={chain => {
          if (chain.name !== activeChain.name) {
            window.location.replace(chain.address)
          }
        }}
        network={currentNetwork}
        rpcStatus={currentRpcStatus}
        defaultMainnetRPC={defaultMainnetRPC}
        walletBalance={walletConnected ? walletBalance : null}
      />
    </>
  )
}

export default HeaderWrapper
