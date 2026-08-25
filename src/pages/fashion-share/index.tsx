import Taro, { useLoad } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import type { FashionRatingRecord } from '@/types/fashion'

/**
 * 测评分享落地中间页（非 tabBar 页面）。
 *
 * 背景：测评页 pages/fashion-rating/index 是 tabBar 页面，微信小程序中
 * 通过分享链接打开 tabBar 页面时 query 参数（shareId）可能丢失，导致好友
 * 打开后进入上传态而非结果海报。
 *
 * 因此分享路径指向本页：拉取测评记录 → 写入本地缓存（测评页 useDidShow 消费）
 * → switchTab 跳转测评页展示结果海报。
 */
export default function FashionSharePage() {
  /** 拉取分享记录并跳转测评页 */
  const openShared = async (shareId: string) => {
    try {
      const res = await Network.request({ url: `/api/fashion-rating/shared/${shareId}` })
      console.log('[FashionShare] shared response:', res.data)
      const data = res.data?.data as FashionRatingRecord | null | undefined
      if (data?.result) {
        // 写入测评页消费的数据 + 分享来源标记（决定重测按钮文案为「我也要测」）
        Taro.setStorageSync('fashion_latest_result', data)
        Taro.setStorageSync('fashion_latest_from_share', '1')
        Taro.switchTab({ url: '/pages/fashion-rating/index' })
        return
      }
      Taro.showToast({ title: '测评记录不存在或已删除', icon: 'none' })
    } catch (error) {
      console.error('[FashionShare] fetch shared failed:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    }
    // 失败/记录不存在：回到测评页上传态（延迟让 toast 可见）
    setTimeout(() => Taro.switchTab({ url: '/pages/fashion-rating/index' }), 1200)
  }

  useLoad((options) => {
    console.log('[FashionShare] useLoad options:', options)
    const shareId = options?.shareId
    if (!shareId) {
      Taro.showToast({ title: '分享参数缺失', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/fashion-rating/index' }), 1200)
      return
    }
    void openShared(shareId)
  })

  // 黑底过渡页：与结果海报视觉衔接，避免白屏闪烁
  return (
    <View className="min-h-screen bg-black flex flex-col items-center justify-center">
      <Text className="block text-sm text-white text-opacity-60">正在打开测评结果...</Text>
    </View>
  )
}
