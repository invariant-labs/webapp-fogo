import { WrappedWrapper } from '@containers/WrappedWrapper/WrappedWrapper'
import useStyles from './styles'
import { Grid } from '@mui/material'

export const WrapperPage: React.FC = () => {
  const { classes } = useStyles()

  return (
    <Grid className={classes.container}>
      <WrappedWrapper />
    </Grid>
  )
}

export default WrapperPage
