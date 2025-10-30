import { Provider } from 'react-redux'
import { store } from './store'
import SnackbarProvider from '@common/Snackbar'
import { theme } from '@static/theme'
import { ThemeProvider } from '@mui/material/styles'
import Notifier from '@containers/Notifier/Notifier'
import { AppRouter } from '@pages/AppRouter'
import { FogoSessionProvider, Network } from '@fogo/sessions-sdk-react'
import { NATIVE_MINT } from '@solana/spl-token'
import { ETH_TEST, NetworkType, SOL_TEST, USDC_TEST } from '@store/consts/static'

function App() {
  const lsNetwork = localStorage.getItem('INVARIANT_NETWORK_FOGO')

  const isPreviewHost =
    typeof window !== 'undefined' && /\.vercel\.app$/.test(window.location.hostname)

  const shouldOverrideDomain = isPreviewHost || process.env.NODE_ENV !== 'production'
  return (
    <>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={99}>
            <FogoSessionProvider
              onOpenExtendSessionExpiry={() => {
                console.log('Extend session expiry requested')
              }}
              onOpenSessionLimitsReached={() => {
                console.log('Session limits reached')
              }}
              network={
                (lsNetwork as keyof typeof NetworkType) === NetworkType.Mainnet
                  ? Network.Mainnet
                  : Network.Testnet
              }
              domain={shouldOverrideDomain ? 'https://fogo.invariant.app' : undefined}
              tokens={[NATIVE_MINT, USDC_TEST.address, SOL_TEST.address, ETH_TEST.address]}
              enableUnlimited>
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
