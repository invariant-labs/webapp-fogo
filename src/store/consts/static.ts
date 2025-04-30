import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk-fogo/lib/utils'
import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { ISnackbar } from '@store/reducers/snackbars'
import { Chain, PrefixConfig, Token, TokenPriceData, WalletType } from './types'
import { cat1Icon, cat2Icon, dog1Icon, dog2Icon } from '@static/icons'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

export enum NetworkType {
  Local = 'Local',
  Testnet = 'Testnet',
  Devnet = 'Devnet',
  Mainnet = 'Mainnet'
}

export enum DepositOptions {
  Basic = 'Basic',
  Auto = 'Auto'
}

const emptyPublicKey = new PublicKey(new Uint8Array(32))

export enum SwapType {
  Normal,
  WithHop
}

export const WSOL_ADDRESS = {
  [NetworkType.Mainnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Testnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Devnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Local]: emptyPublicKey
}

export const BTC_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: emptyPublicKey,
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const USDC_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: emptyPublicKey,
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const WSOL_MAIN: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'SOL',
  address: WSOL_ADDRESS[NetworkType.Mainnet],
  decimals: 9,
  name: 'Solana',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
}

export const WSOL_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'SOL',
  address: WSOL_ADDRESS[NetworkType.Testnet],
  decimals: 9,
  name: 'Solana',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
}

export const REFRESHER_INTERVAL = 30

export const PRICE_DECIMAL = 24

export enum RPC {
  TEST = 'https://testnet.fogo.io',
  MAIN = ''
}

const DEFAULT_PUBLICKEY = new PublicKey(0)
const MAX_U64 = new BN('18446744073709551615')

export const tokensPrices: Record<NetworkType, Record<string, TokenPriceData>> = {
  Devnet: {},
  Mainnet: {},
  Testnet: {},
  Local: {}
}
export const tokens: Record<NetworkType, Token[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [],
  Local: []
}

export const autoSwapPools: {
  pair: { tokenX: PublicKey; tokenY: PublicKey }
  swapPool: { address: PublicKey; feeIndex: number }
}[] = []

export const commonTokensForNetworks: Record<NetworkType, PublicKey[]> = {
  Devnet: [],
  Mainnet: [WSOL_MAIN.address],
  Testnet: [WSOL_TEST.address],
  Local: []
}

export const airdropTokens: Record<NetworkType, PublicKey[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [],
  Local: []
}

export const airdropQuantities: Record<NetworkType, number[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [],
  Local: []
}

export const WRAPPED_SOL_ADDRESS = 'So11111111111111111111111111111111111111112'

// CHECK REQUIRED FOR BELOW
export const WSOL_MIN_FAUCET_FEE_TEST = new BN(45000)
export const WSOL_MIN_FAUCET_FEE_MAIN = new BN(25000)

export const WSOL_MIN_DEPOSIT_SWAP_FROM_AMOUNT_TEST = new BN(50000)
export const WSOL_MIN_DEPOSIT_SWAP_FROM_AMOUNT_MAIN = new BN(25000)

export const WSOL_POSITION_INIT_LAMPORTS_MAIN = new BN(700000)
export const WSOL_POSITION_INIT_LAMPORTS_TEST = new BN(700000)

export const WSOL_POOL_INIT_LAMPORTS_MAIN = new BN(1750000)
export const WSOL_POOL_INIT_LAMPORTS_TEST = new BN(1100000)

export const WSOL_SWAP_AND_POSITION_INIT_LAMPORTS_MAIN = new BN(100000)
export const WSOL_SWAP_AND_POSITION_INIT_LAMPORTS_TEST = new BN(100000)

export const WSOL_CREATE_TOKEN_LAMPORTS_MAIN = new BN(2000000)
export const WSOL_CREATE_TOKEN_LAMPORTS_TEST = new BN(10100000)

export const WSOL_CLOSE_POSITION_LAMPORTS_MAIN = new BN(30000)
export const WSOL_CLOSE_POSITION_LAMPORTS_TEST = new BN(30000)

export const MINIMUM_PRICE_IMPACT = toDecimal(1, 4)

export const getCreateTokenLamports = (network: NetworkType): BN => {
  switch (network) {
    case NetworkType.Testnet:
      return WSOL_CREATE_TOKEN_LAMPORTS_TEST
    case NetworkType.Mainnet:
      return WSOL_CREATE_TOKEN_LAMPORTS_MAIN
    default:
      throw new Error('Invalid network')
  }
}

export const ALL_FEE_TIERS_DATA = FEE_TIERS.map((tier, index) => ({
  tier,
  primaryIndex: index
}))

export { DEFAULT_PUBLICKEY, MAX_U64 }

export const POSITIONS_PER_PAGE = 5

export const SIGNING_SNACKBAR_CONFIG: Omit<ISnackbar, 'open'> = {
  message: 'Signing transactions...',
  variant: 'pending',
  persist: true
}

export const ADDRESSES_TO_REVERT_TOKEN_PAIRS: string[] = []

export const FormatConfig = {
  B: 1000000000,
  M: 1000000,
  K: 1000,
  BDecimals: 9,
  MDecimals: 6,
  KDecimals: 3,
  DecimalsAfterDot: 2
}
export enum PositionTokenBlock {
  None,
  A,
  B
}

export const subNumbers = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']

export const defaultPrefixConfig: PrefixConfig = {
  B: 1000000000,
  M: 1000000,
  K: 10000
}

export const getAddressTickerMap = (network: NetworkType): { [k: string]: string } => {
  if (network !== NetworkType.Mainnet) {
    return {
      WSOL: WSOL_ADDRESS[network].toString()
    }
  } else {
    return {
      WSOL: WSOL_ADDRESS[network].toString()
    }
  }
}

export const getReversedAddressTickerMap = (network: NetworkType) => {
  return Object.fromEntries(
    Object.entries(getAddressTickerMap(network)).map(([key, value]) => [value, key])
  )
}

export const MINIMAL_POOL_INIT_PRICE = 0.00000001

export const DEFAULT_SWAP_SLIPPAGE = '0.50'
export const DEFAULT_NEW_POSITION_SLIPPAGE = '0.50'
export const DEFAULT_AUTOSWAP_MAX_PRICE_IMPACT = '0.50'
export const DEFAULT_AUTOSWAP_MIN_UTILIZATION = '95.00'
export const DEFAULT_AUTOSWAP_MAX_SLIPPAGE_TOLERANCE_CREATE_POSITION = '2.50'
export const DEFAULT_AUTOSWAP_MAX_SLIPPAGE_TOLERANCE_SWAP = '0.50'

export const CHAINS = [
  { name: Chain.Solana, address: 'https://invariant.app/swap', iconGlow: 'solanaGlow' },
  {
    name: Chain.Eclipse,
    address: 'https://eclipse.invariant.app/exchange',
    iconGlow: 'eclipseGlow'
  },
  {
    name: Chain.Fogo,
    address: 'https://fogo.invariant.app/exchange',
    iconGlow: 'fogoGlow'
  }
]

export const enum SortTypePoolList {
  NAME_ASC,
  NAME_DESC,
  FEE_ASC,
  FEE_DESC,
  VOLUME_ASC,
  VOLUME_DESC,
  TVL_ASC,
  TVL_DESC,
  APY_ASC,
  APY_DESC
}

export const enum SortTypeTokenList {
  NAME_ASC,
  NAME_DESC,
  PRICE_ASC,
  PRICE_DESC,
  // CHANGE_ASC,
  // CHANGE_DESC,
  VOLUME_ASC,
  VOLUME_DESC,
  TVL_ASC,
  TVL_DESC
}

export const RECOMMENDED_RPC_ADDRESS = {
  [NetworkType.Testnet]: RPC.TEST,
  [NetworkType.Mainnet]: RPC.MAIN,
  [NetworkType.Devnet]: '',
  [NetworkType.Local]: ''
}
export const ITEMS_PER_PAGE = 10
export const DEFAULT_TOKEN_DECIMAL = 6

export const PRICE_QUERY_COOLDOWN = 60 * 1000

export const TIMEOUT_ERROR_MESSAGE =
  'Transaction has timed out. Check the details to confirm success'

export const MAX_CROSSES_IN_SINGLE_TX = 10
export const MAX_CROSSES_IN_SINGLE_TX_WITH_LUTS = 34

export const walletNames = {
  [WalletType.NIGHTLY_WALLET]: 'Nightly',
  [WalletType.BACKPACK]: 'Backpack',
  [WalletType.OKX]: 'OKX',
  [WalletType.NIGHTLY]: 'Wallet Selector'
}

export const defaultImages: string[] = [dog1Icon, dog2Icon, cat1Icon, cat2Icon]

export const getPopularPools = (
  network: NetworkType
): {
  tokenX: string
  tokenY: string
  fee: string
}[] => {
  switch (network) {
    case NetworkType.Mainnet:
      return []
    default:
      return []
  }
}

export enum OverviewSwitcher {
  Overview = 'Overview',
  Wallet = 'Wallet'
}

export const STATS_CACHE_TIME = 30 * 60 * 1000
export const PRICE_API_URL = 'https://api.invariant.app/price'

export enum AutoswapCustomError {
  FetchError = 0
}
