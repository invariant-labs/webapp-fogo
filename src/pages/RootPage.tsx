import { useEffect, useCallback, memo } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import EventsHandlers from '@containers/EventsHandlers'
import FooterWrapper from '@containers/FooterWrapper'
import HeaderWrapper from '@containers/HeaderWrapper/HeaderWrapper'
import { Grid } from '@mui/material'
import { actions as solanaConnectionActions } from '@store/reducers/solanaConnection'
import { toBlur } from '@utils/uiUtils'
import useStyles from './style'
import { actions } from '@store/reducers/positions'
import { ROUTES } from '@utils/utils'
import { SessionStateType, useSession } from '@fogo/sessions-sdk-react'
import { metaData } from '@store/consts/static'

const RootPage: React.FC = memo(() => {
  const dispatch = useDispatch()
  const session = useSession()
  const navigate = useNavigate()
  const { classes } = useStyles()
  const location = useLocation()

  useEffect(() => {
    const title =
      metaData.get([...metaData.keys()].find(key => location.pathname.startsWith(key))!) ||
      document.title
    document.title = title
  }, [location])

  const initConnection = useCallback(() => {
    dispatch(solanaConnectionActions.initSolanaConnection())
  }, [dispatch])

  useEffect(() => {
    if (location.pathname === '/') {
      navigate(ROUTES.EXCHANGE)
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    initConnection()
  }, [initConnection])

  useEffect(() => {
    if (session.type === SessionStateType.Established) {
      dispatch(actions.getPositionsList())
    }
  }, [session.type, dispatch])

  return (
    <>
      {session.type === SessionStateType.Established && <EventsHandlers />}
      <div id={toBlur}>
        <Grid className={classes.root}>
          <HeaderWrapper />
          <Grid className={classes.body}>
            <Outlet />
          </Grid>
          <FooterWrapper />
        </Grid>
      </div>
    </>
  )
})

export default RootPage
