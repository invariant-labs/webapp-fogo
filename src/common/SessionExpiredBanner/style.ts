import { colors, theme, typography } from '@static/theme'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(() => ({
  container: {
    minHeight: 48,
    boxSizing: 'border-box',
    background: 'rgba(239, 208, 99, 0.2)',
    border: `2px solid ${colors.invariant.yellow}`,
    borderLeft: 'none',
    borderRight: 'none',
    color: colors.invariant.yellow,
    paddingInline: 24,
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    alignItems: 'center',
    transition: 'height 300ms',
    [theme.breakpoints.down('sm')]: {
      paddingInline: 8
    }
  },
  information: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    '& p': {
      marginTop: 3
    }
  },
  extendButton: {
    border: `0px solid ${colors.invariant.yellow}`,
    width: 110,
    boxSizing: 'border-box',
    background: 'rgba(239, 208, 99, 0.1)',
    padding: '4px 14px',
    borderRadius: 24,
    cursor: 'pointer',
    color: colors.invariant.yellow,
    ...typography.caption2,
    transition: 'background-color 300ms, color 300ms',
    '&:hover': {
      background: colors.invariant.yellow,
      color: colors.invariant.dark
    }
  },
  loadingState: {
    color: colors.invariant.yellow,
    padding: '0px 45px'
  }
}))

export default useStyles
