import { useCallback, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Plus } from 'lucide-react-taro'
import { Network } from '@/network'
import { isLoggedIn, requireLogin } from '@/utils/auth'
import { FashionPoster } from '@/components/fashion-poster'
import type { FashionRatingRecord } from '@/types/fashion'

/** 超过该体积（2MB）时压缩图片：长边 ≤1024、jpeg 质量 0.8（PRD 6.1） */
const COMPRESS_THRESHOLD = 2 * 1024 * 1024
const MAX_EDGE = 1024

/** 图片过大时压缩，压缩失败静默回退原图（后端 10MB 上限兜底） */
async function compressIfNeeded(filePath: string, fileSize?: number): Promise<string> {
  try {
    let size = fileSize
    if (size == null) {
      // 小程序端 tempFiles 也有 size；H5 的 chooseImage tempFiles 同样带 size，此处仅兜底
      const fsm = Taro.getFileSystemManager?.()
      if (fsm) {
        const info = await new Promise<{ size: number }>((resolve, reject) => {
          fsm.getFileInfo({ filePath, success: (r) => resolve(r), fail: reject })
        })
        size = info.size
      }
    }
    if (size == null || size <= COMPRESS_THRESHOLD) return filePath

    const imgInfo = await Taro.getImageInfo({ src: filePath })
    const { width, height } = imgInfo
    if (!width || !height) return filePath
    const compressedWidth = width >= height ? MAX_EDGE : Math.round((MAX_EDGE * width) / height)
    const compressed = await Taro.compressImage({ src: filePath, quality: 80, compressedWidth })
    console.log('[FashionRating] compressed:', { originSize: size, compressedWidth })
    return compressed.tempFilePath || filePath
  } catch (error) {
    console.warn('[FashionRating] compress failed, fallback to original:', error)
    return filePath
  }
}

export default function FashionRatingPage() {
  const [view, setView] = useState<'upload' | 'result'>('upload')
  const [record, setRecord] = useState<FashionRatingRecord | null>(null)
  const [remaining, setRemaining] = useState(3)

  /** 拉取今日剩余次数（未登录时保持默认值，点击上传时会先唤起登录） */
  const fetchRemaining = useCallback(async () => {
    if (!isLoggedIn()) return
    try {
      const res = await Network.request({ url: '/api/fashion-rating/remaining' })
      console.log('[FashionRating] remaining response:', res.data)
      const value = res.data?.data?.remaining
      if (typeof value === 'number') setRemaining(value)
    } catch (error) {
      console.error('[FashionRating] fetch remaining failed:', error)
    }
  }, [])

  useDidShow(() => {
    // 从 loading 页带回的最新测评结果：消费一次并切换到结果态
    const latest = Taro.getStorageSync('fashion_latest_result') as FashionRatingRecord | ''
    if (latest && typeof latest === 'object' && latest.result) {
      Taro.removeStorageSync('fashion_latest_result')
      setRecord(latest)
      setView('result')
    }
    fetchRemaining()
  })

  /** 选图 → 压缩 → 存 pending → 跳 loading 页发起测评 */
  const handleUpload = async () => {
    // 测评需登录：未登录唤起全局登录引导
    if (!(await requireLogin())) return
    if (remaining <= 0) {
      Taro.showToast({ title: '今日评分次数已用完，明天再来吧', icon: 'none' })
      return
    }
    try {
      const chosen = await Taro.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      const tempPath = chosen.tempFilePaths?.[0]
      if (!tempPath) return
      const finalPath = await compressIfNeeded(tempPath, chosen.tempFiles?.[0]?.size)
      Taro.setStorageSync('fashion_pending_image', finalPath)
      Taro.navigateTo({ url: '/pages/loading/index?mode=fashion-rating' })
    } catch (error: any) {
      // 用户取消选图不提示
      if (!String(error?.errMsg || '').includes('cancel')) {
        console.error('[FashionRating] choose image failed:', error)
        Taro.showToast({ title: '选择图片失败，请重试', icon: 'none' })
      }
    }
  }

  /** 再测一次：回到上传态并刷新剩余次数 */
  const handleRetry = () => {
    setRecord(null)
    setView('upload')
    fetchRemaining()
  }

  // 分享：结果态带分数与人格（高分自信版 / 低分自黑版），上传态用默认邀请语
  useShareAppMessage(() => {
    if (view === 'result' && record) {
      const { totalScore, stylePersonality, shareTexts } = record.result
      const text = totalScore >= 80 ? shareTexts?.confident : shareTexts?.selfDeprecating
      return {
        title: text || `我的穿搭得了 ${totalScore} 分，被评为"${stylePersonality}"，你敢来挑战吗？`,
        path: '/pages/fashion-rating/index?referrer=share',
        imageUrl: record.imageUrl,
      }
    }
    return {
      title: 'AI 毒舌时尚官，敢不敢晒出你的穿搭？',
      path: '/pages/fashion-rating/index?referrer=share',
    }
  })

  // ===== 结果态：黑色海报 =====
  if (view === 'result' && record) {
    return (
      <View className="min-h-screen bg-black flex flex-col items-center px-6 pt-8 pb-10">
        <FashionPoster imageUrl={record.imageUrl} result={record.result} onRetry={handleRetry} />
      </View>
    )
  }

  // ===== 上传态：轻奢风（还原原型 fashion-rating.html） =====
  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* 品牌点缀区：衬线体品牌名 + 金色细分隔线 + 金色英文小字 */}
      <View className="px-4 pt-8 flex flex-col items-center">
        <Text className="block font-display text-xl font-medium tracking-wide text-foreground">AI 毒舌时尚官</Text>
        <View className="w-8 h-px bg-primary-container my-2" />
        <Text className="block text-xs font-semibold tracking-[0.35em] text-primary-container">FASHION RATING</Text>
      </View>

      {/* 上留白：撑开空间，让上传卡落在屏幕纵向视觉重心处 */}
      <View className="flex-[2]" />

      {/* 上传卡片区：虚线卡片，整卡可点击 */}
      <View className="px-4 flex flex-col items-center">
        <View
          className={`w-[70%] border-2 border-dashed border-outline-variant border-opacity-60 rounded-2xl bg-card py-14 flex flex-col items-center justify-center gap-3 ${
            remaining <= 0 ? 'opacity-40' : 'active:scale-[0.98]'
          }`}
          onClick={handleUpload}
        >
          <Plus size={32} color="#B9975B" />
          <Text className="block text-base font-semibold text-foreground">上传穿搭照片</Text>
        </View>
        <Text className="block mt-4 text-xs text-muted-foreground text-center">拍照或从相册选择</Text>
      </View>

      {/* 下留白：略小于上留白，形成重心偏下的杂志式构图 */}
      <View className="flex-1" />

      {/* 底部剩余次数 */}
      <Text className="block text-xs text-muted-foreground text-center pb-8">
        {remaining > 0 ? `今日还可测 ${remaining} 次` : '今日评分次数已用完'}
      </Text>
    </View>
  )
}
