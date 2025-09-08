import { FEE_TIERS, toDecimal } from '@invariant-labs/sdk-fogo/lib/utils'
import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { ISnackbar } from '@store/reducers/snackbars'
import {
  Chain,
  FormatNumberThreshold,
  PrefixConfig,
  Token,
  TokenPriceData,
  WalletType
} from './types'
import { cat1Icon, cat2Icon, dog1Icon, dog2Icon } from '@static/icons'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import fogoTokenIcon from '@static/fogoTokenIcon.jpg'

export enum NetworkType {
  Local = 'Local',
  Testnet = 'Testnet',
  Devnet = 'Devnet',
  Mainnet = 'Mainnet'
}
export enum inputTarget {
  DEFAULT = 'default',
  FROM = 'from',
  TO = 'to'
}
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export enum DepositOptions {
  Basic = 'Basic',
  Auto = 'Auto'
}

const emptyPublicKey = new PublicKey(new Uint8Array(32))

export enum SwapType {
  Normal,
  WithHop
}

export const DEFAULT_STRATEGY = {
  //TODO: Change
  tokenA: 'FOGO',
  tokenB: 'USDC',
  feeTier: '0_09'
}

export const WFOGO_ADDRESS = {
  [NetworkType.Mainnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Testnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Devnet]: new PublicKey('So11111111111111111111111111111111111111112'),
  [NetworkType.Local]: emptyPublicKey
}

export const SOL_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: new PublicKey('9Lxd3admpK1tfnJmQqkxzbZbkGo2f6EQNqKtMX5VXJeY'),
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const BTC_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: new PublicKey('D5iUETZ2ugRwPNaa3hr6R5mzAYE5KesqJwZaWLQ8QYCt'),
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const USDC_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: new PublicKey('HNQRxWh8Q36BAv4YV9cZUUSebwerZuQK5TLxwefS4KLy'),
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const ETH_ADDRESS = {
  [NetworkType.Mainnet]: emptyPublicKey,
  [NetworkType.Testnet]: new PublicKey('FvLECEfW93DscEAdbtLF6KPTmwougdkvQnygKjm8EbDH'),
  [NetworkType.Devnet]: emptyPublicKey,
  [NetworkType.Local]: emptyPublicKey
}

export const WFOGO_MAIN: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'FOGO',
  address: WFOGO_ADDRESS[NetworkType.Mainnet],
  decimals: 9,
  name: 'Fogo',
  logoURI: fogoTokenIcon, // TODO: change
  coingeckoId: ''
}

export const USDC_MAIN: Token = {
  //TODO: Change
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'USDC',
  address: new PublicKey('AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE'),
  decimals: 6,
  name: 'USD Coin (Hyperlane)',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  coingeckoId: 'usd-coin'
}

export const USDT_MAIN: Token = {
  //TODO: CHANGE
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'USDT',
  address: new PublicKey('CEBP3CqAbW4zdZA57H2wfaSG1QNdzQ72GiQEbQXyW9Tm'),
  decimals: 6,
  name: 'Tether USD (Hyperlane)',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  coingeckoId: 'tether'
}

export const WFOGO_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'FOGO',
  address: WFOGO_ADDRESS[NetworkType.Testnet],
  decimals: 9,
  name: 'Fogo',
  logoURI: fogoTokenIcon, // TODO: change
  coingeckoId: ''
}

export const SOL_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'SOL',
  address: SOL_ADDRESS[NetworkType.Testnet],
  decimals: 9,
  name: 'Solana',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  coingeckoId: 'solana'
}

export const USDC_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'USDC',
  address: USDC_ADDRESS[NetworkType.Testnet],
  decimals: 6,
  name: 'USD Coin',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  coingeckoId: 'usd-coin'
}

export const BTC_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'BTC',
  address: BTC_ADDRESS[NetworkType.Testnet],
  decimals: 9,
  name: 'Bitcoin',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png',
  coingeckoId: 'bitcoin'
}

export const ETH_TEST: Token = {
  tokenProgram: TOKEN_PROGRAM_ID,
  symbol: 'ETH',
  address: ETH_ADDRESS[NetworkType.Testnet],
  decimals: 9,
  name: 'Ether',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk/logo.png',
  coingeckoId: 'bridged-wrapped-ether-eclipse'
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
  Testnet: {
    WFOGO_TEST: { price: 147.63 },
    USDC_TEST: { price: 1 },
    SOL_TEST: { price: 147.63 },
    BTC_TEST: { price: 94961.57 },
    ETH_TEST: { price: 1808.3 }
  },
  Local: {}
}
export const tokens: Record<NetworkType, Token[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [USDC_TEST, BTC_TEST, ETH_TEST, WFOGO_TEST],
  Local: []
}

export const autoSwapPools: {
  pair: { tokenX: PublicKey; tokenY: PublicKey }
  swapPool: { address: PublicKey; feeIndex: number }
}[] = [
  {
    pair: {
      tokenX: new PublicKey('9Lxd3admpK1tfnJmQqkxzbZbkGo2f6EQNqKtMX5VXJeY'),
      tokenY: new PublicKey('HNQRxWh8Q36BAv4YV9cZUUSebwerZuQK5TLxwefS4KLy')
    },
    swapPool: {
      address: new PublicKey('67fFBbVNmQ3WAVQCX9JgJHjoeXsPMSj1LVAPrJv6Wr9Y'),
      feeIndex: 2
    }
  }
]

export const commonTokensForNetworks: Record<NetworkType, PublicKey[]> = {
  Devnet: [],
  Mainnet: [WFOGO_MAIN.address],
  Testnet: [
    WFOGO_TEST.address,
    BTC_TEST.address,
    SOL_TEST.address,
    ETH_TEST.address,
    USDC_TEST.address
  ],
  Local: []
}

export const airdropTokens: Record<NetworkType, PublicKey[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [USDC_TEST.address, BTC_TEST.address, ETH_TEST.address, SOL_TEST.address],
  Local: []
}

export const airdropQuantities: Record<NetworkType, number[]> = {
  Devnet: [],
  Mainnet: [],
  Testnet: [
    2 * 10 ** USDC_TEST.decimals,
    0.00005 * 10 ** BTC_TEST.decimals,
    0.001 * 10 ** ETH_TEST.decimals,
    0.5 * 10 ** SOL_TEST.decimals
  ],
  Local: []
}

export const WRAPPED_FOGO_ADDRESS = 'So11111111111111111111111111111111111111112'
export const TOKEN_FETCH_DELAY = 60 * 1000 * 60 * 24

// export const WFOGO_MIN_FAUCET_FEE_TEST = new BN(45000)

export const WFOGO_MIN_DEPOSIT_SWAP_FROM_AMOUNT_MAIN = new BN(25000) // TODO: adjust when on
export const WFOGO_MIN_DEPOSIT_SWAP_FROM_AMOUNT_TEST = new BN(0)

export const WFOGO_POSITION_INIT_LAMPORTS_MAIN = new BN(700000) // TODO: adjust when on
export const WFOGO_POSITION_INIT_LAMPORTS_TEST = new BN(5000)

export const WFOGO_POOL_INIT_LAMPORTS_MAIN = new BN(1750000) // TODO: adjust when on
export const WFOGO_POOL_INIT_LAMPORTS_TEST = new BN(25000)

export const WFOGO_SWAP_AND_POSITION_INIT_LAMPORTS_MAIN = new BN(100000) // TODO: adjust when on
export const WFOGO_SWAP_AND_POSITION_INIT_LAMPORTS_TEST = new BN(100000) // TODO: adjust when on

export const WFOGO_CREATE_TOKEN_LAMPORTS_MAIN = new BN(2000000) // TODO: adjust when on
export const WFOGO_CREATE_TOKEN_LAMPORTS_TEST = new BN(10100000) // TODO: adjust when on

export const WFOGO_CLOSE_POSITION_LAMPORTS_MAIN = new BN(30000) // TODO: adjust when on
export const WFOGO_CLOSE_POSITION_LAMPORTS_TEST = new BN(30000)

export const MINIMUM_PRICE_IMPACT = toDecimal(1, 4)

export const getCreateTokenLamports = (network: NetworkType): BN => {
  switch (network) {
    case NetworkType.Testnet:
      return WFOGO_CREATE_TOKEN_LAMPORTS_TEST
    case NetworkType.Mainnet:
      return WFOGO_CREATE_TOKEN_LAMPORTS_MAIN
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
      WFOGO: WFOGO_ADDRESS[network].toString(),
      SOL: SOL_ADDRESS[network].toString(),
      ETH: ETH_ADDRESS[network].toString(),
      BTC: BTC_ADDRESS[network].toString(),
      USDC: USDC_ADDRESS[network].toString()
    }
  } else {
    return {
      WFOGO: WFOGO_ADDRESS[network].toString(),
      SOL: SOL_ADDRESS[network].toString(),
      ETH: ETH_ADDRESS[network].toString(),
      BTC: BTC_ADDRESS[network].toString(),
      USDC: USDC_ADDRESS[network].toString()
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
export const DEFAULT_AUTOSWAP_MAX_SLIPPAGE_TOLERANCE_ADD_LIQUIDITY = '0.50'

export const CHAINS = [
  {
    name: Chain.Fogo,
    address: 'https://fogo.invariant.app/exchange',
    iconGlow: 'fogoGlow'
  },
  { name: Chain.Solana, address: 'https://invariant.app/swap', iconGlow: 'solanaGlow' },
  {
    name: Chain.Eclipse,
    address: 'https://eclipse.invariant.app/exchange',
    iconGlow: 'eclipseGlow'
  }
]

export const enum SortTypePoolList {
  NAME_ASC,
  NAME_DESC,
  FEE_ASC,
  FEE_DESC,
  FEE_24_ASC,
  FEE_24_DESC,
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

export const chartPlaceholder = {
  tickmaps: [
    { x: 2.33021324081296e-7, y: 0, index: -221810 },
    { x: 0.9686056247049151, y: 0, index: -69400 },
    { x: 0.9695746662960968, y: 6188.340066945488, index: -69390 },
    { x: 0.9881717681706338, y: 6188.340066945488, index: -69200 },
    { x: 0.9891603846976637, y: 20119.790531945488, index: -69190 },
    { x: 0.9911405860036346, y: 20119.790531945488, index: -69170 },
    { x: 0.9921321727081341, y: 28142.450909473402, index: -69160 },
    { x: 0.9931247514617308, y: 28142.450909473402, index: -69150 },
    { x: 0.9941183232608597, y: 30289.879997489374, index: -69140 },
    { x: 0.9951128890397407, y: 30289.879997489374, index: -69130 },
    { x: 0.9961084498595902, y: 38407.97691696376, index: -69120 },
    { x: 0.9971050066563205, y: 40591.04743422989, index: -69110 },
    { x: 0.9981025604929676, y: 57249.16422040085, index: -69100 },
    { x: 1.0011012140019244, y: 57249.16422040085, index: -69070 },
    { x: 1.002102765825214, y: 55066.09370313472, index: -69060 },
    { x: 1.0031053196378097, y: 46947.99678366034, index: -69050 },
    { x: 1.00410887650822, y: 44800.567695644364, index: -69040 },
    { x: 1.0071255750875803, y: 44800.567695644364, index: -69010 },
    { x: 1.00813315394147, y: 36777.90731811645, index: -69000 },
    { x: 1.0091417408922565, y: 22846.45685311645, index: -68990 },
    { x: 1.011161942873156, y: 22846.45685311645, index: -68970 },
    { x: 1.0121735599903756, y: 6188.340066945488, index: -68960 },
    { x: 1.0254170502871547, y: 6188.340066945488, index: -68830 },
    { x: 1.0264429288718113, y: 0, index: -68820 },
    { x: 1.0274698338137271, y: 0, index: -68810 },
    { x: 4291452183844.2334, y: 0, index: 221810 }
  ],
  midPrice: { x: 1, index: -69090 },
  leftRange: { index: -69160, x: 0.9921321727081341 },
  rightRange: { index: -69000, x: 1.00813315394147 },
  plotMin: 0.988931976461467,
  plotMax: 1.0113333501881372,
  tickSpacing: 10
}
export enum Intervals {
  Daily = '24H',
  Weekly = '1W',
  Monthly = '1M'
  // Yearly = 'yearly' Don't show year in UI
}

export const thresholdsWithTokenDecimal = (decimals: number): FormatNumberThreshold[] => [
  {
    value: 10,
    decimals
  },
  {
    value: 10000,
    decimals: 6
  },
  {
    value: 100000,
    decimals: 4
  },
  {
    value: 1000000,
    decimals: 3
  },
  {
    value: 1000000000,
    decimals: 2,
    divider: 1000000
  },
  {
    value: Infinity,
    decimals: 2,
    divider: 1000000000
  }
]

export const defaultThresholds: FormatNumberThreshold[] = [
  {
    value: 10,
    decimals: 4
  },
  {
    value: 1000,
    decimals: 2
  },
  {
    value: 10000,
    decimals: 2
  },
  {
    value: 1000000,
    decimals: 2,
    divider: 1000
  },
  {
    value: 1000000000,
    decimals: 2,
    divider: 1000000
  },
  {
    value: Infinity,
    decimals: 2,
    divider: 1000000000
  }
]
export const disabledPools = [
  {
    tokenX: new PublicKey('GnBAskb2SQjrLgpTjtgatz4hEugUsYV7XrWU1idV3oqW'),
    tokenY: new PublicKey('GnBAskb2SQjrLgpTjtgatz4hEugUsYV7XrWU1idV3oqW'),
    feeTiers: ['0.01']
  }
]

export const MAX_PLOT_VISIBLE_TICK_RANGE = 46154 // x100 difference

export const AlternativeFormatConfig = {
  B: 1000000000,
  M: 1000000,
  K: 10000,
  BDecimals: 9,
  MDecimals: 6,
  KDecimals: 3,
  DecimalsAfterDot: 2
}

export const NoConfig = {
  B: 1000000000000000,
  M: 1000000000000000,
  K: 1000000000000000,
  BDecimals: 100,
  MDecimals: 100,
  KDecimals: 100,
  DecimalsAfterDot: 2
}

export enum ErrorCodeExtractionKeys {
  ErrorNumber = 'Error Number:',
  Custom = 'Custom":',
  ApprovalDenied = 'Approval Denied',
  UndefinedOnSplit = "Cannot read properties of undefined (reading 'split')",
  RightBracket = '}',
  Dot = '.'
}
export const COMMON_ERROR_MESSAGE: string = 'Failed to send. Please try again'
export const APPROVAL_DENIED_MESSAGE: string = 'Transaction approval rejected'
const SLIPPAGE_ERROR_MESSAGE = 'Price changed – increase slippage or retry'

export const ERROR_CODE_TO_MESSAGE: Record<number, string> = {
  0x1778: SLIPPAGE_ERROR_MESSAGE,
  0x1773: SLIPPAGE_ERROR_MESSAGE,
  0x1795: SLIPPAGE_ERROR_MESSAGE,
  0x1796: SLIPPAGE_ERROR_MESSAGE,
  0x1775: SLIPPAGE_ERROR_MESSAGE,
  0x1785: SLIPPAGE_ERROR_MESSAGE
}
