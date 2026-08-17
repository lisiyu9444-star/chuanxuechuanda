import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { ChevronRight, User, Plus, Sparkles, Shirt, Crown } from 'lucide-react-taro'
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
  DEFAULT_ARCHIVE,
} from '@/utils/archiveStorage'

const EXAMPLE_DAILY_RESULT: DailyResult = {
  date: new Date().toISOString().split('T')[0],
  archiveId: DEFAULT_ARCHIVE.id,
  baziResult: {
    nickname: '示例用户',
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
      { name: '金', count: 0 },
      { name: '木', count: 3 },
      { name: '水', count: 2 },
      { name: '火', count: 2 },
      { name: '土', count: 1 },
    ],
    favorableElement: '水',
    favorableAnalysis: {
      dayMaster: '甲木',
      strength: '中和偏旺',
      coreYongShen: '水',
      assistantXiShen: '金',
      taboo: '火土过旺',
      logicSummary: '日主甲木生于春季，木气当令，日主得时。八字中水木较旺，宜以水来滋润，金来修剪。',
    },
    outfit: {
      style: '简约通勤',
      colors: ['黑色', '深蓝色', '白色', '银灰色'],
      description: '示例档案的穿搭方向，以水润木、金修剪为主。',
      prompt: '示例档案穿搭提示词',
      backgroundColor: '#F5F1E8',
    },
    imageUrl: '',
  },
  llmPlan: {
    luckyColors: {
      primary: '深海蓝',
      secondary: '珍珠白',
      accent: '雾银灰',
      primaryHex: '#1E3A5F',
      secondaryHex: '#F8F6F1',
      accentHex: '#9CA3AF',
    },
    styleTheme: '韩系温柔通勤风',
    outfitPlan: {
      outerwear: '米白色针织开衫',
      top: '雾霾蓝 silk shirt',
      bottom: '高腰垂感阔腿裤',
      shoes: '杏色乐福鞋',
      bag: '白色豆腐包',
      accessories: ['珍珠耳钉', '细银项链'],
    },
    fabricSuggestion: '春季适合柔软亲肤的棉麻与针织面料，透气且有垂坠感。',
    occasions: ['通勤：整套搭配直接出门，干练不失温柔', '约会：解开一粒扣子，挽起袖口更随性'],
    imagePrompt: '示例图片提示词',
    negativePrompt: '示例负面提示词',
  } as StylistResult,
  luckyScore: {
    total: 85,
    love: 88,
    career: 82,
    family: 80,
    life: 86,
    study: 84,
    description: '今日水木相生，灵感如泉涌。适合穿带有流动感的深蓝色系，贵人运会悄然提升。',
  } as LuckyScore,
  ganZhiDate: { month: '丁卯', day: '甲子' },
  dailyYongShen: '水',
  dailyXiShen: '金',
  generatedAt: Date.now(),
}

export default function Index() {
  const [currentArchive, setCurrentArchive] = useState<Archive | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)

  const loadData = useCallback(async () => {
    const archives = await getArchives()
    const currentId = await getCurrentArchiveId()
    const activeArchive = archives.find((a) => a.id === currentId) || archives[0]
    setCurrentArchive(activeArchive)

    if (activeArchive.isDefault) {
      setDailyResult(EXAMPLE_DAILY_RESULT)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const cachedDaily = await getDailyResult(activeArchive.id, today)
    if (cachedDaily) {
      setDailyResult(cachedDaily)
    } else {
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

  const handleUnlockImage = useCallback(
    async (type: 'flat' | 'tryOn') => {
      if (!currentArchive || currentArchive.isDefault) {
        handleAddArchive()
        return
      }
      if (!dailyResult) return
      Taro.navigateTo({
        url: `/pages/result/index?archiveId=${currentArchive.id}&unlock=${type}`,
      })
    },
    [currentArchive, dailyResult, handleAddArchive],
  )

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
      {/* 顶部档案切换 */}
      <View className="bg-white px-4 pt-12 pb-4">
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-3">
            <View
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: themeColor }}
            >
              <User size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text className="block text-lg font-semibold text-gray-900">{currentArchive.nickname}</Text>
              <Text className="block text-xs text-gray-500">{formatDate()}</Text>
            </View>
          </View>
          <Button variant="ghost" size="sm" className="flex items-center gap-1" onClick={handleSwitchArchive}>
            <Text className="block text-sm text-gray-600">切换档案</Text>
            <ChevronRight size={16} color="#6B7280" />
          </Button>
        </View>
      </View>

      {/* 幸运指数 */}
      <View className="px-4 mt-4">
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-4">
              <Sparkles size={18} color={themeColor} />
              <Text className="block text-base font-semibold text-gray-900">幸运指数</Text>
            </View>

            <View className="flex items-center gap-4 mb-4">
              <View
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                <Text className="block text-2xl font-bold" style={{ color: themeColor }}>
                  {luckyScore.total}
                </Text>
              </View>
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
                  <Text className="block text-sm font-semibold" style={{ color: themeColor }}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 穿搭指南 */}
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewResult}>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <View className="flex items-center gap-2">
                <Shirt size={18} color={themeColor} />
                <Text className="block text-base font-semibold text-gray-900">穿搭指南</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </View>

            <OutfitGuideContent
              result={baziResult}
              llmPlan={llmPlan}
              pageMode="daily"
              yongShen={dailyResult.dailyYongShen}
              xiShen={dailyResult.dailyXiShen}
              themeColor={themeColor}
              showTitle={false}
            />
          </CardContent>
        </Card>
      </View>

      {/* 今日穿搭 */}
      <View className="px-4 mt-4">
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <View className="flex items-center gap-2">
                <Crown size={18} color={themeColor} />
                <Text className="block text-base font-semibold text-gray-900">今日穿搭</Text>
              </View>
              <Button variant="ghost" size="sm" onClick={handleViewResult}>
                <Text className="block text-sm" style={{ color: themeColor }}>查看详情</Text>
              </Button>
            </View>

            <View className="flex flex-row gap-3">
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative" onClick={handleViewResult}>
                {dailyResult.imageUrl ? (
                  <Image src={dailyResult.imageUrl} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <View className="absolute inset-0 flex items-center justify-center">
                    <Text className="block text-sm text-gray-500">待解锁</Text>
                  </View>
                )}
                <View className="absolute bottom-2 left-2 right-2">
                  <Button
                    size="sm"
                    className="w-full"
                    style={{ backgroundColor: themeColor }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnlockImage('flat')
                    }}
                  >
                    <Text className="block text-white text-xs">{dailyResult.imageUrl ? '查看平铺图' : '解锁平铺图'}</Text>
                  </Button>
                </View>
              </View>
              <View className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative" onClick={handleViewResult}>
                {dailyResult.tryOnUrl ? (
                  <Image src={dailyResult.tryOnUrl} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <View className="absolute inset-0 flex items-center justify-center">
                    <Text className="block text-sm text-gray-500">待解锁</Text>
                  </View>
                )}
                <View className="absolute bottom-2 left-2 right-2">
                  <Button
                    size="sm"
                    className="w-full"
                    style={{ backgroundColor: themeColor }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnlockImage('tryOn')
                    }}
                  >
                    <Text className="block text-white text-xs">{dailyResult.tryOnUrl ? '查看上身图' : '解锁上身图'}</Text>
                  </Button>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 本命穿搭 */}
      <View className="px-4 mt-4">
        <Card className="active:opacity-80" onClick={handleViewNative}>
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <View className="flex items-center gap-2">
                <Crown size={18} color={themeColor} />
                <Text className="block text-base font-semibold text-gray-900">本命穿搭</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
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
          <Button className="w-full" style={{ backgroundColor: themeColor }} onClick={handleAddArchive}>
            <Plus size={18} color="#FFFFFF" />
            <Text className="block text-white ml-2">添加我的档案</Text>
          </Button>
        </View>
      )}
    </View>
  )
}
