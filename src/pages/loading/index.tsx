import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { Network } from '@/network'
import { getArchiveById, saveDailyResult, type DailyResult, type Archive } from '@/utils/archiveStorage'

import { Button } from '@/components/ui/button'

const STEPS = [
  '正在排列四柱...',
  '正在推演旺缺...',
  '正在分析喜用神...',
  '正在生成今日推荐穿搭...',
]

function formatBirthTime(time: string) {
  const hourMap: Record<string, string> = {
    '00:00': '子时 (00:00-01:00)', '01:00': '丑时 (01:00-03:00)', '03:00': '寅时 (03:00-05:00)',
    '05:00': '卯时 (05:00-07:00)', '07:00': '辰时 (07:00-09:00)', '09:00': '巳时 (09:00-11:00)',
    '11:00': '午时 (11:00-13:00)', '13:00': '未时 (13:00-15:00)', '15:00': '申时 (15:00-17:00)',
    '17:00': '酉时 (17:00-19:00)', '19:00': '戌时 (19:00-21:00)', '21:00': '亥时 (21:00-23:00)',
    '23:00': '子时 (23:00-00:00)',
  }
  return hourMap[time] || time
}

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function LoadingPage() {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [archive, setArchive] = useState<Archive | null>(null)
  const [error, setError] = useState(false)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const requestStartedRef = useRef(false)

  useDidShow(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const mode = (params.mode as string) || 'daily'
    const archiveId = params.archiveId as string
    const today = getTodayStr()

    if (!archiveId) {
      Taro.showToast({ title: '缺少档案信息', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }

    const currentArchive = getArchiveById(archiveId)
    if (!currentArchive) {
      Taro.showToast({ title: '档案不存在', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    setArchive(currentArchive)

    if (mode === 'daily') {
      const cached = saveDailyResult.name ? null : null
      void cached
      loadData(currentArchive, today)
    } else {
      Taro.redirectTo({ url: '/pages/index/index' })
    }
  })

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
    }
  }, [])

  const startProgressAnimation = () => {
    setProgress(0)
    setCurrentStep(0)
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        const next = prev + Math.random() * 8 + 2
        if (next >= 100) return 95
        return next
      })
    }, 600)
  }

  const loadData = async (currentArchive: Archive, today: string) => {
    if (requestStartedRef.current) return
    requestStartedRef.current = true
    setError(false)
    startProgressAnimation()

    try {
      const res = await Network.request({
        url: '/api/bazi/daily',
        method: 'POST',
        data: {
          nickname: currentArchive.nickname,
          gender: currentArchive.gender,
          birthDate: currentArchive.birthDate,
          birthTime: currentArchive.birthTime,
          location: currentArchive.location,
          age: currentArchive.age,
          stylePreference: currentArchive.stylePreference,
        },
      })
      console.log('[Loading] daily response:', res.data)

      const data = res.data?.data
      if (!data) {
        throw new Error('返回数据为空')
      }

      const dailyResult: DailyResult = {
        date: today,
        archiveId: currentArchive.id,
        baziResult: data.baziResult,
        llmPlan: data.llmPlan,
        luckyScore: data.luckyScore,
        ganZhiDate: data.ganZhiDate,
        dailyYongShen: data.dailyYongShen,
        dailyXiShen: data.dailyXiShen,
        generatedAt: Date.now(),
      }
      saveDailyResult(dailyResult)

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
      setProgress(100)
      setCurrentStep(STEPS.length - 1)

      setTimeout(() => {
        Taro.setStorageSync('currentArchiveId', currentArchive.id)
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 500)
    } catch (err) {
      console.error('[Loading] 请求失败:', err)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
      }
      setError(true)
      Taro.showModal({
        title: '生成失败',
        content: '今日穿搭生成失败，是否重试？',
        showCancel: true,
        confirmText: '重试',
        cancelText: '返回首页',
        success: (modalRes) => {
          if (modalRes.confirm) {
            requestStartedRef.current = false
            void loadData(currentArchive, today)
          } else {
            Taro.redirectTo({ url: '/pages/index/index' })
          }
        },
      })
    }
  }

  useEffect(() => {
    const stepIndex = Math.min(Math.floor((progress / 100) * STEPS.length), STEPS.length - 1)
    setCurrentStep(stepIndex)
  }, [progress])

  return (
    <ScrollView scrollY className="min-h-screen bg-white">
      <View className="flex flex-col items-center px-6 pt-16 pb-10">
        {/* 动画区域 */}
        <View className="relative w-32 h-32 mb-6">
          <View className="absolute inset-0 flex items-center justify-center">
            <View
              className="w-20 h-20 rounded-full"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #c4b5fd, #8b5cf6)',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.35)',
              }}
            />
          </View>
          <View className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-400" />
          <View className="absolute top-4 right-4 w-3 h-3 rounded-full bg-green-400" />
          <View className="absolute bottom-8 right-2 w-3 h-3 rounded-full bg-yellow-400" />
          <View className="absolute bottom-6 left-4 w-3 h-3 rounded-full bg-blue-400" />
          <View className="absolute top-1/2 left-2 w-2 h-2 rounded-full bg-orange-400" />
        </View>

        {/* 标题 */}
        <Text className="block text-xl font-semibold text-gray-900 mb-4">勾画中...</Text>

        {/* 进度条 */}
        <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-10">
          <View
            className="h-full bg-gray-900 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </View>

        {/* 个人信息卡片 */}
        {archive && (
          <View className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-8">
            <Text className="block text-lg font-semibold text-gray-900 mb-4">个人信息</Text>
            <View className="flex flex-row justify-between items-center mb-3">
              <Text className="block text-sm text-gray-500">昵称</Text>
              <Text className="block text-sm text-gray-900">{archive.nickname}</Text>
            </View>
            <View className="flex flex-row justify-between items-center mb-3">
              <Text className="block text-sm text-gray-500">性别</Text>
              <Text className="block text-sm text-gray-900">{archive.gender === 'male' ? '男' : '女'}</Text>
            </View>
            <View className="flex flex-row justify-between items-center mb-3">
              <Text className="block text-sm text-gray-500">出生日期</Text>
              <Text className="block text-sm text-gray-900">{archive.birthDate}</Text>
            </View>
            <View className="flex flex-row justify-between items-center mb-3">
              <Text className="block text-sm text-gray-500">出生时辰</Text>
              <Text className="block text-sm text-gray-900">{formatBirthTime(archive.birthTime)}</Text>
            </View>
            <View className="flex flex-row justify-between items-center">
              <Text className="block text-sm text-gray-500">所在城市</Text>
              <Text className="block text-sm text-gray-900">{archive.location}</Text>
            </View>
          </View>
        )}

        {/* 步骤列表 */}
        <View className="w-full mb-6">
          {STEPS.map((step, index) => (
            <View key={step} className="flex flex-row items-center mb-4">
              <View
                className={`w-2 h-2 rounded-full mr-3 ${
                  index <= currentStep ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              />
              <Text
                className={`block text-base ${
                  index <= currentStep ? 'text-gray-900 font-medium' : 'text-gray-400'
                }`}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* 统计 */}
        <Text className="block text-sm text-gray-400 mt-2">已有 128,735 人完成测算</Text>
      </View>

      {error && (
        <View className="px-6 pb-10">
          <Button
            className="w-full bg-gray-900 text-white rounded-xl h-12"
            onClick={() => {
              if (archive) {
                requestStartedRef.current = false
                void loadData(archive, getTodayStr())
              }
            }}
          >
            <Text className="block text-white">重新生成</Text>
          </Button>
        </View>
      )}
    </ScrollView>
  )
}
