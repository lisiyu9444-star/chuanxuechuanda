import { View } from '@tarojs/components'

interface WuxingLoaderProps {
  /** 是否加速（营造长时间等待后的加速感） */
  isAccelerated?: boolean
  /** 缩放比例，1 为原始 180x180 尺寸 */
  scale?: number
  className?: string
}

/**
 * 五行流动加载动画（共享组件）
 * 样式定义在全局 app.css 中，供 loading 页与结果页复用
 */
export function WuxingLoader({ isAccelerated = false, scale = 1, className = '' }: WuxingLoaderProps) {
  return (
    <View
      className={`wuxing-orbit-container ${isAccelerated ? 'wuxing-speedup' : ''} ${className}`}
      style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
    >
      <View className="wuxing-orbit-ring" />
      <View className="wuxing-core-ring" />
      <View className="wuxing-core" />
      <View className="wuxing-dot wuxing-dot-wood" />
      <View className="wuxing-dot wuxing-dot-fire" />
      <View className="wuxing-dot wuxing-dot-earth" />
      <View className="wuxing-dot wuxing-dot-metal" />
      <View className="wuxing-dot wuxing-dot-water" />
    </View>
  )
}
