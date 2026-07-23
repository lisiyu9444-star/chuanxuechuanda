import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Lock, CircleCheck } from 'lucide-react-taro'
import './index.css'

interface BaZiResult {
  nickname: string
  gender: string
  fourPillars: Array<{
    name: string
    stem: string
    branch: string
    stemElement: string
    branchElement: string
  }>
  fiveElements: Array<{ name: string; count: number }>
  favorableElement: string
  outfit: {
    style: string
    colors: string[]
    description: string
    prompt: string
  }
  imageUrl: string
}

const ELEMENT_COLORS: Record<string, string> = {
  '木': '#4a9e6e',
  '火': '#c75450',
  '土': '#c9a054',
  '金': '#b8b0a8',
  '水': '#4a7fb5',
}

const ResultPage = () => {
  const [result, setResult] = useState<BaZiResult | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useDidShow(() => {
    const data = Taro.getStorageSync('baziResult')
    if (data) {
      setResult(data)
    }
  })

  const handleUnlock = () => {
    Taro.showModal({
      title: '解锁今日穿搭',
      content: '观看短视频即可解锁您的专属穿搭推荐',
      confirmText: '观看解锁',
      confirmColor: '#c9a96e',
      success: (res) => {
        if (res.confirm) {
          setUnlocked(true)
        }
      },
    })
  }

  if (!result) {
    return (
      <View className="min-h-full bg-[#0d1117] flex items-center justify-center">
        <Text className="text-[#8b8680]">加载中...</Text>
      </View>
    )
  }

  const elementColor = ELEMENT_COLORS[result.favorableElement] || '#c9a96e'

  return (
    <View className="min-h-full bg-[#0d1117] px-6 py-6">
      {/* Header */}
      <View className="flex flex-col items-center mb-6">
        <Text className="block text-xl font-serif text-[#c9a96e] mb-1">
          {result.nickname} 的今日穿搭
        </Text>
        <Text className="block text-sm text-[#8b8680]">
          基于八字命理 · 为您量身定制
        </Text>
      </View>

      {/* Image Area */}
      <View className="relative w-full rounded-xl overflow-hidden mb-6 bg-[#161b22]">
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
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.5)' }}
          >
            <Lock size={36} color="#c9a96e" />
            <Text className="block text-[#f0ebe3] mt-3 text-base font-serif">
              您的专属穿搭已生成
            </Text>
            <Text className="block text-[#8b8680] mt-1 text-sm">
              观看视频即可解锁
            </Text>
          </View>
        )}
      </View>

      {/* Unlock Button */}
      {!unlocked && (
        <View className="mb-6">
          <Button
            className="w-full bg-[#c9a96e] text-[#0d1117] font-bold py-4 rounded-lg border-0"
            onClick={handleUnlock}
          >
            <Sparkles size={18} color="#0d1117" />
            <Text className="ml-2 text-[#0d1117] font-bold">
              观看视频解锁穿搭
            </Text>
          </Button>
        </View>
      )}

      {/* Unlocked Content */}
      {unlocked && (
        <View className="flex flex-col gap-4">
          {/* Unlocked indicator */}
          <View className="flex items-center justify-center gap-2 py-2">
            <CircleCheck size={16} color="#4a9e6e" />
            <Text className="text-sm text-[#4a9e6e]">已解锁</Text>
          </View>

          {/* BaZi Summary */}
          <Card className="bg-[#161b22] border-[#2a2a35]">
            <CardContent className="p-5">
              <Text className="block text-sm text-[#c9a96e] mb-4 font-serif">
                八字概览
              </Text>
              <View className="flex justify-between gap-2">
                {result.fourPillars.map((pillar) => (
                  <View
                    key={pillar.name}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <Text className="block text-xs text-[#8b8680]">
                      {pillar.name}
                    </Text>
                    <Text
                      className="block text-lg font-serif"
                      style={{ color: ELEMENT_COLORS[pillar.stemElement] }}
                    >
                      {pillar.stem}
                    </Text>
                    <Text
                      className="block text-lg font-serif"
                      style={{ color: ELEMENT_COLORS[pillar.branchElement] }}
                    >
                      {pillar.branch}
                    </Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Favorable Element */}
          <Card className="bg-[#161b22] border-[#2a2a35]">
            <CardContent className="p-5">
              <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
                喜用神
              </Text>
              <View className="flex items-center gap-3">
                <View
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${elementColor}20`,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: elementColor,
                  }}
                >
                  <Text
                    className="block text-xl font-serif"
                    style={{ color: elementColor }}
                  >
                    {result.favorableElement}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="block text-[#f0ebe3] text-sm">
                    您的八字喜用神为「{result.favorableElement}」
                  </Text>
                  <Text className="block text-[#8b8680] text-xs mt-1">
                    今日穿搭宜采用{result.outfit.colors.join('、')}色系
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Outfit Recommendation */}
          <Card className="bg-[#161b22] border-[#2a2a35]">
            <CardContent className="p-5">
              <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
                穿搭推荐
              </Text>
              <Text className="block text-[#f0ebe3] text-sm mb-3">
                {result.outfit.description}
              </Text>
              <View className="flex flex-wrap gap-2">
                {result.outfit.colors.map((color) => (
                  <View
                    key={color}
                    className="px-3 py-1 rounded-full bg-[#1a1f28] border border-[#2a2a35]"
                  >
                    <Text className="text-xs text-[#f0ebe3]">{color}</Text>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Regenerate Button */}
          <View className="pb-8">
            <Button
              className="w-full bg-[#161b22] text-[#c9a96e] border border-[#c9a96e] py-3 rounded-lg"
              onClick={() => Taro.navigateBack({ delta: 2 })}
            >
              <Text className="text-[#c9a96e]">重新测算</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

export default ResultPage
