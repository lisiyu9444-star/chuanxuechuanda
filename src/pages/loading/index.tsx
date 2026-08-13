import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Network } from '@/network'
import { useLoadingTask } from '@/hooks/useLoadingTask'
import './index.css'

interface UserData {
  nickname: string
  gender: string
  birthDate: string
  birthTime: string
  location: string
  calendarType?: string
}

interface BaZiResult {
  nickname: string
  gender: string
  dayMaster: string
  dayMasterElement: string
  fourPillars: any[]
  fiveElements: any[]
  favorableElement: string
  favorableAnalysis: any
  outfit: any
  imageUrl: string
  ganZhiDate?: { month: string; day: string }
  dailyYongShen?: string
  dailyXiShen?: string
}

interface HistoryRecord extends BaZiResult {
  id: string
  birthDate: string
  birthTime: string
  city: string
  tryOnUrl: string
  createdAt: number
}

const LOADING_STEPS = [
  '正在排列四柱...',
  '正在推演旺缺...',
  '正在分析喜用神...',
  '正在生成今日推荐穿搭...',
]

const LoadingPage = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [progressValue, setProgressValue] = useState(0)
  const startTimeRef = useRef(Date.now())
  const [userData, setUserData] = useState<UserData | null>(null)
  const [trustCount] = useState(128456 + Math.floor(Math.random() * 1000))
  const [showTimeout, setShowTimeout] = useState(false)
  const [timeoutDismissed, setTimeoutDismissed] = useState(false)
  const [features, setFeatures] = useState({ showLoadingSteps: true })

  const saveHistoryRecord = (data: BaZiResult) => {
    try {
      const raw = Taro.getStorageSync('outfit_history')
      const records = Array.isArray(raw) ? (raw as HistoryRecord[]) : []
      const storedUserData = Taro.getStorageSync('userData')
      const newRecord: HistoryRecord = {
        ...data,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        birthDate: storedUserData?.birthDate || '',
        birthTime: storedUserData?.birthTime || '',
        city: storedUserData?.location || '',
        tryOnUrl: '',
        createdAt: Date.now(),
      }
      const filtered = records.filter(
        (item) => Date.now() - item.createdAt < 30 * 24 * 60 * 60 * 1000
      )
      const updated = [newRecord, ...filtered].slice(0, 100)
      Taro.setStorageSync('outfit_history', updated)
      console.log('[saveHistoryRecord] saved, count:', updated.length, 'newId:', newRecord.id)
    } catch (e) {
      console.error('[saveHistoryRecord] failed:', e)
      Taro.showToast({ title: '历史记录保存失败', icon: 'none' })
    }
  }

  const { showLoadingSteps } = features

  // 使用通用 loading task hook
  useLoadingTask<UserData, BaZiResult>({
    url: '/api/bazi/calculate',
    method: 'POST',
    params: userData || undefined,
    timeout: 120000,
    autoExecute: true, // userData 准备好后自动执行
    onSuccess: (data) => {
      console.log('BaZi calculation success:', data)
      saveHistoryRecord(data)
      setProgressValue(100)
      Taro.setStorageSync('baziResult', data)
      Taro.redirectTo({ url: '/pages/result/index' })
    },
    onError: (error) => {
      console.error('BaZi calculation failed:', error)
      Taro.showToast({ title: '推演失败，请重试', icon: 'none' })
    },
  })

  useDidShow(() => {
    const data = Taro.getStorageSync('userData')
    if (data) {
      setUserData(data)
    }

    // 获取功能开关配置
    const loadFeatures = async () => {
      try {
        const res = await Network.request({
          url: '/api/config/features',
          method: 'GET',
        })
        console.log('Features config:', res.data)
        if (res.data?.data?.features) {
          setFeatures(res.data.data.features)
        }
      } catch (error) {
        console.error('Failed to load features:', error)
      }
    }
    loadFeatures()

    // 7秒超时提示
    const timer = setTimeout(() => {
      setShowTimeout(true)
    }, 7000)
    return () => clearTimeout(timer)
  })

  // Step animation
  useEffect(() => {
    if (currentStep < LOADING_STEPS.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [currentStep])

  const genderText = userData?.gender === 'male' ? '男' : '女'
  
  // 基于时间的进度条，30 秒走完
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const progress = Math.min((elapsed / 30) * 100, 95)
      setProgressValue(progress)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return (
    <View className="min-h-full bg-white px-6 py-8 flex flex-col">
      {/* 超时提示 - 预留空间 + 淡入 */}
      <View
        className={`flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 transition-all duration-500 ${
          showTimeout && !timeoutDismissed ? 'opacity-100 mb-4' : 'opacity-0 mb-0 h-0 overflow-hidden'
        }`}
      >
        <Text className="text-sm text-gray-700 flex-1">
          绘图需要时间啦，约30s左右
        </Text>
        <View
          className="ml-3 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100"
          onClick={() => setTimeoutDismissed(true)}
        >
          <Text className="text-gray-500 text-xs font-bold">✕</Text>
        </View>
      </View>

      {/* Animation Area */}
      <View className="flex flex-col items-center pt-8 pb-6">
        {/* 五行流动动画 */}
        <View className="wuxing-orbit-container mb-6">
          <View className="wuxing-orbit-ring" />
          <View className="wuxing-core-ring" />
          <View className="wuxing-core" />
          <View className="wuxing-dot wuxing-dot-wood" />
          <View className="wuxing-dot wuxing-dot-fire" />
          <View className="wuxing-dot wuxing-dot-earth" />
          <View className="wuxing-dot wuxing-dot-metal" />
          <View className="wuxing-dot wuxing-dot-water" />
        </View>

        {/* Current Step Text */}
        <Text className="block text-base font-medium text-gray-900 mb-1">
          勾画中...
        </Text>
        <Text className="block text-sm text-gray-500">
          {LOADING_STEPS[currentStep]}
        </Text>

        {/* Progress Bar */}
        <View className="w-full mt-5 px-4">
          <Progress value={progressValue} className="h-2" style={{ "--primary": "#1F2937", "--secondary": "#E5E7EB" } as React.CSSProperties} />
        </View>
      </View>

      {/* User Info Summary */}
      {userData && (
        <View className="mb-5">
          <Card className="bg-gray-50 border-gray-100">
            <CardContent className="p-4">
              <Text className="block text-base font-semibold text-black mb-3">
                个人信息
              </Text>
              <View className="flex flex-col gap-3">
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">昵称</Text>
                  <Text className="text-sm text-gray-900">
                    {userData.nickname}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">性别</Text>
                  <Text className="text-sm text-gray-900">{genderText}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">出生日期</Text>
                  <Text className="text-sm text-gray-900">
                    {userData.birthDate}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">出生时辰</Text>
                  <Text className="text-sm text-gray-900">
                    {userData.birthTime}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">所在城市</Text>
                  <Text className="text-sm text-gray-900">
                    {userData.location}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* Progress Steps */}
      {showLoadingSteps && (
        <View className="flex-1 flex flex-col justify-end pb-8">
          <View className="flex flex-col gap-3 mb-6">
            {LOADING_STEPS.map((step, index) => (
              <View key={step} className="flex items-center gap-3">
                <View
                  className={`w-2 h-2 rounded-full ${
                    index <= currentStep
                      ? 'bg-gray-500'
                      : 'bg-gray-200'
                  }`}
                />
                <Text
                  className={`text-sm ${
                    index <= currentStep
                      ? 'text-gray-700 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>

          {/* Trust Indicator */}
          <View className="flex justify-center">
            <Text className="text-xs text-gray-400">
              已有 {trustCount.toLocaleString()} 人完成测算
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default LoadingPage
