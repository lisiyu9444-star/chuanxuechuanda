import { View, Text, Image } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { LUCKY_STAR_ICON_NAMES } from '@/constants/lucky-icons'
import { ensureRemoteAssets } from '@/constants/remote-assets'
import './lucky-star-water.css'

interface LuckyStarWaterProps {
  score: number
  size?: number
}

export function LuckyStarWater({ score, size = 84 }: LuckyStarWaterProps) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)))
  const iconName = useMemo(
    () => LUCKY_STAR_ICON_NAMES[Math.floor(Math.random() * LUCKY_STAR_ICON_NAMES.length)],
    []
  )
  const [iconUrl, setIconUrl] = useState('')

  useEffect(() => {
    let mounted = true
    ensureRemoteAssets().then((assets) => {
      if (mounted && assets?.[iconName]) setIconUrl(assets[iconName])
    })
    return () => {
      mounted = false
    }
  }, [iconName])

  return (
    <View
      className="lucky-star-water relative items-center justify-center"
      style={{ width: size, height: size }}
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          mode="aspectFit"
          style={{ width: size, height: size }}
          className="rounded-full"
        />
      ) : (
        <View className="rounded-full bg-amber-100" style={{ width: size, height: size }} />
      )}
      <Text
        className="star-score absolute font-bold text-white"
        style={{ fontSize: Math.round(size * 0.32), textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
      >
        {safeScore}
      </Text>
    </View>
  )
}
