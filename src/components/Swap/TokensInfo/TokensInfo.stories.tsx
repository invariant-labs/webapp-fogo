import type { Meta, StoryObj } from '@storybook/react'
import TokensInfo from './TokensInfo'
import { fn } from '@storybook/test'
import { NetworkType, WSOL_TEST } from '@store/consts/static'
import { Provider } from 'react-redux'
import { store } from '@store/index'
import { MemoryRouter } from 'react-router-dom'

const meta = {
  title: 'Components/TokensInfo',
  component: TokensInfo,
  decorators: [
    Story => (
      <Provider store={store}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </Provider>
    )
  ]
} satisfies Meta<typeof TokensInfo>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    copyTokenAddressHandler: fn(),
    tokenFrom: {
      balance: 234234000343400000,
      symbol: WSOL_TEST.symbol,
      assetAddress: WSOL_TEST.address,
      name: WSOL_TEST.name,
      logoURI: WSOL_TEST.logoURI,
      decimals: WSOL_TEST.decimals,
      isUnknown: false
    },
    tokenTo: {
      balance: 23435345450000400,
      symbol: WSOL_TEST.symbol,
      assetAddress: WSOL_TEST.address,
      name: WSOL_TEST.name,
      logoURI: WSOL_TEST.logoURI,
      decimals: WSOL_TEST.decimals,
      isUnknown: false
    },
    tokenFromPrice: 53433,
    tokenToPrice: 3243,
    network: NetworkType.Testnet
  },
  render: args => {
    return <TokensInfo {...args} />
  }
}
