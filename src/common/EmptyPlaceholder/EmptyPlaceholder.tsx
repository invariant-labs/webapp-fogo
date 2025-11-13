import { Grid, Typography, useMediaQuery } from '@mui/material'
import React from 'react'
import { useStyles } from './style'
import { emptyIcon } from '@static/icons'
import { Button } from '@common/Button/Button'
import ChangeWalletButton from '@components/Header/HeaderButton/ChangeWalletButton'
import { theme } from '@static/theme'

export interface IEmptyPlaceholder {
  desc: string

  onAction?: () => void
  className?: string
  style?: React.CSSProperties
  withButton?: boolean
  mainTitle?: string
  roundedCorners?: boolean
  buttonName?: string
  height?: number | string
  newVersion?: boolean
  img?: string
  desc2?: string
  connectButton?: boolean
  themeDark?: boolean
  withImg?: boolean
  walletConnected?: boolean
  onConnectWallet?: () => void
  onDisconnectWallet?: () => void
}

export const EmptyPlaceholder: React.FC<IEmptyPlaceholder> = ({
  desc,
  onAction,
  withButton = true,
  buttonName,
  mainTitle = `It's empty here...`,
  height,
  newVersion = false,
  roundedCorners = false,
  img = emptyIcon,
  desc2,
  themeDark = false,
  style,
  connectButton,
  walletConnected,
  withImg = true,
  onConnectWallet
}) => {
  const { classes, cx } = useStyles({ newVersion, themeDark, roundedCorners, height })

  const isSm = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Grid container className={classes.wrapperContainer}>
      <Grid className={cx(classes.blur, 'blurLayer')} />
      <Grid sx={style} className={cx(classes.container, 'blurLayer')}>
        <Grid className={cx(classes.root, 'blurInfo')} gap='24px'>
          {withImg && <img height={80} src={img} alt='Not connected' />}
          <Grid className={classes.buttonContainer}>
            <Typography sx={{ opacity: 0.8 }} className={classes.title}>
              {mainTitle}
            </Typography>
            {desc?.length > 0 && <Typography className={classes.desc}>{desc}</Typography>}
          </Grid>
          <Grid className={classes.buttonContainer}>
            {withButton && (
              <Button scheme='pink' padding='0 48px' onClick={onAction}>
                {buttonName ? buttonName : 'Add position'}
              </Button>
            )}
            {connectButton && (
              <ChangeWalletButton
                name={isSm ? 'Connect' : 'Connect wallet'}
                width={'100%'}
                walletConnected={!connectButton && walletConnected}
                isSmDown={isSm}
                onConnect={onConnectWallet ? onConnectWallet : () => {}}
                onDisconnect={() => {}}
              />
            )}
          </Grid>

          {desc2 && <Typography className={classes.desc}>{desc2}</Typography>}
        </Grid>
      </Grid>
    </Grid>
  )
}
