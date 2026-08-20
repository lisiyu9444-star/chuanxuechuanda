import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useUnload } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { WuxingLoader } from '@/components/wuxing-loader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Share2, RefreshCw, Lock, Shirt, Square, Footprints, ShoppingBag, Gem, Play } from 'lucide-react-taro'
import { Network } from '@/network'
import { useLoadingTask } from '@/hooks/useLoadingTask'
import { useRewardedVideoAd } from '@/hooks/useRewardedVideoAd'
import { getArchiveById, getDailyResult, getNativeResult, saveDailyResult, saveNativeResult, getToday } from '@/utils/archiveStorage'
import { saveHistoryFromDailyResult, saveHistoryFromNativeResult } from '@/utils/historyStorage'
import { ELEMENT_COLORS } from '@/constants/element-colors'
import { ensureRemoteAssets, refreshImageUrls, extractTosKeyFromUrl, type RemoteAssets } from '@/constants/remote-assets'
import type { BaZiResult, StylistResult } from '@/types/bazi'
import type { NativeResult } from '@/types/archive'
import './index.css'

const COLOR_MAP: Record<string, string> = {
  玄青色: '#1a237e',
  玄青: '#1a237e',
  藏青色: '#1e3a5f',
  藏青: '#1e3a5f',
  黛蓝: '#3b4d61',
  靛蓝: '#4b0082',
  蔚蓝: '#007fff',
  宝蓝: '#4a90e2',
  深蓝色: '#1e3a8a',
  蓝色: '#2563eb',
  石青: '#1685a9',
  天蓝色: '#87ceeb',
  湖蓝色: '#008b8b',
  雾霾蓝: '#9db2c5',
  浅蓝色: '#add8e6',
  黑色: '#1f2937',
  墨黑: '#1c1c1c',
  炭黑: '#1f2937',
  黝黑: '#2d2d2d',
  黯黑: '#1a1a1a',
  鸦青: '#4a5568',
  深灰: '#4b5563',
  灰色: '#6b7280',
  烟灰: '#6b7280',
  铁灰: '#4b5563',
  浅灰: '#d1d5db',
  银色: '#c0c0c0',
  亮银: '#e0e0e0',
  银白: '#e8e8e8',
  白色: '#f8f9fa',
  纯白色: '#ffffff',
  亮白: '#ffffff',
  雪白: '#fffafa',
  霜白: '#f2f3f5',
  乳白: '#fffdd0',
  象牙白: '#fffff0',
  月白: '#d6ecf0',
  铅白: '#e4e4e4',
  米白: '#faf9f6',
  米白色: '#faf9f6',
  米色: '#f5f5dc',
  香槟色: '#f7e7ce',
  香槟金: '#f7e7ce',
  金色: '#d4af37',
  金黄色: '#ffd700',
  红色: '#dc2626',
  深红: '#8b0000',
  绛纱红: '#b22222',
  绛纱: '#b22222',
  酒红色: '#722f37',
  朱砂: '#e34234',
  海棠红: '#f03752',
  石榴红: '#f20c00',
  樱桃红: '#de3163',
  珊瑚红: '#f08080',
  橙红色: '#ff4500',
  橘红: '#ff4500',
  品红: '#ff00ff',
  洋红: '#ff00ff',
  玫红色: '#c71585',
  桃红: '#f47983',
  妃色: '#ed6d8e',
  胭脂: '#9d2933',
  粉色: '#f472b6',
  玫粉: '#ff69b4',
  黄色: '#facc15',
  缃叶黄: '#f4d03f',
  缃叶: '#f4d03f',
  土黄: '#d2b48c',
  土黄色: '#d2b48c',
  姜黄: '#eec900',
  鹅黄: '#fff143',
  杏黄: '#f8b500',
  明黄: '#ffd700',
  秋香色: '#d4a574',
  卡其色: '#c3b091',
  驼色: '#c19a6b',
  棕色: '#8b5a2b',
  咖啡色: '#6f4e37',
  大地色: '#8b7355',
  褐色: '#8b4513',
  绿色: '#16a34a',
  深绿: '#14532d',
  墨绿色: '#1b4d3e',
  橄榄绿: '#6b8e23',
  薄荷绿: '#98ff98',
  翠绿色: '#00a86b',
  葱绿: '#0dbc79',
  豆绿: '#9ed048',
  柳绿: '#c0dd3f',
  青色: '#008080',
  紫色: '#9333ea',
  深紫: '#581c87',
  淡紫: '#c4b5fd',
  橙色: '#f97316',
  裸色: '#e8c4a2',
  // 单字兜底
  红: '#dc2626',
  橙: '#f97316',
  黄: '#facc15',
  绿: '#16a34a',
  青: '#008080',
  蓝: '#2563eb',
  紫: '#9333ea',
  黑: '#1f2937',
  白: '#f8f9fa',
  灰: '#6b7280',
  棕: '#8b5a2b',
  粉: '#f472b6',
  金: '#d4af37',
  银: '#c0c0c0'
}

function getColorHex(name: string): string {
  const normalized = name.replace(/[\s·,，]/g, '')
  if (!normalized) return '#9ca3af'

  // 1. 精确匹配
  const direct = COLOR_MAP[normalized]
  if (direct) return direct

  // 2. 包含匹配（颜色名包含关键词，或关键词包含颜色名）
  for (const key of Object.keys(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return COLOR_MAP[key]
    }
  }

  // 3. 取最后一个字匹配（如珊瑚橙 -> 橙）
  const lastChar = normalized.slice(-1)
  if (lastChar && COLOR_MAP[lastChar]) return COLOR_MAP[lastChar]

  // 4. 取最后两个字匹配（如玫瑰红 -> 玫红）
  const lastTwo = normalized.slice(-2)
  if (lastTwo && COLOR_MAP[lastTwo]) return COLOR_MAP[lastTwo]

  return '#9ca3af'
}


// 兜底图 URL 由 remote-assets 动态签发，禁止硬编码签名 URL（会过期）

interface LuckyScore {
  total: number
  love: number
  career: number
  family: number
  life: number
  study: number
  description: string
}

interface DailyResult {
  date: string
  archiveId: string
  baziResult: BaZiResult
  llmPlan: StylistResult
  luckyScore: LuckyScore
  ganZhiDate: { month: string; day: string }
  dailyYongShen: string
  dailyXiShen: string
  imageUrl?: string
  tryOnUrl?: string
  imageKey?: string
  tryOnKey?: string
  generatedAt: number
}



const ResultPage = () => {
  const [result, setResult] = useState<BaZiResult | null>(null)
  // 静态资源（兜底图等）动态签发的 URL
  const [assets, setAssets] = useState<RemoteAssets | null>(null)
  // 进行中的生图任务 ID（平铺图/上身图），退出页面时通知后端真实中断
  const flatTaskIdRef = useRef('')
  const tryOnTaskIdRef = useRef('')
  // 图片 Tab 切换：'flat' = 平铺图, 'tryon' = 上身图
  const [activeTab, setActiveTab] = useState<'flat' | 'tryon'>('flat')
  // 上身图 URL（生成后缓存）
  const [tryOnUrl, setTryOnUrl] = useState<string>('')
  // 平铺图 URL（本地解锁后缓存）
  const [flatImageUrl, setFlatImageUrl] = useState<string>('')
  // 当前页面模式：'daily' 今日穿搭 | 'native' 本命穿搭 | 'history' 历史记录
  const [pageMode, setPageMode] = useState<'daily' | 'native' | 'history'>('daily')
  const pageModeRef = useRef<'daily' | 'native' | 'history'>('daily')
  // 功能开关：分享功能是否开启
  // 功能开关：是否显示玄学相关内容（八字概览、喜用神分析），穿搭模块始终展示
  const [showBaZiContent, setShowBaZiContent] = useState(true)
  // 广告失败兜底放行开关（服务端 features 下发，默认 false 严格模式：广告位已审核通过，须完整观看）
  const [adFailOpen, setAdFailOpen] = useState(false)
  // 广告失败自动放行错误码白名单（服务端 features 下发：审核中/单元无效/已关闭等确定性不可用场景）
  const [adAutoSkipErrCodes, setAdAutoSkipErrCodes] = useState<number[]>([1002, 1005, 1008])
  // 分享 ID（用于朋友圈分享）
  const [shareId, setShareId] = useState('')
  // 从分享链接进入时的加载态
  const [shareLoading, setShareLoading] = useState(false)
  // 页面数据加载态
  const [pageLoading, setPageLoading] = useState(false)
  // 分享数据是否准备就绪（shareId 已生成）
  const [shareReady, setShareReady] = useState(false)
  // 再测一次二次确认弹窗
  const [showRetestConfirm, setShowRetestConfirm] = useState(false)
  const [archiveStyle, setArchiveStyle] = useState<string>('')
  // 从分享链接打开时携带的 shareId
  const [urlShareId, setUrlShareId] = useState('')
  // 防止分享保存重复触发
  const isSavingRef = useRef(false)
  // 标记是否从分享链接打开
  const fromShareRef = useRef(false)
  // 当前档案 ID
  const currentArchiveIdRef = useRef('')
  // 当前完整的 DailyResult 缓存（用于历史记录同步）
  const dailyResultRef = useRef<DailyResult | null>(null)
  // 当前完整的 NativeResult 缓存（用于本命穿搭图片状态同步）
  const nativeResultRef = useRef<NativeResult | null>(null)

  // 同步当前结果到历史记录
  const syncHistoryRecord = (dailyResult: DailyResult, patch?: { imageUrl?: string; tryOnUrl?: string; imageKey?: string; tryOnKey?: string }) => {
    try {
      const archive = getArchiveById(dailyResult.archiveId)
      saveHistoryFromDailyResult(dailyResult, archive, patch)
    } catch (e) {
      console.error('Sync history record failed:', e)
    }
  }

  // 激励视频广告（仅微信小程序环境生效）
  const { showAd } = useRewardedVideoAd({
    adUnitId: 'adunit-8310bd6159a47249',
    onError: (err) => {
      console.error('[ResultPage] rewarded video ad error', err)
    },
  })

  // 上身图生成任务（使用 useLoadingTask 管理）
  const {
    execute: generateTryOn,
    loading: tryOnLoading,
  } = useLoadingTask({
    url: '/api/bazi/try-on',
    method: 'POST',
    autoExecute: false,
    onSuccess: (data: any) => {
      console.log('Try-on success:', data)
      tryOnTaskIdRef.current = ''
      if (data?.tryOnUrl) {
        setTryOnUrl(data.tryOnUrl)
        // tryOnKey 随 URL 一并持久化，URL 过期后可凭 key 换签
        const tryOnPatch = { tryOnUrl: data.tryOnUrl as string, tryOnKey: (data.tryOnKey as string) || '' }
        if (pageModeRef.current === 'native') {
          // 本命穿搭上身图独立存储，不混入今日穿搭
          updateNativeCache(tryOnPatch)
          if (nativeResultRef.current) {
            const archive = getArchiveById(nativeResultRef.current.archiveId)
            saveHistoryFromNativeResult(nativeResultRef.current, archive, tryOnPatch)
          }
        } else {
          if (dailyResultRef.current) {
            syncHistoryRecord(dailyResultRef.current, tryOnPatch)
          }
          // 更新 dailyResult 缓存中的上身图
          updateDailyCache(tryOnPatch)
        }
      } else {
        Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    },
    onError: (err) => {
      console.error('Try-on failed:', err)
      tryOnTaskIdRef.current = ''
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    },
  })

  // 平铺图解锁加载态
  const [flatImageLoading, setFlatImageLoading] = useState(false)

  // 更新 dailyResult 本地缓存
  const updateDailyCache = (updates: { imageUrl?: string; tryOnUrl?: string; imageKey?: string; tryOnKey?: string }) => {
    try {
      const archiveId = currentArchiveIdRef.current
      const today = getToday()
      const dailyResult = getDailyResult(archiveId, today)
      if (dailyResult) {
        const updated: DailyResult = {
          ...dailyResult,
          ...updates,
          baziResult: { ...dailyResult.baziResult, ...updates },
          generatedAt: Date.now(),
        }
        saveDailyResult(updated)
      }
    } catch (e) {
      console.error('Update daily cache failed:', e)
    }
  }

  // 更新 nativeResult 本地缓存（本命穿搭图片独立存储）
  const updateNativeCache = (updates: { imageUrl?: string; tryOnUrl?: string; imageKey?: string; tryOnKey?: string }) => {
    try {
      const archiveId = currentArchiveIdRef.current
      const nativeResult = getNativeResult(archiveId)
      if (nativeResult) {
        const updated: NativeResult = {
          ...nativeResult,
          ...updates,
          generatedAt: Date.now(),
        }
        saveNativeResult(updated)
      }
    } catch (e) {
      console.error('Update native cache failed:', e)
    }
  }

  // 激励视频解锁流程：返回 true 表示可继续（完整观看，或广告失败时按策略自动放行）
  const ensureAdWatched = async (incompleteTip: string): Promise<boolean> => {
    const { watched, error: adError } = await showAd()
    if (watched) return true
    if (adError) {
      // 广告加载/展示失败：总开关开启，或错误码命中「广告位确定性不可用」白名单
      // （1002 单元无效 / 1005 审核中或被拒 / 1008 已关闭）时自动放行，无需人工切开关；
      // 暂时性失败（如 1004 无填充、网络抖动）不放行，提示重试
      const errCode = Number(adError.errCode)
      const autoSkip = adFailOpen || (Number.isFinite(errCode) && adAutoSkipErrCodes.includes(errCode))
      if (autoSkip) {
        Taro.showToast({ title: '广告暂不可用，已为你直接解锁', icon: 'none' })
        return true
      }
      Taro.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
      return false
    }
    // 广告正常展示但用户中途关闭
    Taro.showToast({ title: incompleteTip, icon: 'none' })
    return false
  }

  // 解锁平铺图
  const handleUnlockFlatImage = async () => {
    if (!result?.llmPlan?.imagePrompt) {
      Taro.showToast({ title: '缺少生图描述，请重试', icon: 'none' })
      return
    }
    const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
    if (isWeapp) {
      const canProceed = await ensureAdWatched('请完整观看视频以解锁')
      if (!canProceed) return
    }
    setFlatImageLoading(true)
    // clientTaskId 用于用户退出页面时取消后端 AI 请求
    const taskId = `flat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    flatTaskIdRef.current = taskId
    try {
      const res: any = await Network.request({
        url: '/api/bazi/generate-image',
        method: 'POST',
        // 生图耗时长（后端兜底 120s），显式设置超时，避免默认 60s 提前失败
        timeout: 120000,
        data: {
          imagePrompt: result.llmPlan.imagePrompt,
          taskId,
          clientTaskId: taskId,
        },
      })
      console.log('Generate flat image response:', res.data)
      const imageUrl = res.data?.data?.imageUrl
      if (imageUrl) {
        // imageKey 随 URL 一并持久化，URL 过期后可凭 key 换签
        const imageKey = (res.data?.data?.imageKey as string) || ''
        const imagePatch = { imageUrl, imageKey }
        setFlatImageUrl(imageUrl)
        if (pageModeRef.current === 'native') {
          updateNativeCache(imagePatch)
          if (nativeResultRef.current) {
            const archive = getArchiveById(nativeResultRef.current.archiveId)
            saveHistoryFromNativeResult(nativeResultRef.current, archive, imagePatch)
          }
        } else {
          updateDailyCache(imagePatch)
          if (dailyResultRef.current) {
            syncHistoryRecord(dailyResultRef.current, imagePatch)
          }
        }
      } else {
        Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    } catch (err) {
      console.error('Generate flat image failed:', err)
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      flatTaskIdRef.current = ''
      setFlatImageLoading(false)
    }
  }

  // 解锁上身图
  const handleUnlockTryOn = async () => {
    if (!result) return
    const hasFlatImage = Boolean(flatImageUrl || result.imageUrl)
    if (!hasFlatImage) {
      Taro.showToast({ title: '请先解锁平铺图', icon: 'none' })
      return
    }
    const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
    if (isWeapp) {
      const canProceed = await ensureAdWatched('请完整观看视频以解锁上身图')
      if (!canProceed) return
    }
    // clientTaskId 用于用户退出页面时取消后端 AI 请求
    const taskId = `tryon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    tryOnTaskIdRef.current = taskId
    generateTryOn({
      imageUrl: flatImageUrl || result.imageUrl,
      outfit: result.outfit,
      gender: result.gender,
      age: result.age,
      clientTaskId: taskId,
    })
  }

  // 获取主题色：今日穿搭用今日用神，本命穿搭/历史记录用本命用神
  const themeColor = pageMode === 'daily'
    ? (result?.dailyYongShen
      ? ELEMENT_COLORS[result.dailyYongShen] || '#9333ea'
      : '#9333ea')
    : ELEMENT_COLORS[result?.favorableElement || ''] || '#9333ea'

  // 签名 URL 过期导致图片加载失败时，凭 URL 中的对象 key 换签重试（每 URL 只重试一次）
  const refreshedUrlsRef = useRef<Set<string>>(new Set())
  const handleImageLoadError = (url: string, apply: (newUrl: string) => void) => {
    if (!url || refreshedUrlsRef.current.has(url)) return
    refreshedUrlsRef.current.add(url)
    const key = extractTosKeyFromUrl(url)
    if (!key) return
    refreshImageUrls([key])
      .then((map) => {
        const newUrl = map?.[key]
        if (newUrl) apply(newUrl)
      })
      .catch(() => {})
  }

  // 页面卸载时取消进行中的后端 AI 请求（平铺图/上身图）
  useUnload(() => {
    const cancelTask = (taskId: string) => {
      if (!taskId) return
      Network.request({
        url: '/api/bazi/cancel',
        method: 'POST',
        timeout: 5000,
        data: { taskId },
      }).catch(() => {
        // 取消失败静默处理，页面即将卸载
      })
    }
    cancelTask(flatTaskIdRef.current)
    cancelTask(tryOnTaskIdRef.current)
  })

  useDidShow(() => {
    // 拉取动态签发的远程静态资源（兜底图等）
    ensureRemoteAssets().then((a) => {
      if (a) setAssets(a)
    })
    // 检查页面模式与分享参数
    const router = Taro.getCurrentInstance().router
    const shareIdFromUrl = router?.params?.shareId
    const mode = (router?.params?.mode as 'daily' | 'native' | 'history') || 'daily'
    const archiveId = router?.params?.archiveId || Taro.getStorageSync('currentArchiveId') || ''
    const recordMode = (router?.params?.recordMode as 'daily' | 'native') || 'daily'
    const historyDate = router?.params?.date
    currentArchiveIdRef.current = archiveId
    // 读取档案中的穿搭风格，用于结果页标签展示
    setArchiveStyle(getArchiveById(archiveId)?.stylePreference || '')
    setPageMode(mode)
    pageModeRef.current = mode
    setUrlShareId(shareIdFromUrl || '')

    if (shareIdFromUrl) {
      // 从分享链接打开，加载分享者的数据
      console.log('Loading shared result with shareId:', shareIdFromUrl)
      fromShareRef.current = true
      setShareLoading(true)
      ;(async () => {
        try {
          const res: any = await Network.request({
            url: `/api/share/${shareIdFromUrl}`,
            method: 'GET',
          })
          console.log('Shared result response:', res.data)
          // 检查是否过期
          if (res.data?.expired) {
            Taro.showToast({ title: '分享链接已过期', icon: 'none' })
            // 跳转到首页
            setTimeout(() => {
              Taro.switchTab({ url: '/pages/index/index' })
            }, 1500)
            return
          }
          if (res.data?.result) {
            const sharedResult = res.data.result as BaZiResult
            setResult(sharedResult)
            // 缓存到本地，方便刷新后仍能查看
            try {
              Taro.setStorageSync('baziResult', sharedResult)
            } catch (e) {
              console.error('Save shared result to storage failed:', e)
            }
            // 如果分享数据中包含上身图，直接设置
            if (res.data.tryOnUrl) {
              setTryOnUrl(res.data.tryOnUrl)
            }
          } else {
            // 分享数据不存在，加载本地数据
            loadLocalResult(mode, archiveId, historyDate, recordMode)
          }
        } catch (err) {
          console.error('Failed to load shared result:', err)
          // 加载本地数据
          loadLocalResult(mode, archiveId, historyDate, recordMode)
        } finally {
          setShareLoading(false)
        }
      })()
    } else {
      // 正常打开，加载本地数据
      loadLocalResult(mode, archiveId, historyDate, recordMode)
    }
  })

  // 首页跳转锚点定位：anchor=outfit 时滚动到今日穿搭模块
  useEffect(() => {
    if (!result) return
    const router = Taro.getCurrentInstance().router
    if (router?.params?.anchor === 'outfit') {
      setTimeout(() => {
        Taro.pageScrollTo({ selector: '#outfit-section', duration: 300 }).catch((err) => {
          console.error('Scroll to outfit section failed:', err)
        })
      }, 300)
    }
  }, [result])

  const fetchAndCacheResult = async (mode: 'daily' | 'native', archiveId: string) => {
    setPageLoading(true)
    try {
      const archive = getArchiveById(archiveId)
      if (!archive) {
        Taro.showToast({ title: '档案不存在', icon: 'none' })
        return
      }
      const endpoint = mode === 'native' ? '/api/bazi/native' : '/api/bazi/daily'
      const res: any = await Network.request({
        url: endpoint,
        method: 'POST',
        data: {
          nickname: archive.nickname,
          gender: archive.gender,
          calendarType: archive.calendarType,
          birthDate: archive.birthDate,
          birthTime: archive.birthTime,
          location: archive.location,
          age: archive.age,
          stylePreference: archive.stylePreference,
        },
      })
      console.log(`[Result] ${endpoint} response:`, res.data)
      const payload = res.data?.data
      if (!payload?.baziResult) {
        Taro.showToast({ title: '数据加载失败', icon: 'none' })
        return
      }
      if (mode === 'native') {
        const nativeResult: NativeResult = {
          archiveId,
          baziResult: payload.baziResult,
          llmPlan: payload.llmPlan,
          generatedAt: Date.now(),
        }
        saveNativeResult(nativeResult)
        nativeResultRef.current = nativeResult
        setResult({ ...payload.baziResult, llmPlan: payload.llmPlan })
      } else {
        const today = getToday()
        const bazi = payload.baziResult
        const dailyResult: DailyResult = {
          archiveId,
          date: today,
          baziResult: bazi,
          llmPlan: payload.llmPlan,
          luckyScore: payload.luckyScore,
          ganZhiDate: bazi.ganZhiDate,
          dailyYongShen: bazi.dailyYongShen || bazi.favorableElement,
          dailyXiShen: bazi.dailyXiShen || bazi.favorableAnalysis?.assistantXiShen,
          imageUrl: bazi.imageUrl || undefined,
          imageKey: bazi.imageKey || undefined,
          tryOnUrl: undefined,
          generatedAt: Date.now(),
        }
        saveDailyResult(dailyResult)
        setResult({ ...bazi, llmPlan: payload.llmPlan })
        setFlatImageUrl(bazi.imageUrl || '')
        dailyResultRef.current = dailyResult
        syncHistoryRecord(dailyResult)
      }
    } catch (err) {
      console.error('[Result] fetch result failed:', err)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setPageLoading(false)
    }
  }

  const loadLocalResult = async (
    mode: 'daily' | 'native' | 'history',
    archiveId: string,
    historyDate?: string,
    recordMode: 'daily' | 'native' = 'daily'
  ) => {
    if (mode === 'history') {
      const { getHistoryRecords } = await import('@/utils/historyStorage')
      const records = getHistoryRecords()
      const record = records.find(
        r => r.archiveId === archiveId && r.mode === recordMode && (recordMode === 'native' || r.date === historyDate)
      )
      if (record) {
        // 兼容旧历史记录：llmPlan 未保存时，从本地穿搭缓存补齐，保证新版布局渲染
        let llmPlan = record.llmPlan
        if (!llmPlan) {
          const cached = recordMode === 'native'
            ? getNativeResult(archiveId)
            : getDailyResult(archiveId, historyDate || getToday())
          llmPlan = cached?.llmPlan
        }
        setResult({ ...record, llmPlan })
        setFlatImageUrl(record.imageUrl || '')
        setTryOnUrl(record.tryOnUrl || '')
        setPageMode(recordMode)
        pageModeRef.current = recordMode
        return
      }
      // 未找到历史记录时降级为实时请求
      Taro.showToast({ title: '历史记录已失效', icon: 'none' })
      await fetchAndCacheResult(recordMode, archiveId)
      return
    }

    if (mode === 'native') {
      const nativeResult = getNativeResult(archiveId)
      if (nativeResult?.baziResult) {
        setResult({ ...nativeResult.baziResult, llmPlan: nativeResult.llmPlan })
        setFlatImageUrl(nativeResult.imageUrl || '')
        setTryOnUrl(nativeResult.tryOnUrl || '')
        nativeResultRef.current = nativeResult
        return
      }
    } else {
      const today = getToday()
      const dailyResult = getDailyResult(archiveId, today)
      if (dailyResult?.baziResult) {
        setResult({ ...dailyResult.baziResult, llmPlan: dailyResult.llmPlan })
        setFlatImageUrl(dailyResult.imageUrl || '')
        setTryOnUrl(dailyResult.tryOnUrl || '')
        dailyResultRef.current = dailyResult
        syncHistoryRecord(dailyResult)
        return
      }
    }
    // 本地无缓存时自动请求
    await fetchAndCacheResult(mode as 'daily' | 'native', archiveId)
  }

  // 保存/更新分享数据到服务器
  const saveShareData = async (currentTryOnUrl?: string) => {
    if (!result || isSavingRef.current || fromShareRef.current) return

    isSavingRef.current = true
    try {
      // 精简分享数据，只保留展示必需的字段，避免存储冗余数据
      const shareResult = {
        nickname: result.nickname || '',
        gender: result.gender || 'male',
        imageUrl: result.imageUrl,
        outfit: {
          style: result.outfit?.style || '简约风',
          colors: result.outfit?.colors || [],
          description: result.outfit?.description || '',
        },
        favorableElement: result.favorableElement,
        fourPillars: result.fourPillars,
        dayMaster: result.dayMaster,
        dayMasterElement: result.dayMasterElement,
        favorableAnalysis: {
          coreYongShen: result.favorableAnalysis.coreYongShen,
          assistantXiShen: result.favorableAnalysis.assistantXiShen,
          taboo: result.favorableAnalysis.taboo,
          strength: result.favorableAnalysis.strength,
          logicSummary: result.favorableAnalysis.logicSummary,
        },
        ganZhiDate: result.ganZhiDate,
        dailyYongShen: result.dailyYongShen,
        dailyXiShen: result.dailyXiShen,
        // 穿搭数据：不属于玄学内容，分享给好友后仍需展示
        llmPlan: result.llmPlan,
        age: result.age,
      }

      const shareData = {
        nickname: result.nickname || '',
        gender: result.gender || 'male',
        result: shareResult,
        tryOnUrl: currentTryOnUrl || tryOnUrl || undefined,
      }

      if (shareId) {
        // 已有 shareId，更新现有分享数据
        await Network.request({
          url: `/api/share/${shareId}`,
          method: 'PUT',
          data: shareData,
        })
        console.log('Share data updated:', shareId)
      } else {
        // 首次保存，创建分享数据
        const saveRes = await Network.request({
          url: '/api/share/save',
          method: 'POST',
          data: shareData,
        })
        console.log('Share save response:', saveRes.data)
        if (saveRes.data?.shareId) {
          setShareId(saveRes.data.shareId)
        }
      }
    } catch (err) {
      console.error('Failed to save/update share data:', err)
    } finally {
      isSavingRef.current = false
      setShareReady(true)
    }
  }

  // 当 result 加载完成后，自动保存分享数据
  useEffect(() => {
    if (result && !shareId) {
      saveShareData()
    }
  }, [result])

  // 当上身图生成完成后，更新分享数据
  useEffect(() => {
    if (result && tryOnUrl) {
      saveShareData(tryOnUrl)
    }
  }, [tryOnUrl])

  // 视频解锁相关逻辑（暂时注释）
  // const handleUnlock = () => {
  //   Taro.showModal({
  //     title: '解锁今日穿搭',
  //     content: '观看短视频即可解锁你的专属穿搭推荐',
  //     confirmText: '观看解锁',
  //     confirmColor: '#6366f1',
  //     success: (res) => {
  //       if (res.confirm) {
  //         Taro.setStorageSync('outfitUnlocked', true)
  //         setUnlocked(true)
  //       }
  //     },
  //   })
  // }

  // 分享解锁相关逻辑（暂时注释）
  // const [sharedToday, setSharedToday] = useState(false)

  // useEffect(() => {
  //   // 检查今日是否已分享过
  //   const lastShareDate = Taro.getStorageSync('lastShareDate')
  //   const today = new Date().toDateString()
  //   if (lastShareDate === today) {
  //     setSharedToday(true)
  //   }
  // }, [])

  // const handleShareClick = () => {
  //   if (sharedToday) {
  //     Taro.showToast({
  //       title: '今日已分享过，明日再来～',
  //       icon: 'none',
  //       duration: 2000,
  //     })
  //     return false
  //   }
  //   Taro.setStorageSync('justShared', true)
  //   return true
  // }

  // Tab 切换处理
  const handleTabChange = (tab: 'flat' | 'tryon') => {
    setActiveTab(tab)
  }

  // 再测一次确认：进入 loading 页重新请求数据，覆盖之前生成的记录
  const handleRetestConfirm = () => {
    const archiveId = currentArchiveIdRef.current
    if (!archiveId) {
      Taro.showToast({ title: '未找到档案信息', icon: 'none' })
      return
    }
    const mode = pageModeRef.current === 'native' ? 'native' : 'daily'
    // action=redesign：仅重新生成穿搭方案，喜用神/幸运指数沿用不变；
    // from=result：生成完成后返回结果页而不是首页
    Taro.navigateTo({
      url: `/pages/loading/index?mode=${mode}&archiveId=${archiveId}&from=result&action=redesign`
    })
  }

  // 小程序分享配置
  Taro.useShareAppMessage(() => {
    const title = pageMode === 'native'
      ? `${result?.nickname || '我'}的本命穿搭，快来看看！`
      : `${result?.nickname || '我'}的专属穿搭推荐，快来看看！`
    return {
      title,
      path: shareId ? `/pages/result/index?shareId=${shareId}&mode=${pageMode}` : `/pages/result/index?mode=${pageMode}`,
      // 不设置 imageUrl，微信会自动截取当前页面作为分享图
    }
  })

  Taro.useShareTimeline(() => {
    const title = pageMode === 'native'
      ? `${result?.nickname || '我'}的本命穿搭，快来看看！`
      : `${result?.nickname || '我'}的专属穿搭推荐，快来看看！`
    return {
      title,
      query: shareId ? `shareId=${shareId}&mode=${pageMode}` : `mode=${pageMode}`,
      // 不设置 imageUrl，微信会自动截取当前页面作为分享图
    }
  })

  // Fetch feature flags
  useEffect(() => {
    Network.request({ url: '/api/config/features' })
      .then((res) => {
        console.log('Features API response:', res.data)
        if (res.data?.data?.features) {
          const features = res.data.data.features
          setShowBaZiContent(features.showResultDetails !== false)
          setAdFailOpen(features.adFailOpen !== false)
          if (Array.isArray(features.adAutoSkipErrCodes)) {
            setAdAutoSkipErrCodes(features.adAutoSkipErrCodes)
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch features:', err)
      })
  }, [])

  if (!result || shareLoading) {
    return (
      <View className="min-h-full bg-white p-5">
        <View className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </View>
        <Skeleton className="w-full h-96 rounded-2xl mb-6" />
        <Skeleton className="h-6 w-40 mb-3" />
        <View className="flex gap-2 mb-6">
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </View>
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-24 w-full rounded-xl mb-6" />
        <View className="flex gap-3 mt-4">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </View>
      </View>
    )
  }

  if (!result || pageLoading) {
    return (
      <View className="min-h-full bg-white flex items-center justify-center px-6">
        <View className="flex flex-col items-center">
          <WuxingLoader scale={0.8} />
          <Text className="block mt-2 text-gray-500">正在准备穿搭方案...</Text>
        </View>
      </View>
    )
  }

  const elementColor = ELEMENT_COLORS[result.favorableElement] || '#6366f1'

  return (
    <View className="min-h-full bg-white">
      <View className="px-6 pb-24">
      {/* Header */}
      <View className="flex flex-col items-center mb-5">
        <Text className="block text-xl font-bold text-gray-900 mb-2">
          {result.nickname} {pageMode === 'native' ? '本命穿搭推荐' : '今日专属穿搭推荐'}
        </Text>
        <Text className="block text-sm text-gray-400">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </Text>
        {result.ganZhiDate?.month && result.ganZhiDate?.day && (
          <Text className="block text-sm text-gray-500 mt-1">
            {result.ganZhiDate.month}月 {result.ganZhiDate.day}日
          </Text>
        )}
      </View>

      {/* Image Area with Tab Switching */}
      <View className="mb-5">
        {/* Tab Header */}
        <View className="flex gap-2 mb-3">
          <View
            className={`flex-1 py-2 rounded-lg flex items-center justify-center border ${activeTab === 'flat' ? 'bg-slate-100 border-slate-200' : 'bg-gray-50 border-gray-100'}`}
            onClick={() => handleTabChange('flat')}
          >
            <Text className={`text-sm ${activeTab === 'flat' ? 'font-medium text-slate-900' : 'text-gray-500'}`}>
              平铺图
            </Text>
          </View>
          <View
            className={`flex-1 py-2 rounded-lg flex items-center justify-center border ${activeTab === 'tryon' ? 'bg-slate-100 border-slate-200' : 'bg-gray-50 border-gray-100'}`}
            onClick={() => handleTabChange('tryon')}
          >
            <Text className={`text-sm ${activeTab === 'tryon' ? 'font-medium text-slate-900' : 'text-gray-500'}`}>
              上身图
            </Text>
          </View>
        </View>

        {/* Image Display */}
        <View className="relative w-full rounded-2xl overflow-hidden bg-gray-100" style={{ paddingBottom: '133.33%' }}>
          <View className="absolute inset-0">
            {activeTab === 'flat' ? (
              flatImageLoading ? (
                <View className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                  <WuxingLoader scale={0.7} />
                  <Text className="block mt-2 text-base font-medium text-gray-900">
                    正在生成平铺图...
                  </Text>
                  <Text className="block mt-2 text-sm text-gray-400">
                    需要等待30s左右，请耐心等待
                  </Text>
                </View>
              ) : flatImageUrl || result.imageUrl ? (
                <Image
                  src={flatImageUrl || result.imageUrl}
                  className="w-full h-full"
                  mode="aspectFill"
                  lazyLoad
                  onError={() => handleImageLoadError(flatImageUrl || result.imageUrl, (url) => setFlatImageUrl(url))}
                />
              ) : (
                <View className="w-full h-full flex flex-col items-center justify-center px-6">
                  {assets?.fallback && (
                    <Image
                      src={assets.fallback}
                      className="absolute inset-0 w-full h-full"
                      mode="aspectFill"
                      lazyLoad
                      onError={() => console.warn('Fallback image load failed')}
                    />
                  )}
                  <View className="absolute inset-0 bg-white" style={{ opacity: 0.6 }} />
                  <View className="relative z-10 flex flex-col items-center justify-center">
                    <View className="w-16 h-16 rounded-full bg-white backdrop-blur flex items-center justify-center mb-4 shadow-sm" style={{ opacity: 0.9 }}>
                      <Lock size={28} color="#6b7280" />
                    </View>
                    <Text className="block text-gray-500 text-sm text-center mb-6 px-4">
                      观看激励视频，免费解锁专属穿搭平铺图（生成约需 30 秒）
                    </Text>
                    <Button
                      variant="outline"
                      className="rounded-full px-8 py-2 h-auto border-gray-300 text-gray-700 bg-white"
                      onClick={handleUnlockFlatImage}
                    >
                      <View className="flex flex-row items-center">
                        <Play size={16} color="#374151" className="mr-1" />
                        <Text className="block text-sm font-medium">看视频免费解锁</Text>
                      </View>
                    </Button>
                  </View>
                </View>
              )
            ) : tryOnUrl ? (
              <Image
                src={tryOnUrl}
                className="w-full h-full"
                mode="aspectFill"
                lazyLoad
                onError={() => handleImageLoadError(tryOnUrl, (url) => setTryOnUrl(url))}
              />
            ) : tryOnLoading ? (
              <View className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                <WuxingLoader scale={0.7} />
                <Text className="block mt-2 text-base font-medium text-gray-900">
                  正在生成上身图...
                </Text>
                <Text className="block mt-2 text-sm text-gray-400">
                  需要等待30s左右，请耐心等待
                </Text>
              </View>
            ) : (
              <View className="w-full h-full flex flex-col items-center justify-center px-6">
                {assets?.fallback && (
                  <Image
                    src={assets.fallback}
                    className="absolute inset-0 w-full h-full"
                    mode="aspectFill"
                    lazyLoad
                    onError={() => console.warn('Fallback image load failed')}
                  />
                )}
                <View className="absolute inset-0 bg-white" style={{ opacity: 0.6 }} />
                <View className="relative z-10 flex flex-col items-center justify-center">
                  <View className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm" style={{ opacity: 0.9 }}>
                    <Lock size={28} color="#6b7280" />
                  </View>
                  <Text className="block text-gray-500 text-sm text-center mb-6 px-4">
                    观看激励视频，免费解锁模特上身效果图（生成约需 30 秒）
                  </Text>
                  <Button
                    variant="outline"
                    className="rounded-full px-8 py-2 h-auto border-gray-300 text-gray-700 bg-white"
                    style={{ opacity: 0.8 }}
                    onClick={handleUnlockTryOn}
                  >
                    <View className="flex flex-row items-center">
                      <Play size={16} color="#374151" className="mr-1" />
                      <Text className="block text-sm font-medium">看视频免费解锁</Text>
                    </View>
                  </Button>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 风格 / 主色 / 辅色标签（风格取档案中的风格偏好） */}
        {(archiveStyle || result.llmPlan?.luckyColors) && (
          <View className="flex flex-row flex-wrap gap-2 mt-3">
            {archiveStyle && (
              <View className="px-3 py-1 rounded-full bg-slate-100 flex flex-row items-center">
                <Text className="text-xs text-gray-700">{archiveStyle}</Text>
              </View>
            )}
            {result.llmPlan?.luckyColors?.primary && (
              <View className="px-3 py-1 rounded-full bg-slate-100 flex flex-row items-center gap-1">
                <View
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: result.llmPlan.luckyColors.primaryHex || '#9ca3af' }}
                />
                <Text className="text-xs text-gray-700">主色</Text>
              </View>
            )}
            {result.llmPlan?.luckyColors?.secondary && (
              <View className="px-3 py-1 rounded-full bg-slate-100 flex flex-row items-center gap-1">
                <View
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: result.llmPlan.luckyColors.secondaryHex || '#9ca3af' }}
                />
                <Text className="text-xs text-gray-700">辅色</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Unlocked Content */}
      <View className="flex flex-col gap-4">

          {/* BaZi Summary - Controlled by backend */}
          {showBaZiContent && result.fourPillars && result.fourPillars.length > 0 && (
          <>
            <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center justify-between mb-3">
                <Text className="block text-sm font-medium text-black">
                  八字概览
                </Text>
                {result.dayMaster && (
                  <Text className="block text-xs text-gray-400">
                    日主：<Text style={{ color: ELEMENT_COLORS[result.dayMasterElement] || '#6366f1', fontWeight: 'bold' }}>{result.dayMaster}</Text>（{result.dayMasterElement}）
                  </Text>
                )}
              </View>
              <View className="flex justify-between gap-2">
                {result.fourPillars.map((pillar) => (
                  <View
                    key={pillar.name}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <Text className="block text-xs text-gray-400">
                      {pillar.name}
                    </Text>
                    {pillar.tenGod ? (
                      <Text className="block text-xs text-gray-400">
                        {pillar.tenGod}
                      </Text>
                    ) : null}
                    <Text
                      className="block text-lg font-bold"
                      style={{ color: ELEMENT_COLORS[pillar.stemElement] }}
                    >
                      {pillar.stem}
                    </Text>
                    <Text
                      className="block text-lg font-bold"
                      style={{ color: ELEMENT_COLORS[pillar.branchElement] }}
                    >
                      {pillar.branch}
                    </Text>
                    {pillar.naYin ? (
                      <Text className="block text-xs text-gray-300 mt-1">
                        {pillar.naYin}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Favorable Element Analysis */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <Text className="block text-sm font-medium text-gray-900 mb-3">
                个人分析
              </Text>
              <View className="flex items-center gap-3 mb-3">
                <View
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${elementColor}15`,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: elementColor,
                  }}
                >
                  <Text
                    className="block text-xl font-bold"
                    style={{ color: elementColor }}
                  >
                    {result.favorableElement}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="block text-gray-700 text-sm">
                    核心用神「{result.favorableAnalysis.coreYongShen}」· 喜神「{result.favorableAnalysis.assistantXiShen}」
                  </Text>
                  <Text className="block text-gray-400 text-xs mt-1">
                    忌神「{result.favorableAnalysis.taboo}」· {result.favorableAnalysis.strength}
                  </Text>
                </View>
              </View>
              <View className="bg-gray-50 rounded-lg p-3">
                <Text className="block text-xs text-gray-500 leading-relaxed">
                  {result.favorableAnalysis.logicSummary}
                </Text>
              </View>
              {/* 每日用神 - 仅今日穿搭展示 */}
              {pageMode === 'daily' && result.dailyYongShen && (
                <View className="mt-3 bg-gray-50 rounded-lg p-3">
                  <View className="flex items-center gap-2 mb-2">
                    <View
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: `${ELEMENT_COLORS[result.dailyYongShen] || '#a855f7'}15`,
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: ELEMENT_COLORS[result.dailyYongShen] || '#a855f7',
                      }}
                    >
                      <Text
                        className="block text-sm font-bold"
                        style={{ color: ELEMENT_COLORS[result.dailyYongShen] || '#a855f7' }}
                      >
                        {result.dailyYongShen}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="block text-gray-700 text-sm">
                        今日用神「{result.dailyYongShen}」· 喜神「{result.dailyXiShen}」
                      </Text>
                      <Text
                        className="block text-xs mt-1"
                        style={{ color: themeColor, opacity: 0.7 }}
                      >
                        {result.dailyYongShen === result.favorableElement
                          ? '今日用神回归，穿搭主色调保持不变'
                          : '今日五行能量变化，穿搭主色调已相应调整'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </CardContent>
          </Card>
          </>
          )}

          {/* Outfit Recommendation - Always visible */}
          <Card id="outfit-section" className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <Text className="block text-base font-semibold text-gray-900 mb-3">
                {pageMode === 'native' ? '本命穿搭' : '今日穿搭'}
              </Text>
              {result.llmPlan ? (
                <View className="space-y-4">
                  {/* 风格主题 */}
                  <Text className="block text-base font-semibold text-gray-900 leading-relaxed">
                    {result.llmPlan.styleTheme}
                  </Text>

                  {/* 幸运色 */}
                  <View className="space-y-2">
                    <Text className="block text-sm font-semibold text-gray-700">幸运色</Text>
                    <View className="grid grid-cols-2 gap-3">
                      <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                        <View
                          className="w-5 h-5 rounded-full flex-shrink-0 border"
                          style={{ backgroundColor: result.llmPlan.luckyColors.primaryHex || getColorHex(result.llmPlan.luckyColors.primary), borderColor: 'rgba(0,0,0,0.05)' }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="block text-xs text-gray-500">主色</Text>
                          <Text className="block text-sm font-medium text-gray-900 truncate">{result.llmPlan.luckyColors.primary}</Text>
                        </View>
                      </View>
                      <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                        <View
                          className="w-5 h-5 rounded-full flex-shrink-0 border"
                          style={{ backgroundColor: result.llmPlan.luckyColors.secondaryHex || getColorHex(result.llmPlan.luckyColors.secondary), borderColor: 'rgba(0,0,0,0.05)' }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="block text-xs text-gray-500">辅色</Text>
                          <Text className="block text-sm font-medium text-gray-900 truncate">{result.llmPlan.luckyColors.secondary}</Text>
                        </View>
                      </View>
                      <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                        <View
                          className="w-5 h-5 rounded-full flex-shrink-0 border"
                          style={{ backgroundColor: result.llmPlan.luckyColors.accentHex || getColorHex(result.llmPlan.luckyColors.accent), borderColor: 'rgba(0,0,0,0.05)' }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="block text-xs text-gray-500">点缀</Text>
                          <Text className="block text-sm font-medium text-gray-900 truncate">{result.llmPlan.luckyColors.accent}</Text>
                        </View>
                      </View>
                      {result.llmPlan.luckyColors.avoid?.length > 0 && (
                        <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                          <View className="w-5 h-5 rounded-full flex-shrink-0 bg-gray-200 border" style={{ borderColor: 'rgba(0,0,0,0.05)' }} />
                          <View className="flex-1 min-w-0">
                            <Text className="block text-xs text-gray-500">避雷</Text>
                            <Text className="block text-sm font-medium text-gray-900 truncate">
                              {result.llmPlan.luckyColors.avoid.join('、')}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 单品清单 */}
                  <View className="space-y-2">
                    <Text className="block text-sm font-semibold text-gray-700">单品清单</Text>
                    <View className="grid grid-cols-2 gap-3">
                      {result.llmPlan.outfitPlan.top && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <Shirt size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">上衣</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.top}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.bottom && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <Square size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">下装</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.bottom}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.outerwear && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <Shirt size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">外套</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.outerwear}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.shoes && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <Footprints size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">鞋履</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.shoes}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.bag && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <ShoppingBag size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">包袋</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.bag}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.accessories.length > 0 && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <View className="flex items-center gap-1 mb-1">
                            <Gem size={12} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">配饰</Text>
                          </View>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.accessories.join('、')}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 适用场景 */}
                  <View className="space-y-2">
                    <Text className="block text-sm font-semibold text-gray-700">适用场景</Text>
                    <View className="flex flex-wrap gap-2">
                      {(result.llmPlan.occasions?.length ? result.llmPlan.occasions : ['日常穿搭']).map((scene, index) => (
                        <View
                          key={index}
                          className="px-3 py-1 rounded-full"
                          style={{
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: `${themeColor}66`,
                            backgroundColor: `${themeColor}1a`
                          }}
                        >
                          <Text className="block text-sm font-medium" style={{ color: themeColor }}>{scene.split('：')[0]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* 面料建议 */}
                  <View className="space-y-2">
                    <Text className="block text-sm font-semibold text-gray-700">面料建议</Text>
                    <Text className="block text-sm text-gray-700 leading-relaxed">{result.llmPlan.fabricSuggestion || '舒适透气面料'}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text className="block text-gray-600 text-sm mb-3">
                    {result.outfit?.description}
                  </Text>
                  <View className="flex flex-wrap gap-2">
                    {result.outfit?.colors?.map((color) => (
                      <View
                        key={color}
                        className="px-3 py-1 rounded-full bg-gray-50 border border-gray-100"
                      >
                        <Text className="text-xs text-gray-600">{color}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </CardContent>
          </Card>
        </View>
      </View>

      {/* Fixed Bottom Buttons - 从分享链接进入时隐藏 */}
      {!urlShareId && (
        <View
          className="fixed left-0 right-0 bg-white border-t border-gray-100 px-6 py-3"
          style={{ bottom: 0, zIndex: 100, display: 'flex', gap: '12px' }}
        >
          {shareReady ? (
            <Button
              className="flex-1 bg-white border border-slate-200 py-3 rounded-xl"
              openType="share"
            >
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Share2 size={18} color="#1f2937" />
                <Text className="text-gray-700">分享好友</Text>
              </View>
            </Button>
          ) : (
            <Button
              className="flex-1 bg-white border border-slate-200 py-3 rounded-xl opacity-60"
              disabled
            >
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Share2 size={18} color="#1f2937" />
                <Text className="text-gray-500">准备分享中...</Text>
              </View>
            </Button>
          )}
          <Button
            className="flex-1 bg-white border border-slate-200 py-3 rounded-xl"
            onClick={() => setShowRetestConfirm(true)}
          >
            <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <RefreshCw size={18} color="#1f2937" />
              <Text className="text-gray-700">再测一次</Text>
            </View>
          </Button>
        </View>
      )}

      {/* 再测一次二次确认弹窗 */}
      <AlertDialog open={showRetestConfirm} onOpenChange={setShowRetestConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重新生成？</AlertDialogTitle>
            <AlertDialogDescription>
              重新生成后，穿搭单品与图片将会变更，之前生成的记录将被覆盖。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-slate-900 text-white"
              onClick={handleRetestConfirm}
            >
              确认修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}

export default ResultPage
