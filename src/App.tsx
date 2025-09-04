import { Provider } from 'react-redux'
import { store } from './store'
import SnackbarProvider from '@common/Snackbar'
import { theme } from '@static/theme'
import { ThemeProvider } from '@mui/material/styles'
import Notifier from '@containers/Notifier/Notifier'
import { AppRouter } from '@pages/AppRouter'
import { FogoSessionProvider } from '@fogo/sessions-sdk-react'
import { NATIVE_MINT } from '@solana/spl-token'
import { SOL_TEST, USDC_TEST } from '@store/consts/static'
import { PublicKey } from '@solana/web3.js'

function App() {
  const isPreviewHost =
    typeof window !== 'undefined' && /\.vercel\.app$/.test(window.location.hostname)

  const shouldOverrideDomain = isPreviewHost || process.env.NODE_ENV !== 'production'
  return (
    <>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={99}>
            <FogoSessionProvider
              sponsor={new PublicKey('B7g4WMqgNrn39sgKef23GKtqpWD7JvNj3waLx3RmTco2')}
              endpoint='https://testnet.fogo.io/'
              domain={shouldOverrideDomain ? 'https://fogo.invariant.app' : undefined}
              tokens={[NATIVE_MINT, USDC_TEST.address, SOL_TEST.address]}
              defaultRequestedLimits={
                new Map([
                  [NATIVE_MINT, 1_500_000_000n],
                  [USDC_TEST.address, 1_500_000_000n],
                  [SOL_TEST.address, 1_500_000_000n]
                ])
              }>
              <>
                <Notifier />
                <AppRouter />
              </>
            </FogoSessionProvider>
          </SnackbarProvider>
        </ThemeProvider>
      </Provider>
    </>
  )
}

export default App
