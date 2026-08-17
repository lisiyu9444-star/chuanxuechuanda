import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { ChevronRight, Plus } from 'lucide-react-taro'
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
  clearDailyResult,
  getToday,
  DEFAULT_ARCHIVE,
} from '@/utils/archiveStorage'

const LUCKY_STAR_HAPPY_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7665650076865331200/example/Xing_Yun_Xing_Kai_Xin_06859ac3.png?sign=1789581330-df152f5439-0-702422be9367ca1f93714edfbd23fe10a4cc2e3cfeba0f7460db309261585b47'
const FALLBACK_IMAGE_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7665650076865331200/placeholder_compressed_fc42a6fb.jpg?sign=1789570488-e3736db199-0-8a30a66f5bbc9632daba064367ba177cac6a1067704b5b2cd1114e4d0896686d'

const EXAMPLE_DAILY_RESULT: DailyResult = {
  date: getToday(),
  archiveId: DEFAULT_ARCHIVE.id,
  imageUrl: 'https://coze-coding-project.tos.coze.site/coze_storage_7665650076865331200/example/example_flat_compressed_fcb0c028.jpg?sign=1789580235-48c8362e20-0-039add2bf90ca3078948e464fff0ad253513740f2a4b217f882689de5c03d485',
  tryOnUrl: 'https://coze-coding-project.tos.coze.site/coze_storage_7665650076865331200/example/example_tryon_compressed_2655e65c.jpg?sign=1789580235-a42be68c89-0-7bf09693ea868ced5274e4b0859a3d57c3feba8e455666990526a190c1f9cdd8',
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
    imageUrl: 'https://coze-coding-project.tos.coze.site/coze_storage_7665650076865331200/example/example_flat_compressed_fcb0c028.jpg?sign=1789580235-48c8362e20-0-039add2bf90ca3078948e464fff0ad253513740f2a4b217f882689de5c03d485',
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
    love: 80,
    career: 84,
    family: 78,
    life: 85,
    study: 75,
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

  const loadData = useCallback(async () => {
    const archives = await getArchives()
    const currentId = await getCurrentArchiveId()
    const activeArchive = archives.find((a) => a.id === currentId) || archives[0]
    setCurrentArchive(activeArchive)

    if (activeArchive.isDefault) {
      setDailyResult(EXAMPLE_DAILY_RESULT)
      setHasArchiveChanged(false)
      return
    }

    const today = getToday()
    const cachedDaily = await getDailyResult(activeArchive.id, today)
    if (cachedDaily) {
      setDailyResult(cachedDaily)
      setHasArchiveChanged(activeArchive.updatedAt > cachedDaily.generatedAt)
    } else {
      setHasArchiveChanged(false)
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

  const handleAddArchive = useCallback(() => {
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

  const handleViewNative = useCallback(() => {
    if (!currentArchive) return
    if (currentArchive.isDefault) {
      handleAddArchive()
      return
    }
    Taro.navigateTo({ url: `/pages/result/index?mode=native&archiveId=${currentArchive.id}` })
  }, [currentArchive, handleAddArchive])

  const handleUpdateArchive = useCallback(() => {
    if (!currentArchive || currentArchive.isDefault) return
    clearDailyResult(currentArchive.id, todayStr)
    Taro.navigateTo({
      url: `/pages/loading/index?mode=daily&archiveId=${currentArchive.id}`,
    })
  }, [currentArchive, todayStr])

  const formatDate = useCallback(() => {
    const now = new Date()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
  }, [])

  if (!currentArchive || !dailyResult) {
    return (
      <View className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-40 w-full" />
      </View>
    )
  }

  const { luckyScore, llmPlan, baziResult } = dailyResult
  const themeColor = llmPlan.luckyColors?.primaryHex || '#1E3A5F'

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
          <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={handleSwitchArchive}>
            <Text className="block text-sm text-gray-600">切换档案</Text>
            <ChevronRight size={16} color="#6B7280" />
          </Button>
        </View>
      </View>

      {/* 幸运指数 */}
      <View className="px-4 pt-4">
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-4">
              <Text className="block text-base font-semibold text-gray-900">幸运指数</Text>
              <Text className="block text-xs text-gray-400">{formatDate()}</Text>
            </View>

            <View className="flex items-center gap-4 mb-4">
              <Image
                className="w-20 h-20"
                src={LUCKY_STAR_HAPPY_URL}
                mode="aspectFit"
                lazyLoad
              />
              <View className="flex-1">
                <Text className="block text-sm text-gray-600 leading-relaxed">{luckyScore.description}</Text>
              </View>
            </View>

            <View className="grid grid-cols-5 gap-2">
              {[
                { label: '爱情', value: luckyScore.love },
                { label: '事业', value: luckyScore.career },
                { label: '家庭', value: luckyScore.family },
                { label: '生活', value: luckyScore.life },
                { label: '学习', value: luckyScore.study },
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

      {/* 今日穿搭 */}
      <View className="px-4 mt-4">
        <Card>
          <CardContent className="p-4">
            <View className="mb-3 flex flex-row items-center justify-between">
              <Text className="block text-base font-semibold text-gray-900">今日穿搭</Text>
              <ChevronRight size={20} color="#9ca3af" />
            </View>

            <View className="flex flex-row gap-3">
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative" onClick={handleViewResult}>
                {dailyResult.imageUrl ? (
                  <Image src={dailyResult.imageUrl} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] flat image load failed')} />
                ) : (
                  <Image src={FALLBACK_IMAGE_URL} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] fallback flat image load failed')} />
                )}
                {!dailyResult.imageUrl && (
                  <View className="absolute bottom-2 left-2 right-2">
                    <Button
                      size="sm"
                      className="w-full bg-slate-900 hover:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewResult()
                      }}
                    >
                      <Text className="block text-white text-xs">解锁平铺图</Text>
                    </Button>
                  </View>
                )}
              </View>
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative" onClick={handleViewResult}>
                {dailyResult.tryOnUrl ? (
                  <Image src={dailyResult.tryOnUrl} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] tryOn image load failed')} />
                ) : (
                  <Image src={FALLBACK_IMAGE_URL} className="w-full h-full" mode="aspectFill" onError={() => console.warn('[Index] fallback tryOn image load failed')} />
                )}
                {!dailyResult.tryOnUrl && (
                  <View className="absolute bottom-2 left-2 right-2">
                    <Button
                      size="sm"
                      className="w-full bg-slate-900 hover:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewResult()
                      }}
                    >
                      <Text className="block text-white text-xs">解锁上身图</Text>
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
        <Card className="active:opacity-80" onClick={handleViewResult}>
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
              showTitle={false}
              showBaziOverview={false}
            />
          </CardContent>
        </Card>
      </View>

      {/* 本命穿搭 */}
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewNative}>
          <CardContent className="p-4">
            <View className="mb-3 flex flex-row items-center justify-between">
              <Text className="block text-base font-semibold text-gray-900">本命穿搭</Text>
              <ChevronRight size={20} color="#9ca3af" />
            </View>

            <View className="space-y-3">
              <View className="bg-gray-50 rounded-xl p-3">
                <Text className="block text-sm font-medium text-gray-900 mb-2">喜用神分析</Text>
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
                    <Text className="block text-sm font-medium" style={{ color: themeColor }}>{baziResult.favorableAnalysis.coreYongShen}</Text>
                  </View>
                  <View className="flex items-center gap-2">
                    <Text className="block text-sm text-gray-500">喜神</Text>
                    <Text className="block text-sm font-medium" style={{ color: themeColor }}>{baziResult.favorableAnalysis.assistantXiShen}</Text>
                  </View>
                  <View className="flex items-start gap-2">
                    <Text className="block text-sm text-gray-500 shrink-0">用神逻辑</Text>
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

      {/* 空档案提示 */}
      {currentArchive.isDefault && (
        <View className="px-4 mt-4">
          <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={handleAddArchive}>
            <Plus size={18} color="#FFFFFF" />
            <Text className="block text-white ml-2">添加我的档案</Text>
          </Button>
        </View>
      )}
    </View>
  )
}
