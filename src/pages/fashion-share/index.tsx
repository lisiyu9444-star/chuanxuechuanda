import { useState } from 'react'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { FashionPoster } from '@/components/fashion-poster'
import type { FashionRatingRecord } from '@/types/fashion'

/**
 * 测评分享落地页（非 tabBar 页面）。
 *
 * 与穿搭结果页分享方案一致：普通页面直接落地，useLoad 获取 shareId 后
 * 拉取测评记录并在本页直接渲染结果海报。测评页 pages/fashion-rating/index
 * 是 tabBar 页面，微信中分享打开 tabBar 页面 query 参数可能丢失，
 * 因此分享路径指向本页而非测评页。
 */
export default function FashionSharePage() {
  const [record, setRecord] = useState<FashionRatingRecord | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  /** 拉取分享的测评记录（公开接口，无需登录） */
  const fetchShared = async (shareId: string) => {
    try {
      const res = await Network.request({ url: `/api/fashion-rating/shared/${shareId}` })
      console.log('[FashionShare] shared response:', res.data)
      const data = res.data?.data as FashionRatingRecord | null | undefined
      if (data?.result) {
        setRecord(data)
      } else {
        setLoadFailed(true)
      }
    } catch (error) {
      console.error('[FashionShare] fetch shared failed:', error)
      setLoadFailed(true)
    }
  }

  useLoad((options) => {
    console.log('[FashionShare] useLoad options:', options)
    const shareId = options?.shareId
    if (!shareId) {
      setLoadFailed(true)
      return
    }
    void fetchShared(shareId)
  })

  // 本页继续分享：保持同一记录的裂变链路
  useShareAppMessage(() => {
    if (record) {
      const { totalScore, stylePersonality, shareTexts } = record.result
      const text = totalScore >= 80 ? shareTexts?.confident : shareTexts?.selfDeprecating
      return {
        title: text || `我的穿搭得了 ${totalScore} 分，被评为"${stylePersonality}"，你敢来挑战吗？`,
        path: `/pages/fashion-share/index?shareId=${record.id}`,
        imageUrl: record.imageUrl,
      }
    }
    return {
      title: 'AI 毒舌时尚官，敢不敢晒出你的穿搭？',
      path: '/pages/fashion-rating/index',
    }
  })

  /** 我也要测：回到测评页上传自己的穿搭照（落地为上传态） */
  const handleGotoRating = () => {
    Taro.switchTab({ url: '/pages/fashion-rating/index' })
  }

  // 结果态：黑色海报（非 tabBar 页，底部无 tabBar 遮挡，常规 pb-10）
  if (record) {
    return (
      <View className="min-h-screen bg-black flex flex-col items-center px-6 pt-8 pb-10">
        <FashionPoster
          imageUrl={record.imageUrl}
          result={record.result}
          onRetry={handleGotoRating}
          retryText="我也要测"
        />
      </View>
    )
  }

  // 加载中 / 失败态
  return (
    <View className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <Text className="block text-sm text-white text-opacity-60 text-center">
        {loadFailed ? '测评记录不存在或已删除' : '正在打开测评结果...'}
      </Text>
      {loadFailed && (
        <Button className="mt-8 rounded-full px-8" onClick={handleGotoRating}>
          <Text>我也要测</Text>
        </Button>
      )}
    </View>
  )
}
