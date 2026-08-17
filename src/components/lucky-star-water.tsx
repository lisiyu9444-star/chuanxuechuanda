import { View, Text } from '@tarojs/components'
import './lucky-star-water.css'

interface LuckyStarWaterProps {
  score: number
  size?: number
}

export function LuckyStarWater({ score, size = 84 }: LuckyStarWaterProps) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)))
  const isHighWater = safeScore > 55

  return (
    <View className="lucky-star-water" style={{ width: size, height: size }}>
      <View className="star-shadow">
        <View className="star-shell">
          <View className="star-bg" />
          <View className="star-water" style={{ height: `${safeScore}%` }}>
            <View className="wave wave-1" />
            <View className="wave wave-2" />
          </View>
          <View className="star-shine" />
        </View>
      </View>
      <Text
        className={`star-score ${isHighWater ? 'star-score-light' : 'star-score-dark'}`}
        style={{ fontSize: Math.round(size * 0.32) }}
      >
        {safeScore}
      </Text>
    </View>
  )
}
