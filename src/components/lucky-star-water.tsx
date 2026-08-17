import { View, Text } from '@tarojs/components'
import './lucky-star-water.css'

interface Point {
  x: number
  y: number
}

function createRoundedStarPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  corners = 5,
  roundness = 0.28
): string {
  const points: Point[] = []
  for (let i = 0; i < corners * 2; i++) {
    const angle = (i * Math.PI) / corners - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    })
  }

  let d = ''
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const curr = points[i]
    const next = points[(i + 1) % points.length]

    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
    const v2 = { x: next.x - curr.x, y: next.y - curr.y }
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

    const dist = Math.min(len1, len2) * roundness
    const p1 = {
      x: curr.x - (v1.x / len1) * dist,
      y: curr.y - (v1.y / len1) * dist,
    }
    const p2 = {
      x: curr.x + (v2.x / len2) * dist,
      y: curr.y + (v2.y / len2) * dist,
    }

    if (i === 0) {
      d += `M ${p1.x.toFixed(2)},${p1.y.toFixed(2)} `
    }
    d += `Q ${curr.x.toFixed(2)},${curr.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} `
  }
  d += 'Z'
  return d
}

interface LuckyStarWaterProps {
  score: number
  size?: number
}

export function LuckyStarWater({ score, size = 84 }: LuckyStarWaterProps) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)))
  const waterHeight = safeScore
  const starPath = createRoundedStarPath(50, 52, 46, 19, 5, 0.28)
  const waveY = 100 - waterHeight

  return (
    <View className="lucky-star-water" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id="starBody" cx="38%" cy="32%" r="72%" fx="35%" fy="28%">
            <stop offset="0%" stopColor="#BFDBFE" />
            <stop offset="35%" stopColor="#60A5FA" />
            <stop offset="75%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <filter id="starShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1E3A8A" floodOpacity="0.35" />
          </filter>
          <clipPath id="starClip">
            <path d={starPath} />
          </clipPath>
        </defs>

        <path
          d={starPath}
          fill="url(#starBody)"
          stroke="#1E40AF"
          strokeWidth="1.2"
          strokeLinejoin="round"
          filter="url(#starShadow)"
        />

        <g clipPath="url(#starClip)">
          <rect x="0" y={waveY} width="100" height={waterHeight} fill="url(#waterGradient)" />
          <g className="lucky-star-wave-group" style={{ transform: `translateY(${waveY}px)` }}>
            <path
              className="lucky-star-wave lucky-star-wave-1"
              d="M-60,-5 Q-30,-14 0,-5 T60,-5 T120,-5 T180,-5 V12 H-60 Z"
              fill="rgba(255,255,255,0.35)"
            />
            <path
              className="lucky-star-wave lucky-star-wave-2"
              d="M-60,0 Q-22,-9 16,0 T92,0 T168,0 V10 H-60 Z"
              fill="rgba(255,255,255,0.18)"
            />
          </g>
        </g>

        <ellipse
          cx="36"
          cy="30"
          rx="14"
          ry="10"
          fill="rgba(255,255,255,0.32)"
          clipPath="url(#starClip)"
        />
      </svg>
      <Text className="star-score" style={{ fontSize: Math.round(size * 0.32) }}>
        {safeScore}
      </Text>
    </View>
  )
}
