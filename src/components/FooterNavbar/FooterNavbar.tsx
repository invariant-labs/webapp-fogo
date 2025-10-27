import { Box, Typography } from '@mui/material'
import useStyles from './style'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { liquidityIcon, statsIcon, swapArrowsIcon, walletIcon } from '@static/icons'

import { colors } from '@static/theme'

interface INavLinks {
  label: string
  icon: string
  width: number
  isLink: boolean
  url?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
}

export const FooterNavbar = () => {
  const links: INavLinks[] = [
    {
      label: 'Swap',
      icon: swapArrowsIcon,
      url: 'exchange',
      width: 33,
      isLink: true
    },
    {
      label: 'Liquidity',
      icon: liquidityIcon,
      url: 'liquidity',
      width: 20,
      isLink: true
    },
    {
      label: 'Portfolio',
      icon: walletIcon,
      url: 'portfolio',
      width: 26,
      isLink: true
    },

    // ...(typeOfNetwork === NetworkType.Testnet
    //   ? [
    //       {
    //         label: 'Creator',
    //         icon: tokenCreatorIcon,
    //         url: 'creator',
    //         width: 25,
    //         isLink: true
    //       }
    //     ]
    //   : []),

    {
      label: 'Stats',
      icon: statsIcon,
      url: 'statistics',
      width: 30,
      isLink: true
    }
  ]

  const location = useLocation()
  const landing = location.pathname.substring(1)

  const { classes } = useStyles()
  const [activePath, setActive] = useState('exchange')

  useEffect(() => {
    setActive(landing)
  }, [landing])

  const otherRoutesToHighlight: Record<string, RegExp[]> = {
    liquidity: [/^liquidity\/*/, /^poolDetails\/*/],

    exchange: [/^exchange\/*/],
    portfolio: [/^portfolio\/*/, /^newPosition\/*/, /^position\/*/]

    // ...(typeOfNetwork === NetworkType.Testnet ? { creator: [/^creator\/*/] } : {}),
  }

  const [display, setDisplay] = useState(true)

  useEffect(() => {
    const resizeHandler = () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
      setDisplay(window.innerHeight < window.visualViewport!?.height * 1.1)
    }

    window.visualViewport!.addEventListener('resize', resizeHandler)

    return () => window.visualViewport!.removeEventListener('resize', resizeHandler)
  }, [])

  return (
    <>
      <Box
        component='footer'
        className={classes.navbar}
        style={{ display: display ? 'flex' : 'none' }}>
        {links.map((link, index) => {
          let active = false

          active =
            link.url === activePath ||
            (!!link.url &&
              !!otherRoutesToHighlight[link.url] &&
              otherRoutesToHighlight[link.url].some(pathRegex => pathRegex.test(activePath)))

          if (link.isLink && link.url) {
            return (
              <Link
                key={`path-${link.url}`}
                to={`/${link.url}`}
                className={classes.navbox}
                style={{
                  background: active ? colors.invariant.light : ''
                }}
                onClick={e => {
                  if (link.url === 'exchange' && activePath.startsWith('exchange')) {
                    e.preventDefault()
                    return
                  }
                  setActive(link.url!)
                  if (link.onClick) {
                    link.onClick(e)
                  }
                }}>
                {active && <Box className={classes.activeBox} />}
                <img
                  src={link.icon}
                  width={link.width}
                  style={
                    active
                      ? { filter: 'brightness(0) saturate(100%) invert(100%)' }
                      : { filter: 'brightness(0) saturate(100%) invert(45%)' }
                  }
                  className={classes.navImg}
                  alt={link.label}
                />
                <Typography
                  sx={active ? { color: colors.white.main } : { color: colors.invariant.textGrey }}>
                  {link.label}
                </Typography>
              </Link>
            )
          } else {
            return (
              <Box
                key={`button-${index}`}
                component='button'
                className={classes.navbox}
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (link.onClick) {
                    link.onClick(e)
                  }
                }}
                style={{
                  background: active ? colors.invariant.light : 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                {active && <Box className={classes.activeBox} />}
                <img
                  src={link.icon}
                  width={link.width}
                  style={
                    active
                      ? { filter: 'brightness(0) saturate(100%) invert(100%)' }
                      : { filter: 'brightness(0) saturate(100%) invert(45%)' }
                  }
                  className={classes.navImg}
                  alt={link.label}
                />
                <Typography
                  sx={active ? { color: colors.white.main } : { color: colors.invariant.textGrey }}>
                  {link.label}
                </Typography>
              </Box>
            )
          }
        })}
      </Box>
    </>
  )
}

export default FooterNavbar
