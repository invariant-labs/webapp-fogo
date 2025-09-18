import { SessionButton } from '@fogo/sessions-sdk-react'
import { JSX, useEffect, useRef, useState } from 'react'
import DotIcon from '@mui/icons-material/FiberManualRecordRounded'
import { Button } from '@common/Button/Button'
import { Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import useStyles from './style'
import { blurContent, unblurContent } from '@utils/uiUtils'

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
  margin
}) => {
  const { classes, cx } = useStyles()

  const sessionWrapperRef = useRef<HTMLDivElement | null>(null)
  const [hideModal, setHideModal] = useState(walletConnected)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUserInitiated, setIsUserInitiated] = useState(false)

  const handleClick = () => {
    setIsUserInitiated(true)
    const btn = sessionWrapperRef.current?.querySelector('button')
    btn?.click()
    setHideModal(true)
    blurContent()
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (!walletConnected) {
      setHideModal(false)
    }
  }, [walletConnected])

  useEffect(() => {
    if (!walletConnected || isUserInitiated) return

    const hideOverlay = () => {
      ;(document.querySelector('._sessionPanelPopover_1ifo2_256') as HTMLElement).style.display =
        'none'
      document.getElementById('root')?.removeAttribute('inert')

      const closeButtons = document.querySelectorAll(
        'button[aria-label*="close"], button[aria-label*="Close"], button[aria-label*="zamknij"], button[aria-label*="Zamknij"], button[aria-label*="Zignoruj"]'
      )
      closeButtons.forEach(btn => {
        ;(btn as HTMLElement).click()
      })
    }

    const timeout = setTimeout(hideOverlay, 100)

    return () => clearTimeout(timeout)
  }, [walletConnected, isUserInitiated])

  useEffect(() => {
    if (!isModalOpen) return

    const checkModalClosed = () => {
      const sessionModal = document.querySelector('._sessionPanelPopover_1ifo2_256')
      const dialogModal = document.querySelector('[role="dialog"]')

      if (!sessionModal && !dialogModal) {
        unblurContent()
        setIsModalOpen(false)
        setIsUserInitiated(false)
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

  return (
    <div>
      <Button
        scheme={walletConnected ? 'normal' : defaultVariant === 'pink' ? 'pink' : 'green'}
        disabled={isDisabled}
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
              {name}
            </Typography>
          ) : (
            <Typography className={cx(classes.headerButtonTextEllipsis)}>
              {walletConnected && address
                ? `${address.toString().slice(0, 4)}...${!isSmDown ? address.toString().slice(-4) : ''}`
                : isSmDown
                  ? 'Connect'
                  : 'Connect wallet'}
            </Typography>
          )}
          {walletConnected && !hideArrow && <ExpandMoreIcon className={classes.endIcon} />}
        </Box>
      </Button>
      {(enableModal || !hideModal) && (
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
    </div>
  )
}

export default ChangeWalletButton
