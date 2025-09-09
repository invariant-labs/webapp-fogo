import { StrategyConfig } from '@store/types/userOverview'
import { SOL_TEST, WFOGO_TEST } from './static'

export const DEFAULT_FEE_TIER = '0_10'
export const STRATEGIES: StrategyConfig[] = [
  {
    //TODO: Change
    tokenAddressA: WFOGO_TEST.address.toString(),
    tokenAddressB: SOL_TEST.address.toString(),
    feeTier: '0_09'
  }
]
