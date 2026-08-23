import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { ChevronRight, CloudOff, Plus, RefreshCw, Shirt, Sparkles, Users, WandSparkles } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { OutfitGuideContent } from '@/components/outfit-guide-content'
import {
  type Archive,
  type DailyResult,
  type LuckyScore,
  type StylistResult,
  getArchives,
  getCurrentArchiveId,
  getDailyResult,
  clearDailyResultsByArchive,
  getToday,
  DEFAULT_ARCHIVE,
  getNativeResult,
  isDailyGenerateCoolingDown,
  isDailyGenerateCancelled,
  clearDailyGenerateFailed,
  consumePreviousArchiveId,
} from '@/utils/archiveStorage'
import { ensureRemoteAssets, type RemoteAssets } from '@/constants/remote-assets'
import { pickLuckyStarIconName } from '@/constants/lucky-icons'
import { SHOW_METAPHYSICS } from '@/utils/channel'
import { ensureAiAccess, ensureLoggedIn, hasAgreedPrivacy, isWeappEnv, requireLogin } from '@/utils/auth'
import { LoginSheet } from '@/components/login-sheet'

// 静态图（幸运星/示例图/兜底图）URL 由 remote-assets 动态签发，禁止硬编码签名 URL（会过期）
const EXAMPLE_DAILY_RESULT: DailyResult = {
  date: getToday(),
  archiveId: DEFAULT_ARCHIVE.id,
  imageUrl: '',
  tryOnUrl: '',
  baziResult: {
    nickname: '小幸运',
    gender: 'female',
    dayMaster: '甲木',
    dayMasterElement: '木',
    fourPillars: [
      { name: '年柱', ganZhi: '乙亥', stem: '乙', branch: '亥', stemElement: '木', branchElement: '水', naYin: '山头火', tenGod: '劫财' },
      { name: '月柱', ganZhi: '丁卯', stem: '丁', branch: '卯', stemElement: '火', branchElement: '木', naYin: '炉中火', tenGod: '伤官' },
      { name: '日柱', ganZhi: '甲子', stem: '甲', branch: '子', stemElement: '木', branchElement: '水', naYin: '海中金', tenGod: '日主' },
      { name: '时柱', ganZhi: '己巳', stem: '己', branch: '巳', stemElement: '土', branchElement: '火', naYin: '大林木', tenGod: '正财' },
    ],
    fiveElements: [
      { name: '金', count: 1 },
      { name: '木', count: 3 },
      { name: '水', count: 2 },
      { name: '火', count: 1 },
      { name: '土', count: 1 },
    ],
    favorableElement: '木',
    favorableAnalysis: {
      dayMaster: '甲木',
      strength: '身强',
      coreYongShen: '木',
      assistantXiShen: '水',
      taboo: '金旺克木',
      logicSummary: '日主甲木生于春季，木气当令而身旺。八字中木水相生，宜以木来助身、水来润木，使木气舒展流通。',
    },
    outfit: {
      style: '率性工装休闲风',
      colors: ['森林绿', '燕麦灰', '珍珠白', '金属银'],
      description: '以森林绿飞行员夹克为核心，搭配浅灰工装裤与银色配饰，利落中带柔和，助木气舒展生发。',
      prompt: 'Sage green bomber jacket, white cropped tank top, light grey cargo pants, silver crossbody bag, olive baseball cap, silver hoop earrings, layered necklaces, white and silver chunky sneakers, cream marble background, fashion flat lay, 3:4 vertical, high-end photography',
      backgroundColor: '#F0F2EF',
    },
    imageUrl: '',
  },
  llmPlan: {
    luckyColors: {
      primary: '森林绿',
      secondary: '燕麦灰',
      accent: '金属银',
      primaryHex: '#4A6741',
      secondaryHex: '#E8E4DF',
      accentHex: '#C0C0C0',
    },
    styleTheme: '率性工装休闲风',
    outfitPlan: {
      outerwear: '军绿色飞行员夹克',
      top: '白色修身短款背心',
      bottom: '浅灰色多袋工装阔腿裤',
      shoes: '白银拼色厚底老爹鞋',
      bag: '银色金属感单肩包',
      accessories: ['橄榄绿棒球帽', '银色大圈耳环', '银色多层项链'],
    },
    fabricSuggestion: '挺括尼龙夹克防风有型，棉质工装裤透气耐磨，针织背心贴身柔软，适合春秋换季与城市户外活动。',
    occasions: ['周末出游', '城市漫步', '朋友聚会'],
    imagePrompt: 'Sage green bomber jacket, white cropped tank top, light grey cargo pants, silver crossbody bag, olive baseball cap, silver hoop earrings, layered necklaces, white and silver chunky sneakers, cream marble background, fashion flat lay, 3:4 vertical, high-end photography',
    negativePrompt: 'cluttered background, distorted hands, low quality, blurry, oversaturated colors, cropped items',
  } as StylistResult,
  luckyScore: {
    total: 82,
    aura: 80,
    career: 84,
    romance: 78,
    relax: 85,
    inspiration: 75,
    description: '今日木气通达，行动力与创意兼具。穿上森林绿与燕麦灰的搭配，贵人运与自信气场同步提升。',
  } as LuckyScore,
  ganZhiDate: { month: '丁卯', day: '甲子' },
  dailyYongShen: '木',
  dailyXiShen: '水',
  generatedAt: Date.now(),
}

export default function Index() {
  const todayStr = getToday()
  const [currentArchive, setCurrentArchive] = useState<Archive | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  const [hasArchiveChanged, setHasArchiveChanged] = useState(false)
  const [assets, setAssets] = useState<RemoteAssets | null>(null)
  // 生成失败冷却态：loading 页失败/被中断后回首页不再自动重进，展示失败卡片由用户手动重试
  const [generateFailed, setGenerateFailed] = useState(false)
  // 冷却来源为用户主动取消：首页展示正常空态（非失败卡片），仅 toast 提示「生成已取消」
  const [generateCancelled, setGenerateCancelled] = useState(false)

  const loadData = useCallback(async () => {
    // 静态图 URL 动态签发（本地缓存 7 天），失败时以背景色占位
    ensureRemoteAssets().then((a) => a && setAssets(a))

    const archives = await getArchives()
    const currentId = await getCurrentArchiveId()
    const activeArchive = archives.find((a) => a.id === currentId) || archives[0]
    setCurrentArchive(activeArchive)

    if (activeArchive.isDefault) {
      const remote = await ensureRemoteAssets()
      setDailyResult({
        ...EXAMPLE_DAILY_RESULT,
        imageUrl: remote?.exampleFlat || '',
        tryOnUrl: remote?.exampleTryOn || '',
      })
      setHasArchiveChanged(false)
      setGenerateFailed(false)
      setGenerateCancelled(false)
      // 切换已生效展示，消费掉「切换前档案」残留标记，避免后续 loading 取消时误回退
      consumePreviousArchiveId()
      return
    }

    const today = getToday()
    const cachedDaily = await getDailyResult(activeArchive.id, today)
    if (cachedDaily && cachedDaily.date === today) {
      setDailyResult(cachedDaily)
      setHasArchiveChanged(activeArchive.updatedAt > cachedDaily.generatedAt)
      setGenerateFailed(false)
      setGenerateCancelled(false)
      // 同上：切换已生效，消费残留标记
      consumePreviousArchiveId()
    } else if (isDailyGenerateCoolingDown(activeArchive.id, today)) {
      // 冷却期内（最近生成失败或被用户取消）：不自动跳 loading，交还用户主动权，
      // 打破「中断 → 回首页 → onShow 自动再进 → 再中断」的死循环；
      // 取消来源展示正常空态，失败来源展示失败重试卡片
      setDailyResult(null)
      setGenerateFailed(true)
      setGenerateCancelled(isDailyGenerateCancelled(activeArchive.id, today))
      // 冷却态意味着切换后的生成已被取消（回退逻辑在 loading 取消时已消费），
      // 或切换恰逢冷却未进 loading——统一清除残留 previous，避免过期回退
      consumePreviousArchiveId()
    } else {
      // 微信小程序：未同意隐私协议（未登录）时不自动触发 AI 生成，等待用户在登录弹层完成授权
      if (isWeappEnv() && !hasAgreedPrivacy()) return
      // 日期变化或缓存异常：清除该档案所有旧日期缓存，重新进入 loading 请求
      clearDailyResultsByArchive(activeArchive.id)
      setHasArchiveChanged(false)
      setGenerateFailed(false)
      setGenerateCancelled(false)
      // 确保已持有 token 再进入生成流程（登录未完成时等一次静默登录，避免 401）
      await ensureLoggedIn()
      Taro.navigateTo({
        url: `/pages/loading/index?mode=daily&archiveId=${activeArchive.id}`,
      })
      return
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const handleSwitchArchive = useCallback(() => {
    Taro.navigateTo({ url: '/pages/archive/list/index' })
  }, [])

  const handleAddArchive = useCallback(async () => {
    // 添加档案需登录：未登录时唤起全局登录弹层，完成登录后再次点击即可
    if (!(await requireLogin())) return
    Taro.navigateTo({ url: '/pages/archive/form/index' })
  }, [])

  const handleViewResult = useCallback(() => {
    if (!currentArchive) return
    if (currentArchive.isDefault) {
      handleAddArchive()
      return
    }
    Taro.navigateTo({ url: `/pages/result/index?archiveId=${currentArchive.id}` })
  }, [currentArchive, handleAddArchive])

  // 冷却态（失败/取消）的手动生成入口：清除冷却标记并进入 loading 重新生成
  const handleRetryGenerate = useCallback(async () => {
    if (!currentArchive) return
    if (!(await ensureAiAccess())) return
    clearDailyGenerateFailed(currentArchive.id, todayStr)
    setGenerateFailed(false)
    setGenerateCancelled(false)
    Taro.navigateTo({
      url: `/pages/loading/index?mode=daily&archiveId=${currentArchive.id}`,
    })
  }, [currentArchive, todayStr])

  const handleViewResultWithAnchor = useCallback((anchor: string) => () => {
    if (!currentArchive) return
    if (currentArchive.isDefault) {
      handleAddArchive()
      return
    }
    Taro.navigateTo({ url: `/pages/result/index?archiveId=${currentArchive.id}&anchor=${anchor}` })
  }, [currentArchive, handleAddArchive])

  const handleViewNative = useCallback(async () => {
    if (!currentArchive) return
    if (currentArchive.isDefault) {
      handleAddArchive()
      return
    }
    // 已有本命穿搭缓存则直接进入结果页，避免重复 loading
    const nativeResult = getNativeResult(currentArchive.id)
    if (nativeResult?.baziResult) {
      Taro.navigateTo({ url: `/pages/result/index?mode=native&archiveId=${currentArchive.id}` })
      return
    }
    if (!(await ensureAiAccess())) return
    Taro.navigateTo({ url: `/pages/loading/index?mode=native&archiveId=${currentArchive.id}` })
  }, [currentArchive, handleAddArchive])

  const handleUpdateArchive = useCallback(async () => {
    if (!currentArchive || currentArchive.isDefault) return
    if (!(await ensureAiAccess())) return
    clearDailyResultsByArchive(currentArchive.id)
    Taro.navigateTo({
      url: `/pages/loading/index?mode=daily&archiveId=${currentArchive.id}`,
    })
  }, [currentArchive, todayStr])

  const formatDate = useCallback(() => {
    const now = new Date()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
  }, [])

  if (!currentArchive || (!dailyResult && !generateFailed)) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-40 w-full" />
        {/* 全局登录弹层（页面级挂载，小程序端 App 不渲染 UI） */}
        <LoginSheet />
      </View>
    )
  }

  // 冷却态：无结果数据可渲染（内容区依赖 dailyResult），仅展示静态卡片与手动生成入口。
  // 上一分支已排除 (!dailyResult && !generateFailed)，到达这里且 dailyResult 为空时必为冷却态。
  // 用户主动取消 → 正常空态；真实失败 → 失败重试卡片
  if (!dailyResult) {
    return (
      <View className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <Card className="w-full">
          <CardContent className="p-6 flex flex-col items-center">
            {generateCancelled ? (
              <>
                {/* 空态图标：衬衫（穿搭主体）+ 右上角星光点缀（幸运/AI 生成），呼应「幸运穿搭」定位 */}
                <View className="relative flex items-center justify-center w-20 h-20 rounded-full bg-slate-100">
                  <Shirt size={36} color="#0f172a" strokeWidth={1.8} />
                  <View className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-white">
                    <Sparkles size={14} color="#0f172a" />
                  </View>
                </View>
                <Text className="block text-lg font-semibold text-gray-900 mt-5">今日穿搭待生成</Text>
                <Text className="block text-sm text-gray-500 mt-2 text-center leading-relaxed">
                  点击下方按钮，生成你的专属幸运穿搭
                </Text>
              </>
            ) : (
              <>
                <CloudOff size={56} color="#9ca3af" />
                <Text className="block text-lg font-semibold text-gray-900 mt-5">今日穿搭尚未生成</Text>
                <Text className="block text-sm text-gray-500 mt-2 text-center leading-relaxed">
                  网络繁忙或服务暂时不可用，点击按钮重试
                </Text>
              </>
            )}
            <Button className="w-full mt-6" onClick={handleRetryGenerate}>
              <View className="flex flex-row items-center justify-center gap-1">
                {generateCancelled ? <WandSparkles size={16} color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
                <Text className="text-sm">{generateCancelled ? '立即生成' : '重新生成'}</Text>
              </View>
            </Button>
            {/* 切换档案入口：冷却态页面无顶部档案栏，需独立提供切换通道 */}
            <Button variant="outline" className="w-full mt-3" onClick={handleSwitchArchive}>
              <View className="flex flex-row items-center justify-center gap-1">
                <Users size={16} color="#0f172a" />
                <Text className="text-sm">切换档案</Text>
              </View>
            </Button>
          </CardContent>
        </Card>
        {/* 全局登录弹层（页面级挂载，小程序端 App 不渲染 UI） */}
        <LoginSheet />
      </View>
    )
  }

  const { luckyScore, llmPlan, baziResult } = dailyResult
  const themeColor = llmPlan.luckyColors?.primaryHex || '#1E3A5F'
  // 幸运星图：示例档案固定展示图，其他档案从幸运星库按档案 ID 稳定选取（同一档案始终同一张）
  const luckyStarKey: keyof RemoteAssets = currentArchive?.isDefault
    ? 'exampleLuckyStar'
    : pickLuckyStarIconName(currentArchive?.id ?? 'default')
  const luckyStarUrl = assets?.[luckyStarKey] || assets?.exampleLuckyStar || ''

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {/* 顶部档案切换 - 吸顶 */}
      <View
        className="bg-white px-4 pt-3 pb-3 z-50 border-b border-gray-100"
        style={{ position: 'sticky', top: 0 }}
      >
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-3">
            <View>
              <Text className="block text-lg font-semibold text-gray-900">{currentArchive.nickname}</Text>
              {hasArchiveChanged && !currentArchive.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 mt-1"
                  onClick={handleUpdateArchive}
                >
                  <Text className="block text-xs text-slate-900">
                    档案有变更，立即更新
                  </Text>
                </Button>
              )}
            </View>
          </View>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 focus:outline-none focus-visible:outline-none active:outline-none"
            hoverClass=""
            onClick={handleSwitchArchive}
          >
            <Text className="block text-sm text-gray-600">
              {currentArchive?.isDefault ? '添加档案' : '切换档案'}
            </Text>
            <ChevronRight size={16} color="#6B7280" />
          </Button>
        </View>
      </View>

      {/* 幸运指数（玄学内容，抖音渠道隐藏） */}
      {SHOW_METAPHYSICS && (
      <View className="px-4 pt-4">
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-4">
              <Text className="block text-base font-semibold text-gray-900">幸运指数</Text>
              <Text className="block text-xs text-gray-400">{formatDate()}</Text>
            </View>

            <View className="flex items-center gap-4 mb-4">
              {luckyStarUrl ? (
                <Image
                  className="w-20 h-20"
                  src={luckyStarUrl}
                  mode="aspectFit"
                  lazyLoad
                  onError={() => {
                    console.warn('[Index] lucky star image load failed')
                    // 实际渲染 URL 来自 luckyStarKey 或回退的 exampleLuckyStar，置空对应 key
                    const brokenKey = assets?.[luckyStarKey] ? luckyStarKey : 'exampleLuckyStar'
                    setAssets((prev) => (prev ? { ...prev, [brokenKey]: '' } : prev))
                  }}
                />
              ) : (
                <View className="w-20 h-20 rounded-full bg-amber-100" />
              )}
              <View className="flex-1">
                <Text className="block text-sm text-gray-600 leading-relaxed">{luckyScore.description}</Text>
              </View>
            </View>

            <View className="grid grid-cols-5 gap-2">
              {[
                { label: '气场', value: luckyScore.aura },
                { label: '事业', value: luckyScore.career },
                { label: '桃花', value: luckyScore.romance },
                { label: '放松', value: luckyScore.relax },
                { label: '灵感', value: luckyScore.inspiration },
              ].map((item) => (
                <View key={item.label} className="flex flex-col items-center gap-1">
                  <Text className="block text-xs text-gray-500">{item.label}</Text>
                  <Text className="block text-sm font-semibold text-slate-900">
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>
      )}

      {/* 今日穿搭 */}
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewResult}>
          <CardContent className="p-4">
            <View className="mb-3 flex flex-row items-center justify-between">
              <Text className="block text-base font-semibold text-gray-900">今日穿搭</Text>
              <ChevronRight size={20} color="#9ca3af" />
            </View>

            <View className="flex flex-row gap-3">
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative">
                {dailyResult.imageUrl ? (
                  <Image src={dailyResult.imageUrl} className="w-full h-full" mode="aspectFill" onError={() => {
                    console.warn('[Index] flat image load failed')
                    setDailyResult((prev) => (prev ? { ...prev, imageUrl: '' } : prev))
                  }}
                  />
                ) : assets?.fallback ? (
                  <Image src={assets.fallback} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] fallback flat image load failed')} />
                ) : null}
                {!dailyResult.imageUrl && (
                  <View className="absolute bottom-2 left-2 right-2">
                    <Button
                      size="sm"
                      className="w-full bg-white bg-opacity-95 backdrop-blur-sm border border-gray-200 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewResult()
                      }}
                    >
                      <Text className="block text-gray-900 text-xs">解锁平铺图</Text>
                    </Button>
                  </View>
                )}
              </View>
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative">
                {dailyResult.tryOnUrl ? (
                  <Image src={dailyResult.tryOnUrl} className="w-full h-full" mode="aspectFill" onError={() => {
                    console.warn('[Index] tryOn image load failed')
                    setDailyResult((prev) => (prev ? { ...prev, tryOnUrl: '' } : prev))
                  }}
                  />
                ) : assets?.fallback ? (
                  <Image src={assets.fallback} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] fallback tryOn image load failed')} />
                ) : null}
                {!dailyResult.tryOnUrl && (
                  <View className="absolute bottom-2 left-2 right-2">
                    <Button
                      size="sm"
                      className="w-full bg-white bg-opacity-95 backdrop-blur-sm border border-gray-200 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewResult()
                      }}
                    >
                      <Text className="block text-gray-900 text-xs">解锁上身图</Text>
                    </Button>
                  </View>
                )}
              </View>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 穿搭指南 */}
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewResultWithAnchor('outfit')}>
          <CardContent className="p-4">
            <View className="mb-3 flex flex-row items-center justify-between">
              <Text className="block text-base font-semibold text-gray-900">穿搭指南</Text>
              <ChevronRight size={20} color="#9ca3af" />
            </View>

            <OutfitGuideContent
              result={dailyResult.baziResult}
              llmPlan={dailyResult.llmPlan}
              pageMode="daily"
              yongShen={dailyResult.dailyYongShen}
              xiShen={dailyResult.dailyXiShen}
              themeColor={themeColor}
              occasionColor="#111827"
              occasionBgTransparent
              showTitle={false}
              showBaziOverview={false}
            />
          </CardContent>
        </Card>
      </View>

      {/* 本命穿搭（玄学内容，抖音渠道隐藏） */}
      {SHOW_METAPHYSICS && (
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewNative}>
          <CardContent className="p-4">
            <View className="mb-3 flex flex-row items-center justify-between">
              <Text className="block text-base font-semibold text-gray-900">本命穿搭</Text>
              <ChevronRight size={20} color="#9ca3af" />
            </View>

            <View className="space-y-3">
              <View className="bg-gray-50 rounded-xl p-3">
                <Text className="block text-sm font-medium text-gray-900 mb-2">个人分析</Text>
                <View className="space-y-2">
                  <View className="flex items-center gap-2">
                    <Text className="block text-sm text-gray-500">日主</Text>
                    <Text className="block text-sm font-medium text-gray-900">{baziResult.dayMaster}</Text>
                  </View>
                  <View className="flex items-center gap-2">
                    <Text className="block text-sm text-gray-500">日主强弱</Text>
                    <Text className="block text-sm font-medium text-gray-900">{baziResult.favorableAnalysis.strength}</Text>
                  </View>
                  <View className="flex items-center gap-2">
                    <Text className="block text-sm text-gray-500">核心用神</Text>
                    <Text className="block text-sm font-medium text-gray-900">{baziResult.favorableAnalysis.coreYongShen}</Text>
                  </View>
                  <View className="flex items-center gap-2">
                    <Text className="block text-sm text-gray-500">喜神</Text>
                    <Text className="block text-sm font-medium text-gray-900">{baziResult.favorableAnalysis.assistantXiShen}</Text>
                  </View>
                  <View className="flex items-start gap-2">
                    <Text className="block text-sm text-gray-500 shrink-0">逻辑</Text>
                    <Text className="block text-sm text-gray-700 leading-relaxed">{baziResult.favorableAnalysis.logicSummary}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleViewNative}>
              <Text className="block text-sm text-gray-700">查看详情</Text>
            </Button>
          </CardContent>
        </Card>
      </View>
      )}

      {/* 空档案提示 */}
      {currentArchive.isDefault && (
        <View
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f3f4f6',
            zIndex: 50,
          }}
        >
          <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={handleAddArchive}>
            <Plus size={18} color="#FFFFFF" />
            <Text className="block text-white ml-2">添加档案，查看今日穿搭</Text>
          </Button>
        </View>
      )}

      {/* 全局登录弹层（页面级挂载，小程序端 App 不渲染 UI） */}
      <LoginSheet />
    </View>
  )
}
