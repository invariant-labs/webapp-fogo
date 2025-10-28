import { WalletAdapter } from './adapters/types'
import { NightlyWalletAdapter } from './adapters/nightly'
import { SalmonWalletAdapter } from './adapters/salmon'
import { BackpackWalletAdapter } from './adapters/backpack'
import { WalletType } from '@store/consts/types'
import { sleep } from '@invariant-labs/sdk-fogo'
import { NightlyAdapter } from './adapters/nightly-wallet'
import { OkxWalletAdapter } from './adapters/okx'

let _wallet: WalletAdapter

const getFogoWallet = (): WalletAdapter => {
  return _wallet
}

const disconnectWallet = async () => {
  await _wallet.disconnect()
}

const connectStaticWallet = async (wallet: WalletType) => {
  switch (wallet) {
    case WalletType.BACKPACK:
      _wallet = new BackpackWalletAdapter()
      break
    case WalletType.SALMON:
      _wallet = new SalmonWalletAdapter()
      break
    case WalletType.NIGHTLY_WALLET:
      _wallet = new NightlyAdapter()
      break
    case WalletType.OKX:
      _wallet = new OkxWalletAdapter()
      break
    default:
      _wallet = new BackpackWalletAdapter()
      break
  }

  await sleep(300)
  await _wallet.connect()
  console.log('wallet connected', _wallet)
  console.log('_wallet.connected', _wallet.publicKey.toBase58(), _wallet.connected)

  return _wallet.connected ? (localStorage.setItem('WALLET_TYPE', wallet.toString()), true) : false
}

const changeToNightlyAdapter = () => {
  _wallet = new NightlyWalletAdapter()
}

export { getFogoWallet, disconnectWallet, connectStaticWallet, changeToNightlyAdapter }
