import { SessionButton, SessionStateType, useSession } from '@fogo/sessions-sdk-react'
import React, { JSX, useEffect, useRef, useState } from 'react'
import DotIcon from '@mui/icons-material/FiberManualRecordRounded'
import { Button } from '@common/Button/Button'
import { Box, CircularProgress, Grid, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import useStyles from './style'
import { blurContent, unblurContent } from '@utils/uiUtils'
import { colors } from '@static/theme'
import { ALLOW_SESSIONS } from '@store/consts/static'
import SelectWalletModal from '@components/Modals/SelectWalletModal/SelectWalletModal'
import ConnectWallet from '@components/Modals/ConnectWallet/ConnectWallet'

export interface IProps {
  name: string
  address?: string
  walletConnected: boolean
  isSmDown?: boolean
  startIcon?: JSX.Element
  textClassName?: string
  defaultVariant?: 'green' | 'pink'
  width?: string | number
  height?: string | number
  isSwap?: boolean
  noUnblur?: boolean
  isDisabled?: boolean
  hideArrow?: boolean
  enableModal?: boolean
  margin?: string
  onConnect: () => void
  onDisconnect: () => void
  onCopyAddress?: () => void
}

const ChangeWalletButton: React.FC<IProps> = ({
  name,
  address,
  walletConnected,
  isSmDown,
  defaultVariant = 'pink',
  height = 40,
  isDisabled,
  noUnblur,
  textClassName,
  width,
  hideArrow,
  enableModal,
  margin,
  onConnect,
  onDisconnect,
  onCopyAddress
}) => {
  const { classes, cx } = useStyles()
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)
  const sessionWrapperRef = useRef<HTMLDivElement | null>(null)
  const [hideModal, setHideModal] = useState(walletConnected)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [open, setOpen] = React.useState<boolean>(false)
  const [isOpenSelectWallet, setIsOpenSelectWallet] = React.useState<boolean>(false)
  const [isChangeWallet, setIsChangeWallet] = React.useState<boolean>(false)
  const session = useSession()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const btn = sessionWrapperRef.current?.querySelector('button')
    blurContent()

    if (!ALLOW_SESSIONS) {
      setAnchorEl(event.currentTarget ?? null)
      if (!walletConnected) {
        setIsOpenSelectWallet(true)
      } else {
        setOpen(true)
      }
    } else {
      setHideModal(true)
      setIsModalOpen(true)
      btn?.click()
    }
  }

  useEffect(() => {
    if (!walletConnected) {
      setHideModal(false)
    }
  }, [walletConnected])

  useEffect(() => {
    if (!isModalOpen) return

    const checkModalClosed = () => {
      const sessionModal = document.querySelector('._sessionPanelPopover_1ifo2_256')
      const dialogModal = document.querySelector('[role="dialog"]')

      if (!sessionModal && !dialogModal) {
        unblurContent()
        setIsModalOpen(false)
      }
    }

    const observer = new MutationObserver(() => {
      checkModalClosed()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    const interval = setInterval(checkModalClosed, 100)

    return () => {
      observer.disconnect()
      clearInterval(interval)
      if (!document.querySelector('._sessionPanelPopover_1ifo2_256')) {
        unblurContent()
      }
    }
  }, [isModalOpen, noUnblur])

  useEffect(() => {
    return () => {
      unblurContent()
    }
  }, [])

  const handleConnect = async () => {
    onConnect()
    setIsOpenSelectWallet(false)
    if (!noUnblur) {
      unblurContent()
    }
    setIsChangeWallet(false)

    // dispatch(saleActions.getUserStats())
  }

  const handleClose = () => {
    if (!noUnblur) {
      unblurContent()
    }
    setOpen(false)
  }

  const handleDisconnect = () => {
    onDisconnect()
    if (!noUnblur) {
      unblurContent()
    }
    setOpen(false)
    localStorage.setItem('WALLET_TYPE', '')
    // dispatch(saleActions.resetUserStats())
  }

  const handleChangeWallet = () => {
    setIsChangeWallet(true)
    if (!noUnblur) {
      unblurContent()
    }
    setOpen(false)
    setIsOpenSelectWallet(true)
    blurContent()

    localStorage.setItem('WALLET_TYPE', '')
  }

  const handleCopyAddress = () => {
    onCopyAddress?.()
    if (!noUnblur) {
      unblurContent()
    }
    setOpen(false)
  }

  return (
    <div>
      <Button
        ignoreDisabledStyles={true}
        scheme={walletConnected ? 'normal' : defaultVariant === 'pink' ? 'pink' : 'green'}
        disabled={
          isDisabled ||
          session.type === SessionStateType.WalletConnecting ||
          session.type === SessionStateType.CheckingStoredSession
        }
        classes={{
          startIcon: classes.startIcon,
          endIcon: classes.innerEndIcon
        }}
        onClick={isDisabled ? () => {} : handleClick}
        width={width}
        height={height}
        margin={margin}>
        <Box className={classes.headerButtonContainer}>
          {walletConnected && (
            <Box className={classes.startIcon}>
              <DotIcon />
            </Box>
          )}
          {name ? (
            <Typography className={cx(classes.headerButtonTextEllipsis, textClassName)}>
              {session.type === SessionStateType.WalletConnecting ||
              session.type === SessionStateType.CheckingStoredSession ? (
                <Grid sx={{ width: isSmDown ? 57.67 : 104.45 }}>
                  <CircularProgress
                    sx={{ color: colors.invariant.newDark, marginTop: 0.5 }}
                    size={20}
                    thickness={5}
                  />
                </Grid>
              ) : (
                name
              )}
            </Typography>
          ) : (
            <Typography className={cx(classes.headerButtonTextEllipsis)}>
              {walletConnected && address ? (
                `${address.toString().slice(0, 4)}...${!isSmDown ? address.toString().slice(-4) : ''}`
              ) : session.type === SessionStateType.WalletConnecting ||
                session.type === SessionStateType.CheckingStoredSession ? (
                <Grid sx={{ width: isSmDown ? 57.67 : 104.45 }}>
                  <CircularProgress
                    sx={{ color: colors.invariant.newDark, marginTop: 0.5 }}
                    size={20}
                    thickness={5}
                  />
                </Grid>
              ) : isSmDown ? (
                'Connect'
              ) : (
                'Connect wallet'
              )}
            </Typography>
          )}
          {walletConnected && !hideArrow && <ExpandMoreIcon className={classes.endIcon} />}
        </Box>
      </Button>
      {ALLOW_SESSIONS && (enableModal || !hideModal) && (
        <div
          ref={sessionWrapperRef}
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            overflow: 'hidden',
            opacity: 0,
            pointerEvents: 'none',
            top: '20px'
          }}>
          <SessionButton />
        </div>
      )}

      <SelectWalletModal
        anchorEl={anchorEl}
        handleClose={() => {
          setIsOpenSelectWallet(false)
          if (!noUnblur) {
            unblurContent()
          }
        }}
        setIsOpenSelectWallet={() => {
          setIsOpenSelectWallet(false)
          if (!noUnblur) {
            unblurContent()
          }
        }}
        handleConnect={handleConnect}
        open={isOpenSelectWallet}
        isChangeWallet={isChangeWallet}
        onDisconnect={handleDisconnect}
      />
      <ConnectWallet
        open={open}
        anchorEl={anchorEl}
        handleClose={handleClose}
        callDisconect={handleDisconnect}
        callCopyAddress={handleCopyAddress}
        callChangeWallet={handleChangeWallet}
      />
    </div>
  )
}

export default ChangeWalletButton
