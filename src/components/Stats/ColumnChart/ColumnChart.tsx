import { ResponsiveBar } from '@nivo/bar'
import { colors, theme, typography } from '@static/theme'
import { linearGradientDef } from '@nivo/core'
import { useStyles } from './style'
import { TimeData } from '@store/reducers/stats'
import { Box, Grid, Typography, useMediaQuery } from '@mui/material'
import { formatNumberWithoutSuffix, trimZeros } from '@utils/utils'
import { Intervals as IntervalsKeys } from '@store/consts/static'
import {
  formatLargeNumber,
  formatPlotDataLabels,
  getLabelDate,
  mapIntervalToString
} from '@utils/uiUtils'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Switcher from '@common/Switcher/Switcher'
import { ChartSwitch } from '@store/consts/types'
import { useSelector } from 'react-redux'
import { columnChartType } from '@store/selectors/stats'

type SeriesPoint = { timestamp: number; value: number }

const CHART_MARGIN = { top: 30, bottom: 30, left: 30, right: 4 }
const DAY_MS = 86_400_000

function resampleByInterval(data: SeriesPoint[], interval: IntervalsKeys): SeriesPoint[] {
  const buckets = new Map<number, number>()
  for (const pt of data) {
    const ms = pt.timestamp
    let bucket: number
    if (interval === IntervalsKeys.Daily) {
      bucket = Math.floor(ms / DAY_MS) * DAY_MS
    } else {
      const d = new Date(ms)
      if (interval === IntervalsKeys.Weekly) {
        const dow = d.getUTCDay() || 7
        const startOfDay = Math.floor(ms / DAY_MS) * DAY_MS
        const mondayOffset = dow - 1
        bucket = startOfDay - mondayOffset * DAY_MS
      } else {
        bucket = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
      }
    }
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + (pt.value || 0))
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, value]) => ({ timestamp, value }))
}

const MAX_BUCKETS: Record<IntervalsKeys, number> = {
  [IntervalsKeys.Daily]: 30,
  [IntervalsKeys.Weekly]: 26,
  [IntervalsKeys.Monthly]: 12
}

function limitBuckets(points: SeriesPoint[], interval: IntervalsKeys): SeriesPoint[] {
  const max = MAX_BUCKETS[interval]
  return points.length > max ? points.slice(points.length - max) : points
}

interface StatsInterface {
  volume: number | null
  fees: number | null
  volumeData: TimeData[]
  feesData: TimeData[]
  className?: string
  isLoading: boolean
  interval: IntervalsKeys
  lastStatsTimestamp: number
  setChartType: (type: ChartSwitch) => void
}

const ColumnChart: React.FC<StatsInterface> = ({
  volume = 0,
  fees = 0,
  volumeData,
  feesData,
  className,
  isLoading,
  interval,
  lastStatsTimestamp,
  setChartType
}) => {
  const { classes, cx } = useStyles()
  const [hoveredBar, setHoveredBar] = useState<any>(null)
  const [hoveredBarPosition, setHoveredBarPosition] = useState<{ x: number; width: number } | null>(
    null
  )
  const [isSticky, setIsSticky] = useState(false)

  const chartType = useSelector(columnChartType)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const intervalSuffix = mapIntervalToString(interval)

  const isXsDown = useMediaQuery(theme.breakpoints.down('xs'))
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
  const isLgDown = useMediaQuery(theme.breakpoints.down('lg'))
  const isTablet = isMdUp && isLgDown

  const hideTooltip = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHoveredBar(null)
    setHoveredBarPosition(null)
    setIsSticky(false)
  }, [])

  useEffect(() => {
    if (!hoveredBar) return

    const onPointerDownDoc = (e: PointerEvent) => {
      const host = chartContainerRef.current
      if (!host) return
      if (!host.contains(e.target as Node)) {
        hideTooltip()
      }
    }
    const onPointerMoveGuard = (e: PointerEvent) => {
      if (isSticky) return
      const host = chartContainerRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      const inside =
        e.clientX >= rect.left + CHART_MARGIN.left &&
        e.clientX <= rect.right - CHART_MARGIN.right &&
        e.clientY >= rect.top + CHART_MARGIN.top &&
        e.clientY <= rect.bottom - CHART_MARGIN.bottom
      if (!inside) hideTooltip()
    }
    const onHide = () => hideTooltip()

    document.addEventListener('pointerdown', onPointerDownDoc, true)
    window.addEventListener('pointermove', onPointerMoveGuard, { passive: true, capture: true })
    window.addEventListener('scroll', onHide, { passive: true, capture: true })
    window.addEventListener('wheel', onHide, { passive: true })
    window.addEventListener('blur', onHide)
    window.addEventListener('resize', onHide)

    return () => {
      document.removeEventListener('pointerdown', onPointerDownDoc, true)
      window.removeEventListener('pointermove', onPointerMoveGuard, { capture: true } as any)
      window.removeEventListener('scroll', onHide, { capture: true } as any)
      window.removeEventListener('wheel', onHide as any)
      window.removeEventListener('blur', onHide as any)
      window.removeEventListener('resize', onHide as any)
    }
  }, [hoveredBar, isSticky, hideTooltip])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const Theme = {
    axis: {
      fontSize: '14px',
      tickColor: 'transparent',
      ticks: { line: { stroke: colors.invariant.component }, text: { fill: '#A9B6BF' } },
      legend: { text: { stroke: 'transparent' } }
    },
    grid: { line: { stroke: colors.invariant.light } }
  }

  const CustomHoverLayer = ({ bars, innerHeight, innerWidth }: any) => {
    const pickBarByX = (x: number) => {
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i]
        if (x >= b.x && x <= b.x + b.width) return b
      }
      return null
    }

    const updateFromCoords = (clientX: number, clientY: number, target: SVGRectElement) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const rect = target.getBoundingClientRect()
      const localX = clientX - rect.left

      rafRef.current = requestAnimationFrame(() => {
        const b = pickBarByX(localX)
        if (!b) {
          if (!isSticky && hoveredBar) hideTooltip()
          return
        }
        const barData = {
          timestamp: b.data.indexValue || b.data.timestamp,
          value: b.data.value,
          ...b.data
        }
        if (
          !hoveredBarPosition ||
          hoveredBarPosition.x !== b.x ||
          hoveredBarPosition.width !== b.width
        ) {
          setHoveredBar(barData)
          setHoveredBarPosition({ x: b.x, width: b.width })
        }
        setMousePosition({ x: clientX, y: clientY })
      })
    }

    const onPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
      if (isSticky) return
      updateFromCoords(e.clientX, e.clientY, e.currentTarget)
    }

    const onPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
      const isMouse = (e.pointerType as string) === 'mouse'
      if (isMouse) return

      const target = e.currentTarget
      const rect = target.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const b = pickBarByX(localX)

      if (b) {
        if (
          isSticky &&
          hoveredBarPosition &&
          hoveredBarPosition.x === b.x &&
          hoveredBarPosition.width === b.width
        ) {
          hideTooltip()
        } else {
          setIsSticky(true)
          const barData = {
            timestamp: b.data.indexValue || b.data.timestamp,
            value: b.data.value,
            ...b.data
          }
          setHoveredBar(barData)
          setHoveredBarPosition({ x: b.x, width: b.width })
          setMousePosition({ x: e.clientX, y: e.clientY })
        }
      } else {
        if (isSticky) hideTooltip()
      }
    }

    const onPointerLeave = () => {
      if (!isSticky) hideTooltip()
    }

    return (
      <g>
        {hoveredBarPosition && (
          <rect
            x={hoveredBarPosition.x}
            y={0}
            width={hoveredBarPosition.width}
            height={innerHeight}
            fill='#f075d7'
            fillOpacity={0.3}
            style={{ pointerEvents: 'none' }}
          />
        )}
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill='transparent'
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          style={{
            pointerEvents: 'all',
            touchAction: 'manipulation'
          }}
        />
      </g>
    )
  }

  const CustomTooltip = () => {
    if (!hoveredBar) return null
    const timestamp = hoveredBar.timestamp || hoveredBar.indexValue
    const date = getLabelDate(interval, timestamp, lastStatsTimestamp)

    const tooltipWidth = 170
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const margin = 10
    let left = mousePosition.x + 10
    left = Math.max(margin, Math.min(left, screenWidth - tooltipWidth - margin))
    const top = mousePosition.y + 10

    return (
      <div
        style={{
          position: 'fixed',
          left,
          top,
          borderRadius: '4px',
          padding: '8px',
          pointerEvents: 'none',
          zIndex: 1000,
          color: 'white'
        }}>
        <Grid className={classes.tooltip}>
          <Typography className={classes.tooltipDate}>{date}</Typography>
          <Typography className={classes.tooltipValue}>
            ${formatNumberWithoutSuffix(hoveredBar.value)}
          </Typography>
        </Grid>
      </div>
    )
  }

  const [rawData, headerValue] = useMemo(() => {
    return chartType === ChartSwitch.volume ? [volumeData, volume || 0] : [feesData, fees || 0]
  }, [chartType, volumeData, feesData, volume, fees])

  const chartData = useMemo(() => {
    const resampled = resampleByInterval(rawData as SeriesPoint[], interval)
    return limitBuckets(resampled, interval)
  }, [rawData, interval])

  return (
    <Grid className={cx(classes.container, className)}>
      <Box className={classes.volumeContainer}>
        <Grid container display='flex' justifyContent={'space-between'} alignItems='center'>
          <Typography className={classes.volumeHeader}>
            {chartType === ChartSwitch.volume ? 'Volume' : 'Fees'} {intervalSuffix}
          </Typography>
          <Switcher
            value={chartType}
            onChange={setChartType}
            options={[ChartSwitch.volume, ChartSwitch.fees]}
            dark
          />
        </Grid>
        <div className={classes.volumePercentContainer}>
          <Typography className={classes.volumePercentHeader}>
            ${formatNumberWithoutSuffix(isLoading ? Math.random() * 10000 : headerValue)}
          </Typography>
        </div>
      </Box>

      <div
        ref={chartContainerRef}
        className={classes.barContainer}
        style={{ position: 'relative' }}
        onPointerLeave={() => {
          if (!isSticky) hideTooltip()
        }}>
        <ResponsiveBar
          layout='vertical'
          key={`${interval}-${chartType}-${isLoading}-${chartData.length}`}
          animate={false}
          margin={CHART_MARGIN}
          data={chartData as Array<{ timestamp: number; value: number }>}
          keys={['value']}
          indexBy='timestamp'
          axisBottom={{
            tickSize: 0,
            tickPadding: 10,
            tickRotation: 0,
            format: time =>
              isLoading
                ? ''
                : formatPlotDataLabels(time, chartData.length, interval, isMobile || isTablet)
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 2,
            tickRotation: 0,
            tickValues: 5,
            renderTick: isLoading
              ? () => <text></text>
              : ({ x, y, value }) => (
                  <g transform={`translate(${x - (isMobile ? 22 : 30)},${y + 4})`}>
                    <text
                      style={{ fill: colors.invariant.textGrey, ...typography.tiny2 }}
                      textAnchor='start'
                      dominantBaseline='central'>
                      {trimZeros(formatLargeNumber(value))}
                    </text>
                  </g>
                )
          }}
          gridYValues={5}
          theme={Theme}
          groupMode='grouped'
          enableLabel={false}
          enableGridY={true}
          innerPadding={isXsDown ? 1 : 2}
          isInteractive={false}
          padding={0.03}
          indexScale={{ type: 'band', round: true }}
          defs={[
            linearGradientDef('gradient', [
              { offset: 0, color: '#EF84F5' },
              { offset: 100, color: '#9C3EBD', opacity: 0.8 }
            ])
          ]}
          fill={[{ match: '*', id: 'gradient' }]}
          colors={colors.invariant.pink}
          layers={['grid', 'axes', 'bars', 'markers', 'legends', 'annotations', CustomHoverLayer]}
        />
        <CustomTooltip />
      </div>
    </Grid>
  )
}

export default ColumnChart
