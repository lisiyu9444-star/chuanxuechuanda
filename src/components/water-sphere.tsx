import { View, Text } from '@tarojs/components'
import './water-sphere.css'

interface WaterSphereProps {
  score: number
  size?: number
  className?: string
}

export function WaterSphere({ score, size = 80, className = '' }: WaterSphereProps) {
  const clampedScore = Math.max(1, Math.min(100, Math.round(score)))

  return (
    <View
      className={`water-sphere ${className}`}
      style={{ width: size, height: size }}
    >
      <View className="water-level" style={{ height: `${clampedScore}%` }}>
        <View className="water-wave" />
        <View className="water-wave-second" />
      </View>
      <Text className="water-score" style={{ fontSize: size * 0.32 }}>
        {clampedScore}
      </Text>
    </View>
  )
}
