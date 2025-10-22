import { Box, CircularProgress, Collapse, Typography } from '@mui/material'
import useStyles from './style'
import { warningIcon } from '@static/icons'
import { SessionStateType, useSession } from '@fogo/sessions-sdk-react'

interface SessionExpiredBannerProps {
  width: number | string
  open: boolean
}

export const SessionExpiredBanner = ({ width, open }: SessionExpiredBannerProps) => {
  const { classes } = useStyles()
  const session = useSession()

  return (
    <Collapse sx={{ maxWidth: width, width: '100%' }} in={open} timeout={300}>
      <Box maxWidth={width} width='100%' className={classes.container}>
        <Box className={classes.information}>
          <img src={warningIcon} alt='Warning' style={{ width: 18 }} />
          <Typography>Your session has expired</Typography>
        </Box>
        {session?.type === SessionStateType.UpdatingSession ? (
          <CircularProgress className={classes.loadingState} size={20} />
        ) : (
          <Typography
            onClick={() => {
              session.type === SessionStateType.Established &&
                session.updateSession(1000 * 60 * 60 * 24 * 7)
            }}
            className={classes.extendButton}>
            Extend Session
          </Typography>
        )}
      </Box>
    </Collapse>
  )
}
