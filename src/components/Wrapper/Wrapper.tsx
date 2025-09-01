import React from 'react'
import useStyles from './style'
import { Box, Grid, Typography } from '@mui/material'
import ExchangeAmountInput from '@components/Inputs/ExchangeAmountInput/ExchangeAmountInput'
import { TooltipHover } from '@common/TooltipHover/TooltipHover'
import AnimatedButton from '@common/AnimatedButton/AnimatedButton'
import ChangeWalletButton from '@components/Header/HeaderButton/ChangeWalletButton'

export const Wrapper = () => {
  const { classes, cx } = useStyles()
  const [lockAnimation, setLockAnimation] = React.useState<boolean>(false)
  const [amountFrom, setAmountFrom] = React.useState<string>('')
  const [amountTo, setAmountTo] = React.useState<string>('')

  return (
    <Grid container className={classes.wrapperContainer} alignItems='center'>
      <Grid container className={classes.header}>
        <Box className={classes.leftSection}>
          <Typography component='h1'>Wrap FOGO</Typography>
        </Box>
      </Grid>

      <Box className={classes.borderContainer}>
        <Grid container className={classes.root} direction='column'>
          <Typography className={classes.swapLabel}>Pay</Typography>
          <Box
            className={cx(
              classes.exchangeRoot,
              lockAnimation ? classes.amountInputDown : undefined
            )}>
            <ExchangeAmountInput
              value={amountFrom}
              balance={
                tokenFromIndex !== null && !!tokens[tokenFromIndex]
                  ? printBN(tokens[tokenFromIndex].balance, tokens[tokenFromIndex].decimals)
                  : '- -'
              }
              decimal={
                tokenFromIndex !== null ? tokens[tokenFromIndex].decimals : DEFAULT_TOKEN_DECIMAL
              }
              className={classes.amountInput}
              setValue={value => {
                if (value.match(/^\d*\.?\d*$/)) {
                  setAmountFrom(value)
                  setInputRef(inputTarget.FROM)
                }
              }}
              placeholder={`0.${'0'.repeat(6)}`}
              actionButtons={[
                {
                  label: 'Max',
                  variant: 'max',
                  onClick: () => {
                    actions.max(tokenFromIndex)
                  }
                },
                {
                  label: '50%',
                  variant: 'half',
                  onClick: () => {
                    actions.half(tokenFromIndex)
                  }
                }
              ]}
              tokens={tokens}
              current={tokenFromIndex !== null ? tokens[tokenFromIndex] : null}
              onSelect={setTokenFromIndex}
              disabled={tokenFromIndex === tokenToIndex || tokenFromIndex === null}
              hideBalances={walletStatus !== Status.Initialized}
              handleAddToken={handleAddToken}
              commonTokens={commonTokens}
              limit={1e14}
              initialHideUnknownTokensValue={initialHideUnknownTokensValue}
              onHideUnknownTokensChange={e => {
                onHideUnknownTokensChange(e)
                setHideUnknownTokens(e)
              }}
              tokenPrice={tokenFromPriceData?.price}
              priceLoading={priceFromLoading}
              isBalanceLoading={isBalanceLoading}
              showMaxButton={true}
              showBlur={
                amountTo === '' && amountFrom === ''
                  ? false
                  : (inputRef === inputTarget.TO && addBlur) ||
                    lockAnimation ||
                    (getStateMessage() === 'Loading' &&
                      (inputRef === inputTarget.TO || inputRef === inputTarget.DEFAULT))
              }
              hiddenUnknownTokens={hideUnknownTokens}
              network={network}
            />
          </Box>

          <Box className={classes.tokenComponentTextContainer}>
            <Box
              className={classes.swapArrowBox}
              onClick={() => {
                setIsReversingTokens(true)
                if (lockAnimation) return
                setRateLoading(true)
                setLockAnimation(!lockAnimation)
                setRotates(rotates + 1)
                swap !== null ? setSwap(!swap) : setSwap(true)
                setTimeout(() => {
                  const tmpAmount = amountTo

                  const tmp = tokenFromIndex
                  setTokenFromIndex(tokenToIndex)
                  setTokenToIndex(tmp)

                  setInputRef(inputTarget.FROM)
                  setAmountFrom(tmpAmount)
                }, 10)
              }}>
              <Box className={classes.swapImgRoot}>
                <img
                  src={swapArrowsIcon}
                  style={{
                    transform: `rotate(${-rotates * 180}deg)`
                  }}
                  className={classes.swapArrows}
                  alt='Invert tokens'
                />
              </Box>
            </Box>
          </Box>
          <Typography className={classes.swapLabel} mt={1.5}>
            Receive
          </Typography>
          <Box
            className={cx(
              classes.exchangeRoot,
              classes.transactionBottom,
              lockAnimation ? classes.amountInputUp : undefined
            )}>
            <ExchangeAmountInput
              value={amountTo}
              balance={
                tokenToIndex !== null
                  ? printBN(tokens[tokenToIndex].balance, tokens[tokenToIndex].decimals)
                  : '- -'
              }
              className={classes.amountInput}
              decimal={
                tokenToIndex !== null ? tokens[tokenToIndex].decimals : DEFAULT_TOKEN_DECIMAL
              }
              setValue={value => {
                if (value.match(/^\d*\.?\d*$/)) {
                  setAmountTo(value)
                  setInputRef(inputTarget.TO)
                }
              }}
              placeholder={`0.${'0'.repeat(6)}`}
              actionButtons={[
                {
                  label: 'Max',
                  variant: 'max',
                  onClick: () => {
                    actions.max(tokenFromIndex)
                  }
                },
                {
                  label: '50%',
                  variant: 'half',
                  onClick: () => {
                    actions.half(tokenFromIndex)
                  }
                }
              ]}
              tokens={tokens}
              current={tokenToIndex !== null ? tokens[tokenToIndex] : null}
              onSelect={setTokenToIndex}
              disabled={tokenFromIndex === tokenToIndex || tokenToIndex === null}
              hideBalances={walletStatus !== Status.Initialized}
              handleAddToken={handleAddToken}
              commonTokens={commonTokens}
              limit={1e14}
              initialHideUnknownTokensValue={initialHideUnknownTokensValue}
              onHideUnknownTokensChange={e => {
                onHideUnknownTokensChange(e)
                setHideUnknownTokens(e)
              }}
              tokenPrice={tokenToPriceData?.price}
              showMaxButton={false}
              priceLoading={priceToLoading}
              isBalanceLoading={isBalanceLoading}
              showBlur={
                amountTo === '' && amountFrom === ''
                  ? false
                  : (inputRef === inputTarget.FROM && addBlur) ||
                    lockAnimation ||
                    (getStateMessage() === 'Loading' &&
                      (inputRef === inputTarget.FROM || inputRef === inputTarget.DEFAULT))
              }
              hiddenUnknownTokens={hideUnknownTokens}
              network={network}
            />
          </Box>

          <Box className={classes.mobileChangeWrapper}>
            <Box className={classes.transactionDetails}>
              <Box className={classes.mobileChangeRatioWrapper}>
                <Box className={classes.transactionDetailsInner}>
                  <button
                    onClick={
                      tokenFromIndex !== null &&
                      tokenToIndex !== null &&
                      hasShowRateMessage() &&
                      amountFrom !== '' &&
                      amountTo !== ''
                        ? handleOpenTransactionDetails
                        : undefined
                    }
                    className={cx(
                      tokenFromIndex !== null &&
                        tokenToIndex !== null &&
                        hasShowRateMessage() &&
                        amountFrom !== '' &&
                        amountTo !== ''
                        ? classes.HiddenTransactionButton
                        : classes.transactionDetailDisabled,
                      classes.transactionDetailsButton
                    )}>
                    <Grid className={classes.transactionDetailsWrapper}>
                      <Typography className={classes.transactionDetailsHeader}>
                        {detailsOpen && canShowDetails ? 'Hide' : 'Show'} transaction details
                      </Typography>
                    </Grid>
                  </button>
                  {tokenFromIndex !== null &&
                    tokenToIndex !== null &&
                    tokenFromIndex !== tokenToIndex && (
                      <TooltipHover title='Refresh'>
                        <Grid container className={classes.tooltipRefresh}>
                          <Refresher
                            currentIndex={refresherTime}
                            maxIndex={REFRESHER_INTERVAL}
                            onClick={handleRefresh}
                          />
                        </Grid>
                      </TooltipHover>
                    )}
                </Box>
              </Box>
            </Box>
            {walletStatus !== Status.Initialized && getStateMessage() !== 'Loading' ? (
              <ChangeWalletButton
                height={48}
                name='Connect wallet'
                onConnect={onConnectWallet}
                connected={false}
                onDisconnect={onDisconnectWallet}
                isSwap={true}
              />
            ) : getStateMessage() === 'Insufficient FOGO' ? (
              <TooltipHover
                title='More FOGO is required to cover the transaction fee. Obtain more FOGO to complete this transaction.'
                top={-45}>
                <AnimatedButton
                  content={getStateMessage()}
                  className={
                    getStateMessage() === 'Connect a wallet'
                      ? `${classes.swapButton}`
                      : getStateMessage() === 'Exchange' && progress === 'none'
                        ? `${classes.swapButton} ${classes.ButtonSwapActive}`
                        : classes.swapButton
                  }
                  disabled={getStateMessage() !== 'Exchange' || progress !== 'none'}
                  onClick={() => {
                    if (tokenFromIndex === null || tokenToIndex === null) return

                    onSwap(
                      fromFee(new BN(Number(+slippTolerance * 1000))),
                      simulateResult.estimatedPriceAfterSwap,
                      simulationPath.tokenFrom?.assetAddress ?? PublicKey.default,
                      simulationPath.tokenBetween?.assetAddress ?? null,
                      simulationPath.tokenTo?.assetAddress ?? PublicKey.default,
                      simulationPath.firstPair,
                      simulationPath.secondPair,
                      convertBalanceToBN(amountFrom, tokens[tokenFromIndex].decimals),
                      convertBalanceToBN(amountTo, tokens[tokenToIndex].decimals),
                      inputRef === inputTarget.FROM
                    )
                  }}
                  progress={progress}
                />
              </TooltipHover>
            ) : (
              <AnimatedButton
                content={getStateMessage()}
                className={
                  getStateMessage() === 'Connect a wallet'
                    ? `${classes.swapButton}`
                    : getStateMessage() === 'Exchange' && progress === 'none'
                      ? `${classes.swapButton} ${classes.ButtonSwapActive}`
                      : classes.swapButton
                }
                disabled={getStateMessage() !== 'Exchange' || progress !== 'none'}
                onClick={() => {
                  if (tokenFromIndex === null || tokenToIndex === null) return

                  onSwap(
                    // fromFee(new BN(Number(+slippTolerance * 1000))),
                    // simulateResult.estimatedPriceAfterSwap,
                    // tokens[tokenFromIndex].assetAddress,
                    // tokens[tokenToIndex].assetAddress,
                    // simulateResult.poolIndex,
                    // convertBalanceToBN(amountFrom, tokens[tokenFromIndex].decimals),
                    // convertBalanceToBN(amountTo, tokens[tokenToIndex].decimals),
                    // inputRef === inputTarget.FROM
                    fromFee(new BN(Number(+slippTolerance * 1000))),
                    simulateResult.estimatedPriceAfterSwap,
                    simulationPath.tokenFrom?.assetAddress ?? PublicKey.default,
                    simulationPath.tokenBetween?.assetAddress ?? null,
                    simulationPath.tokenTo?.assetAddress ?? PublicKey.default,
                    simulationPath.firstPair,
                    simulationPath.secondPair,
                    convertBalanceToBN(amountFrom, tokens[tokenFromIndex].decimals),
                    convertBalanceToBN(amountTo, tokens[tokenToIndex].decimals),
                    inputRef === inputTarget.FROM
                  )
                }}
                progress={progress}
              />
            )}
          </Box>
        </Grid>
      </Box>
      <img src={auditIcon} alt='Audit' style={{ marginTop: '24px' }} width={180} />
    </Grid>
  )
}
