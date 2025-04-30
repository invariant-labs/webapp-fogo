import { getTokenPrice, getMockedTokenPrice } from '@utils/utils'
import { useState, useEffect } from 'react'
import { network } from '@store/selectors/solanaConnection'
import { useSelector } from 'react-redux'

interface TokenPriceData {
  price: number
  loading: boolean
}

export const usePrices = ({
  tokenX,
  tokenY
}: {
  tokenY: { assetsAddress?: string; name?: string }
  tokenX: { assetsAddress?: string; name?: string }
}) => {
  const networkType = useSelector(network)

  const [tokenXPriceData, setTokenXPriceData] = useState<TokenPriceData>({
    price: 0,
    loading: true
  })
  const [tokenYPriceData, setTokenYPriceData] = useState<TokenPriceData>({
    price: 0,
    loading: true
  })
  useEffect(() => {
    if (!tokenX || !tokenY) return

    const fetchPrices = async () => {
      getTokenPrice(tokenX.assetsAddress ?? '', networkType)
        .then(data => {
          const price = data ? data : getMockedTokenPrice(tokenX.name ?? '', networkType).price

          setTokenXPriceData({ price, loading: false })
        })
        .catch(() => {
          setTokenXPriceData({
            price: getMockedTokenPrice(tokenX.name ?? '', networkType).price,
            loading: false
          })
        })

      getTokenPrice(tokenY.assetsAddress ?? '', networkType)
        .then(data => {
          const price = data ? data : getMockedTokenPrice(tokenY.name ?? '', networkType).price

          setTokenYPriceData({ price, loading: false })
        })
        .catch(() => {
          setTokenYPriceData({
            price: getMockedTokenPrice(tokenY.name ?? '', networkType).price,
            loading: false
          })
        })
    }

    fetchPrices()
  }, [tokenX.assetsAddress, tokenY.assetsAddress, networkType])
  return { tokenXPriceData, tokenYPriceData }
}
