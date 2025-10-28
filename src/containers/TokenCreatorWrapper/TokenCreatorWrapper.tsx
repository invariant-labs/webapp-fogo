import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { network } from '@store/selectors/solanaConnection'
import { balance, status } from '@store/selectors/solanaWallet'
import { actions } from '@store/reducers/creator'
import { actions as walletActions } from '@store/reducers/solanaWallet'
import { creatorState } from '@store/selectors/creator'
import { TokenCreator } from '@components/TokenCreator/TokenCreator'
import { validateDecimals, validateSupply } from '@utils/tokenCreatorUtils'
import { FormData } from '@store/consts/tokenCreator/types'
import { ensureError } from '@utils/utils'
import { isSessionActive } from '@store/hooks/session'
import { ALLOW_SESSIONS } from '@store/consts/static'
import { Status } from '@store/reducers/solanaWallet'

export const TokenCreatorWrapper: React.FC = () => {
  const currentNetwork = useSelector(network)
  const fogoBalance = useSelector(balance)
  const isConnected = ALLOW_SESSIONS
    ? isSessionActive()
    : useSelector(status) === Status.Initialized

  const { success, inProgress } = useSelector(creatorState)

  const dispatch = useDispatch()

  const buttonText = useMemo(() => (isConnected ? 'Create token' : 'Connect wallet'), [isConnected])

  const onSubmit = (data: FormData) => {
    try {
      const decimalsError = validateDecimals(data.decimals)
      if (decimalsError) {
        throw new Error(decimalsError)
      }

      const supplyError = validateSupply(data.supply, data.decimals)
      if (supplyError) {
        throw new Error(supplyError)
      }

      dispatch(actions.createToken({ data, network: currentNetwork }))
    } catch (e: unknown) {
      const error = ensureError(e)
      console.error('Error submitting form:', error)
    }
  }

  return (
    <TokenCreator
      buttonText={buttonText}
      currentNetwork={currentNetwork}
      fogoBalance={fogoBalance}
      inProgress={inProgress}
      onSubmit={onSubmit}
      success={success}
      isConnected={isConnected}
      onConnectWallet={() => {
        dispatch(walletActions.connect(false))
      }}
    />
  )
}
