import React, { useState } from 'react'
import * as R from 'remeda'
import { useDispatch, useSelector } from 'react-redux'
import { accounts } from '@store/selectors/solanaWallet'
import { status } from '@store/selectors/solanaConnection'
import { actions } from '@store/reducers/solanaWallet'
import { AccountInfo } from '@solana/web3.js'
import { Status } from '@store/reducers/solanaConnection'
import { getCurrentSolanaConnection } from '@utils/web3/connection'
import { parseTokenAccountData } from '@utils/web3/data'
import { WRAPPED_FOGO_ADDRESS } from '@store/consts/static'
import { isSessionActive } from '@store/hooks/session'

const SolanaWalletEvents = () => {
  const dispatch = useDispatch()
  const networkStatus = useSelector(status)
  const isWalletConnected = isSessionActive()
  const tokensAccounts = useSelector(accounts)
  const [initializedAccount, setInitializedAccount] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    const connection = getCurrentSolanaConnection()
    if (!connection || !isWalletConnected || networkStatus !== Status.Initialized) {
      return
    }
    const connectEvents = () => {
      const tempSet = new Set<string>()
      R.forEachObj(tokensAccounts, account => {
        tempSet.add(account.address.toString())
        if (initializedAccount.has(account.address.toString())) {
          return
        }
        connection.onAccountChange(account.address, (accountInfo: AccountInfo<Buffer>) => {
          const parsedData = parseTokenAccountData(accountInfo.data)
          dispatch(
            actions.setTokenBalance({
              address: account.address.toString(),
              programId: parsedData.token.toString(),
              balance: parsedData.amount
            })
          )
          if (parsedData.token.toString() === WRAPPED_FOGO_ADDRESS) {
            dispatch(actions.setBalance(parsedData.amount))
          }
        })
      })
      setInitializedAccount(tempSet)
    }
    connectEvents()
  }, [dispatch, tokensAccounts, networkStatus, isWalletConnected])

  return null
}

export default SolanaWalletEvents
