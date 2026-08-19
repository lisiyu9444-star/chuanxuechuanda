import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'
import { LUCKY_STAR_ICONS } from '@/constants/lucky-icons'
import './lucky-star-water.css'

interface LuckyStarWaterProps {
  score: number
  size?: number
}

export function LuckyStarWater({ score, size = 84 }: LuckyStarWaterProps) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)))
  const iconUrl = useMemo(
    () => LUCKY_STAR_ICONS[Math.floor(Math.random() * LUCKY_STAR_ICONS.length)],
    []
  )

  return (
    <View
      className="lucky-star-water relative items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        src={iconUrl}
        mode="aspectFit"
        style={{ width: size, height: size }}
        className="rounded-full"
      />
      <Text
        className="star-score absolute font-bold text-white"
        style={{ fontSize: Math.round(size * 0.32), textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
      >
        {safeScore}
      </Text>
    </View>
  )
}
