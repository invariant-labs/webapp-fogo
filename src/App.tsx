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

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider maxSnack={99}>
          <FogoSessionProvider
            endpoint='https://testnet.fogo.io/'
            tokens={[NATIVE_MINT]}
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
  )
}

export default App
