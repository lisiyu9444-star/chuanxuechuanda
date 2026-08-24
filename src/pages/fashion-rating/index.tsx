import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow, useLoad, useShareAppMessage } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Plus } from 'lucide-react-taro'
import { Network } from '@/network'
import { isLoggedIn, requireLogin } from '@/utils/auth'
import { FashionPoster } from '@/components/fashion-poster'
import { LoginSheet } from '@/components/login-sheet'
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
  const [remaining, setRemaining] = useState(99)
  /** 是否从分享卡片进入（决定重测按钮文案为「我也要测」） */
  const [fromShare, setFromShare] = useState(false)

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

  /** 分享落地：根据 shareId 拉取测评记录（公开接口，无需登录），直接展示结果海报 */
  const fetchShared = useCallback(async (shareId: string) => {
    try {
      const res = await Network.request({ url: `/api/fashion-rating/shared/${shareId}` })
      console.log('[FashionRating] shared response:', res.data)
      const data = res.data?.data as FashionRatingRecord | null | undefined
      if (data?.result) {
        setRecord(data)
        setView('result')
      } else {
        Taro.showToast({ title: '测评记录不存在或已删除', icon: 'none' })
      }
    } catch (error) {
      console.error('[FashionRating] fetch shared failed:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    }
  }, [])

  useLoad((options) => {
    console.log('[FashionRating] useLoad options:', options)
    // 显式设置标题，避免 tabBar 页面标题被客户端缓存成其他页面文案；
    // nextTick 延后到页面 root view 就绪后再调，否则会报 removeTextView:fail no root view
    Taro.nextTick(() => {
      Taro.setNavigationBarTitle({ title: 'AI 毒舌时尚官' }).catch((e) => {
        console.warn('[FashionRating] setNavigationBarTitle failed:', e)
      })
    })
    const shareId = options?.shareId
    if (shareId) {
      setFromShare(true)
      fetchShared(shareId)
    }
  })

  // 导航栏配色跟随页面状态：结果态黑底白字，上传态白底黑字
  useEffect(() => {
    // nextTick 确保页面 root view 就绪，避免 removeTextView:fail 报错
    Taro.nextTick(() => {
      Taro.setNavigationBarColor(
        view === 'result'
          ? { frontColor: '#ffffff', backgroundColor: '#000000' }
          : { frontColor: '#000000', backgroundColor: '#ffffff' },
      ).catch((e) => {
        console.warn('[FashionRating] setNavigationBarColor failed:', e)
      })
    })
  }, [view])

  useDidShow(() => {
    // 从 loading 页带回的最新测评结果：消费一次并切换到结果态
    const latest = Taro.getStorageSync('fashion_latest_result') as FashionRatingRecord | ''
    if (latest && typeof latest === 'object' && latest.result) {
      Taro.removeStorageSync('fashion_latest_result')
      setFromShare(false)
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

  /** 再测一次 / 我也要测：回到上传态并刷新剩余次数 */
  const handleRetry = () => {
    setRecord(null)
    setFromShare(false)
    setView('upload')
    fetchRemaining()
  }

  // 分享：结果态带 shareId（好友打开直达结果海报），上传态用默认邀请语
  useShareAppMessage(() => {
    if (view === 'result' && record) {
      const { totalScore, stylePersonality, shareTexts } = record.result
      const text = totalScore >= 80 ? shareTexts?.confident : shareTexts?.selfDeprecating
      return {
        title: text || `我的穿搭得了 ${totalScore} 分，被评为"${stylePersonality}"，你敢来挑战吗？`,
        path: `/pages/fashion-rating/index?shareId=${record.id}`,
        imageUrl: record.imageUrl,
      }
    }
    return {
      title: 'AI 毒舌时尚官，敢不敢晒出你的穿搭？',
      path: '/pages/fashion-rating/index',
    }
  })

  // ===== 结果态：黑色海报 =====
  if (view === 'result' && record) {
    return (
      // pb-32 留出 tabBar 高度，避免底部点评/操作按钮被原生 tabBar 遮挡
      <View className="min-h-screen bg-black flex flex-col items-center px-6 pt-8 pb-32">
        <FashionPoster
          imageUrl={record.imageUrl}
          result={record.result}
          onRetry={handleRetry}
          retryText={fromShare ? '我也要测' : '再测一次'}
        />
      </View>
    )
  }

  // ===== 上传态：白底黑字，与其他页面风格一致 =====
  return (
    <View className="min-h-screen bg-background flex flex-col">
      {/* 标题区 */}
      <View className="px-4 pt-8 flex flex-col items-center">
        <Text className="block text-xl font-semibold text-foreground">AI 毒舌时尚官</Text>
        <Text className="block text-xs text-muted-foreground mt-2">上传穿搭照片，AI 毒舌打分</Text>
      </View>

      {/* 上留白：撑开空间，让上传卡落在屏幕纵向视觉重心处 */}
      <View className="flex-[2]" />

      {/* 上传卡片区：虚线卡片，整卡可点击 */}
      <View className="px-4 flex flex-col items-center">
        <View
          className={`w-[70%] border-2 border-dashed border-slate-300 rounded-2xl bg-white py-14 flex flex-col items-center justify-center gap-3 ${
            remaining <= 0 ? 'opacity-40' : 'active:scale-[0.98]'
          }`}
          onClick={handleUpload}
        >
          <Plus size={32} color="#0f172a" />
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

      {/* 全局登录弹层（requireLogin 唤起，各页面需自行挂载实例） */}
      <LoginSheet />
    </View>
  )
}
