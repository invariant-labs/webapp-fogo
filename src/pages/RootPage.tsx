import { useEffect, useCallback, memo, useState } from 'react'
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
import { metaData, ROUTES } from '@utils/utils'
import { SessionStateType, useSession } from '@fogo/sessions-sdk-react'
import { SessionExpiredBanner } from '@common/SessionExpiredBanner/SessionExpiredBanner'

const RootPage: React.FC = memo(() => {
  const dispatch = useDispatch()
  const session = useSession()
  const navigate = useNavigate()
  const { classes } = useStyles()
  const location = useLocation()

  const [sessionExpired, setSessionExpired] = useState(false)
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

  useEffect(() => {
    if (session.type === SessionStateType.Established && session.expiration) {
      const timeLeft = new Date(session.expiration).getTime() - Date.now()

      setSessionExpired(false)

      if (timeLeft > 0) {
        const timeout = setTimeout(() => {
          setSessionExpired(true)
        }, timeLeft)

        return () => clearTimeout(timeout)
      } else {
        setSessionExpired(true)
      }
    }
  }, [session, dispatch])
  return (
    <>
      <EventsHandlers />
      <div id={toBlur}>
        <Grid className={classes.root}>
          <SessionExpiredBanner
            width='100%'
            open={
              sessionExpired &&
              (session.type === SessionStateType.Established ||
                session.type === SessionStateType.UpdatingSession)
            }
          />
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
