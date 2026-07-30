import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, CircleCheck, Rocket, Share2 } from 'lucide-react-taro'
import './index.css'

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
  }
  imageUrl: string
}

const ELEMENT_COLORS: Record<string, string> = {
  '木': '#22c55e',
  '火': '#ef4444',
  '土': '#f59e0b',
  '金': '#6b7280',
  '水': '#3b82f6',
}

const ResultPage = () => {
  const [result, setResult] = useState<BaZiResult | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useDidShow(() => {
    const data = Taro.getStorageSync('baziResult')
    if (data) {
      setResult(data)
    }
    // 检查是否刚从分享返回
    const justShared = Taro.getStorageSync('justShared')
    if (justShared) {
      setUnlocked(true)
      Taro.removeStorageSync('justShared')
    }
  })

  const handleUnlock = () => {
    Taro.showModal({
      title: '解锁今日穿搭',
      content: '观看短视频即可解锁你的专属穿搭推荐',
      confirmText: '观看解锁',
      confirmColor: '#6366f1',
      success: (res) => {
        if (res.confirm) {
          Taro.setStorageSync('outfitUnlocked', true) // 保存解锁状态
          setUnlocked(true)
        }
      },
    })
  }

  // 分享解锁相关逻辑
  const [sharedToday, setSharedToday] = useState(false)

  useEffect(() => {
    // 检查今日是否已分享过
    const lastShareDate = Taro.getStorageSync('lastShareDate')
    const today = new Date().toDateString()
    if (lastShareDate === today) {
      setSharedToday(true)
    }
  }, [])

  const handleShareClick = () => {
    if (sharedToday) {
      Taro.showToast({
        title: '今日已分享过，明日再来～',
        icon: 'none',
        duration: 2000,
      })
      return false // 阻止分享
    }
    // 设置标记，分享返回后解锁
    Taro.setStorageSync('justShared', true)
    return true
  }

  // 小程序分享配置
  Taro.useShareAppMessage(() => {
    return {
      title: `${result?.nickname || '我'}的专属穿搭推荐，快来看看！`,
      path: '/pages/result/index',
    }
  })

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
      </View>

      {/* Image Area */}
      <View className="relative w-full rounded-2xl overflow-hidden mb-5 bg-gray-100">
        <View className="w-full" style={{ height: '600px' }}>
          <Image
            src={result.imageUrl}
            className="w-full h-full"
            mode="aspectFill"
            style={
              unlocked
                ? { filter: 'none' }
                : { filter: 'blur(20px)' }
            }
          />
        </View>
        {!unlocked && (
          <View
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}
          >
            <Lock size={32} color="#6366f1" />
            <Text className="block text-gray-900 mt-3 text-base font-medium">
              你的专属穿搭已生成
            </Text>
            <Text className="block text-gray-400 mt-1 text-sm">
              观看视频即可解锁
            </Text>
          </View>
        )}
      </View>

      {/* Unlock Buttons */}
      {!unlocked && (
        <View className="mb-5 flex flex-col gap-3">
          {/* 观看视频解锁 */}
          <Button
            className="w-full text-white font-bold py-4 rounded-xl border-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #C084FC 100%)',
            }}
            onClick={handleUnlock}
          >
            <Rocket size={18} color="#ffffff" />
            <Text className="ml-2 text-white font-bold">
              解锁今日专属穿搭
            </Text>
          </Button>

          {/* 分享好友解锁 */}
          <Button
            className="w-full bg-white text-purple-500 border-2 border-purple-200 py-4 rounded-xl shadow-sm"
            onClick={handleShareClick}
            openType="share"
          >
            <Share2 size={18} color="#7C3AED" />
            <Text className="ml-2 text-purple-500 font-bold">
              分享好友解锁
            </Text>
          </Button>
        </View>
      )}

      {/* Unlocked Content */}
      {unlocked && (
        <View className="flex flex-col gap-4">
          {/* Unlocked indicator */}
          <View className="flex items-center justify-center gap-2 py-1">
            <CircleCheck size={16} color="#22c55e" />
            <Text className="text-sm text-green-500">已解锁</Text>
          </View>

          {/* BaZi Summary */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center justify-between mb-3">
                <Text className="block text-sm font-medium text-purple-500">
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
              <Text className="block text-sm font-medium text-purple-500 mb-3">
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
            </CardContent>
          </Card>

          {/* Outfit Recommendation */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <Text className="block text-sm font-medium text-purple-500 mb-2">
                穿搭推荐
              </Text>
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
            </CardContent>
          </Card>

        </View>
      )}
      </View>

      {/* Fixed Bottom Button */}
      <View
        className="fixed left-0 right-0 bg-white border-t border-gray-100 px-6 py-3"
        style={{ bottom: 0, zIndex: 100 }}
      >
        <Button
          className="w-full bg-white text-purple-500 border border-purple-200 py-3 rounded-xl"
          onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
        >
          <Text className="text-purple-500">重新测算</Text>
        </Button>
      </View>
    </View>
  )
}

export default ResultPage
