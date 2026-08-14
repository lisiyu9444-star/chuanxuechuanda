import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Share2, RefreshCw, Lock, Loader } from 'lucide-react-taro'
import { Network } from '@/network'
import { useLoadingTask } from '@/hooks/useLoadingTask'
import './index.css'

const COLOR_MAP: Record<string, string> = {
  玄青色: '#1a237e',
  藏青色: '#1e3a5f',
  深蓝色: '#1e3a8a',
  蓝色: '#2563eb',
  天蓝色: '#87ceeb',
  湖蓝色: '#008b8b',
  雾霾蓝: '#9db2c5',
  浅蓝色: '#add8e6',
  黑色: '#1f2937',
  深灰: '#4b5563',
  灰色: '#6b7280',
  浅灰: '#d1d5db',
  银色: '#c0c0c0',
  银白: '#e8e8e8',
  白色: '#f8f9fa',
  象牙白: '#fffff0',
  米白: '#faf9f6',
  米白色: '#faf9f6',
  米色: '#f5f5dc',
  香槟色: '#f7e7ce',
  香槟金: '#f7e7ce',
  金色: '#d4af37',
  金黄色: '#ffd700',
  红色: '#dc2626',
  深红: '#8b0000',
  酒红色: '#722f37',
  玫红色: '#c71585',
  珊瑚红: '#f08080',
  橙红色: '#ff4500',
  粉色: '#f472b6',
  玫粉: '#ff69b4',
  绿色: '#16a34a',
  深绿: '#14532d',
  墨绿色: '#1b4d3e',
  橄榄绿: '#6b8e23',
  薄荷绿: '#98ff98',
  翠绿色: '#00a86b',
  青色: '#008080',
  黄色: '#facc15',
  土黄: '#d2b48c',
  土黄色: '#d2b48c',
  卡其色: '#c3b091',
  驼色: '#c19a6b',
  棕色: '#8b5a2b',
  咖啡色: '#6f4e37',
  大地色: '#8b7355',
  褐色: '#8b4513',
  紫色: '#9333ea',
  深紫: '#581c87',
  淡紫: '#c4b5fd',
  橙色: '#f97316',
  裸色: '#e8c4a2'
}

function getColorHex(name: string): string {
  const normalized = name.replace(/[\s·]/g, '')
  const direct = COLOR_MAP[normalized]
  if (direct) return direct
  for (const key of Object.keys(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return COLOR_MAP[key]
    }
  }
  return '#9ca3af'
}

interface BaZiResult {
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: Array<{
    name: string
    stem: string
    branch: string
    ganZhi: string
    stemElement: string
    branchElement: string
    naYin: string
    tenGod: string
  }>
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  favorableAnalysis: {
    dayMaster: string
    strength: string
    coreYongShen: string
    assistantXiShen: string
    taboo: string
    logicSummary: string
  }
  outfit: {
    style: string
    colors: string[]
    description: string
    prompt: string
    backgroundColor?: string
  }
  imageUrl: string
  ganZhiDate?: {
    month: string
    day: string
  }
  dailyYongShen?: string
  dailyXiShen?: string
  llmPlan?: {
    luckyColors: {
      primary: string
      secondary: string
      accent: string
      avoid: string[]
    }
    styleTheme: string
    outfitPlan: {
      top: string
      bottom: string
      outerwear: string | null
      shoes: string
      bag: string
      accessories: string[]
    }
    fabricSuggestion: string
    occasions: string[]
  }
}

const ELEMENT_COLORS: Record<string, string> = {
  '木': '#22c55e',
  '火': '#ef4444',
  '土': '#6b4c7a',
  '金': '#fbbf24',
  '水': '#3b82f6',
}

const ResultPage = () => {
  const [result, setResult] = useState<BaZiResult | null>(null)
  // 图片 Tab 切换：'flat' = 平铺图, 'tryon' = 上身图
  const [activeTab, setActiveTab] = useState<'flat' | 'tryon'>('flat')
  // 上身图 URL（生成后缓存）
  const [tryOnUrl, setTryOnUrl] = useState<string>('')
  // 功能开关：分享功能是否开启
  // 功能开关：是否显示八字相关内容（八字概览、喜用神分析、穿搭推荐）
  const [showBaZiContent, setShowBaZiContent] = useState(true)
  // 分享 ID（用于朋友圈分享）
  const [shareId, setShareId] = useState('')
  // 防止分享保存重复触发
  const isSavingRef = useRef(false)

  // 更新历史记录中的上身图 URL
  const updateHistoryTryOnUrl = (imageUrl: string, newTryOnUrl: string) => {
    try {
      const records: any[] = Taro.getStorageSync('outfit_history') || []
      const updated = records.map((item) =>
        item.imageUrl === imageUrl ? { ...item, tryOnUrl: newTryOnUrl } : item
      )
      Taro.setStorageSync('outfit_history', updated)
    } catch (e) {
      console.error('Update history tryOnUrl failed:', e)
    }
  }

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
      if (data?.tryOnUrl) {
        setTryOnUrl(data.tryOnUrl)
        if (result?.imageUrl) {
          updateHistoryTryOnUrl(result.imageUrl, data.tryOnUrl)
        }
      } else {
        Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    },
    onError: (err) => {
      console.error('Try-on failed:', err)
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    },
  })

  // 获取今日用神主题色
  const themeColor = result?.dailyYongShen
    ? ELEMENT_COLORS[result.dailyYongShen] || '#9333ea'
    : '#9333ea'

  useDidShow(() => {
    // 检查是否从分享链接打开
    const router = Taro.getCurrentInstance().router
    const urlShareId = router?.params?.shareId

    if (urlShareId) {
      // 从分享链接打开，加载分享者的数据
      console.log('Loading shared result with shareId:', urlShareId)
      Network.request({
        url: `/api/share/${urlShareId}`,
        method: 'GET',
      }).then((res: any) => {
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
          setResult(res.data.result)
          // 如果分享数据中包含上身图，直接设置
          if (res.data.tryOnUrl) {
            setTryOnUrl(res.data.tryOnUrl)
          }
        } else {
          // 分享数据不存在，加载本地数据
          const data = Taro.getStorageSync('baziResult')
          if (data) setResult(data)
        }
      }).catch((err) => {
        console.error('Failed to load shared result:', err)
        // 加载本地数据
        const data = Taro.getStorageSync('baziResult')
        if (data) setResult(data)
      })
    } else {
      // 正常打开，加载本地数据
      const data = Taro.getStorageSync('baziResult')
      if (data) {
        setResult(data)
        if (data.tryOnUrl) {
          setTryOnUrl(data.tryOnUrl)
        }
      }
    }
  })

  // 保存/更新分享数据到服务器
  const saveShareData = async (currentTryOnUrl?: string) => {
    if (!result || isSavingRef.current) return

    isSavingRef.current = true
    try {
      // 精简分享数据，只保留展示必需的字段，避免存储冗余数据
      const shareResult = {
        nickname: result.nickname || '',
        gender: result.gender || 'male',
        imageUrl: result.imageUrl,
        outfit: {
          style: result.outfit.style,
          colors: result.outfit.colors,
          description: result.outfit.description,
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

  // 小程序分享配置
  Taro.useShareAppMessage(() => {
    return {
      title: `${result?.nickname || '我'}的专属穿搭推荐，快来看看！`,
      path: shareId ? `/pages/result/index?shareId=${shareId}` : '/pages/result/index',
      // 不设置 imageUrl，微信会自动截取当前页面作为分享图
    }
  })

  Taro.useShareTimeline(() => {
    return {
      title: `${result?.nickname || '我'}的专属穿搭推荐，快来看看！`,
      query: shareId ? `shareId=${shareId}` : '',
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
        }
      })
      .catch((err) => {
        console.error('Failed to fetch features:', err)
      })
  }, [])

  if (!result) {
    return (
      <View className="min-h-full bg-white flex items-center justify-center">
        <Text className="text-gray-400">加载中...</Text>
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
          {result.nickname} 今日专属穿搭推荐
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
            className={`flex-1 py-2 rounded-lg flex items-center justify-center ${activeTab === 'flat' ? 'border' : 'bg-gray-50 border border-gray-100'}`}
            style={activeTab === 'flat' ? { backgroundColor: `${themeColor}08`, borderColor: `${themeColor}33` } : {}}
            onClick={() => handleTabChange('flat')}
          >
            <Text className={`text-sm ${activeTab === 'flat' ? 'font-medium' : 'text-gray-500'}`} style={activeTab === 'flat' ? { color: themeColor } : {}}>
              平铺图
            </Text>
          </View>
          <View
            className={`flex-1 py-2 rounded-lg flex items-center justify-center ${activeTab === 'tryon' ? 'border' : 'bg-gray-50 border border-gray-100'}`}
            style={activeTab === 'tryon' ? { backgroundColor: `${themeColor}08`, borderColor: `${themeColor}33` } : {}}
            onClick={() => handleTabChange('tryon')}
          >
            <Text className={`text-sm ${activeTab === 'tryon' ? 'font-medium' : 'text-gray-500'}`} style={activeTab === 'tryon' ? { color: themeColor } : {}}>
              上身图
            </Text>
          </View>
        </View>

        {/* Image Display */}
        <View className="relative w-full rounded-2xl overflow-hidden bg-gray-100">
          <View className="w-full" style={{ height: '600px' }}>
            {activeTab === 'flat' ? (
              <Image
                src={result.imageUrl}
                className="w-full h-full"
                mode="aspectFill"
                lazyLoad
              />
            ) : tryOnUrl ? (
              <Image
                src={tryOnUrl}
                className="w-full h-full"
                mode="aspectFill"
                lazyLoad
              />
            ) : tryOnLoading ? (
              <View className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                <Loader size={40} color={themeColor} className="animate-spin" />
                <Text className="block mt-4 text-base font-medium" style={{ color: themeColor }}>
                  正在生成上身图...
                </Text>
                <Text className="block mt-2 text-sm text-gray-400">
                  需要等待30s左右，请耐心等待
                </Text>
              </View>
            ) : (
              <View className="w-full h-full flex flex-col items-center justify-center px-6">
                <View className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Lock size={28} color="#6b7280" />
                </View>
                <Text className="block text-gray-700 text-base font-semibold mb-2">
                  上身试穿图未生成
                </Text>
                <Text className="block text-gray-400 text-sm text-center mb-6 px-4">
                  基于平铺图生成模特上身效果，约需等待30秒
                </Text>
                <Button
                  variant="outline"
                  className="rounded-full px-8 py-2 h-auto border-gray-300 text-gray-700"
                  onClick={() => generateTryOn({
                    imageUrl: result.imageUrl,
                    outfit: result.outfit,
                    gender: result.gender,
                  })}
                >
                  <Text className="block text-sm font-medium">点击生成上身试穿图</Text>
                </Button>
              </View>
            )}
          </View>
        </View>
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
                喜用神分析
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
              {/* 每日用神 */}
              {result.dailyYongShen && (
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

          {/* Outfit Recommendation */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <Text className="block text-base font-semibold text-gray-900 mb-3">
                今日穿搭
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
                          style={{ backgroundColor: getColorHex(result.llmPlan.luckyColors.primary), borderColor: 'rgba(0,0,0,0.05)' }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="block text-xs text-gray-500">主色</Text>
                          <Text className="block text-sm font-medium text-gray-900 truncate">{result.llmPlan.luckyColors.primary}</Text>
                        </View>
                      </View>
                      <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                        <View
                          className="w-5 h-5 rounded-full flex-shrink-0 border"
                          style={{ backgroundColor: getColorHex(result.llmPlan.luckyColors.secondary), borderColor: 'rgba(0,0,0,0.05)' }}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="block text-xs text-gray-500">辅色</Text>
                          <Text className="block text-sm font-medium text-gray-900 truncate">{result.llmPlan.luckyColors.secondary}</Text>
                        </View>
                      </View>
                      <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                        <View
                          className="w-5 h-5 rounded-full flex-shrink-0 border"
                          style={{ backgroundColor: getColorHex(result.llmPlan.luckyColors.accent), borderColor: 'rgba(0,0,0,0.05)' }}
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
                          <Text className="block text-xs text-gray-500 mb-1">上衣</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.top}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.bottom && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <Text className="block text-xs text-gray-500 mb-1">下装</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.bottom}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.outerwear && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <Text className="block text-xs text-gray-500 mb-1">外套</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.outerwear}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.shoes && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <Text className="block text-xs text-gray-500 mb-1">鞋履</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.shoes}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.bag && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <Text className="block text-xs text-gray-500 mb-1">包袋</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.bag}</Text>
                        </View>
                      )}
                      {result.llmPlan.outfitPlan.accessories.length > 0 && (
                        <View className="bg-gray-50 p-3 rounded-xl">
                          <Text className="block text-xs text-gray-500 mb-1">配饰</Text>
                          <Text className="block text-sm font-medium text-gray-900 leading-snug">{result.llmPlan.outfitPlan.accessories.join('、')}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* 适用场景 */}
                  <View className="space-y-2">
                    <Text className="block text-sm font-semibold text-gray-700">适用场景</Text>
                    <Text className="block text-sm text-gray-700 leading-relaxed">{result.llmPlan.occasions?.join('、') || '日常穿搭'}</Text>
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
                    {result.outfit.description}
                  </Text>
                  <View className="flex flex-wrap gap-2">
                    {result.outfit.colors.map((color) => (
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
          </>
          )}
        </View>
      </View>

      {/* Fixed Bottom Buttons */}
      <View
        className="fixed left-0 right-0 bg-white border-t border-gray-100 px-6 py-3"
        style={{ bottom: 0, zIndex: 100, display: 'flex', gap: '12px' }}
      >
        <Button
          className="flex-1 bg-white border py-3 rounded-xl"
          style={{ borderColor: `${themeColor}33` }}
          openType="share"
        >
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Share2 size={18} color={themeColor} />
            <Text className="text-gray-700">分享好友</Text>
          </View>
        </Button>
        <Button
          className="flex-1 bg-white border py-3 rounded-xl"
          style={{ borderColor: `${themeColor}33` }}
          onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
        >
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <RefreshCw size={18} color={themeColor} />
            <Text className="text-gray-700">再测一次</Text>
          </View>
        </Button>
      </View>
    </View>
  )
}

export default ResultPage
