import { Grid } from '@mui/material'
import useStyles from './styles'
import PopularPoolsWrapper from '@containers/PopularPoolsWrapper/PopularPoolsWrapper'
import { WrappedPoolList } from '@containers/WrappedPoolList/WrappedPoolList'
// import comingSoon from '../../static/png/coming-soon.png'

const ListPage: React.FC = () => {
  const { classes } = useStyles()
  return (
    <Grid container className={classes.container}>
      {/* <Grid container minHeight={'60vh'} justifyContent={'center'} alignItems={'center'}>
        <img src={comingSoon} alt='Coming soon' />
      </Grid> */}
      <Grid container className={classes.innerContainer}>
        <PopularPoolsWrapper />
        <WrappedPoolList />
      </Grid>
    </Grid>
  )
}

export default ListPage
