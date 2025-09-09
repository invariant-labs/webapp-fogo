import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { network } from '@store/selectors/solanaConnection'
import { balance } from '@store/selectors/solanaWallet'
import { actions } from '@store/reducers/creator'
import { creatorState } from '@store/selectors/creator'
import { TokenCreator } from '@components/TokenCreator/TokenCreator'
import { validateDecimals, validateSupply } from '@utils/tokenCreatorUtils'
import { FormData } from '@store/consts/tokenCreator/types'
import { ensureError } from '@utils/utils'
import { isSessionActive } from '@store/hooks/session'

export const TokenCreatorWrapper: React.FC = () => {
  const currentNetwork = useSelector(network)
  const fogoBalance = useSelector(balance)
  const isWalletConnected = isSessionActive()

  const { success, inProgress } = useSelector(creatorState)

  const dispatch = useDispatch()

  const buttonText = useMemo(
    () => (isWalletConnected ? 'Create token' : 'Connect wallet'),
    [isWalletConnected]
  )

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
    />
  )
}
