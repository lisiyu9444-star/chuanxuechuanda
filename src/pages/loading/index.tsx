import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Network } from '@/network'
import './index.css'

interface UserData {
  nickname: string
  gender: string
  birthDate: string
  birthTime: string
  location: string
  calendarType?: string
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
  const { showLoadingSteps } = features
  const apiCalledRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

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

  // Call backend API once
  useEffect(() => {
    if (!userData || apiCalledRef.current) return
    apiCalledRef.current = true

    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController()

    const callApi = async () => {
      try {
        const res = await Network.request({
          url: '/api/bazi/calculate',
          method: 'POST',
          timeout: 120000, // 120 秒超时，AI 生图需要较长时间
          signal: abortControllerRef.current?.signal,
          data: {
            nickname: userData.nickname,
            gender: userData.gender,
            birthDate: userData.birthDate,
            birthTime: userData.birthTime,
            location: userData.location,
            calendarType: userData.calendarType || 'solar',
          },
        })
        console.log('BaZi API response:', res.data)

        const result = res.data?.data
        if (result) {
          setProgressValue(100)
          Taro.setStorageSync('baziResult', result)
          Taro.redirectTo({ url: '/pages/result/index' })
        }
      } catch (error: any) {
        // 判断是否为取消操作
        if (error?.errMsg?.includes('abort') || error?.name === 'AbortError') {
          console.log('Request cancelled by user')
          return // 不显示错误提示
        }
        console.error('BaZi calculation failed:', error)
        Taro.showToast({ title: '推演失败，请重试', icon: 'none' })
        apiCalledRef.current = false
      }
    }

    callApi()
  }, [userData])

  // 页面隐藏时取消请求
  useDidHide(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      console.log('Loading page hidden, request cancelled')
    }
  })

  const genderText = userData?.gender === 'male' ? '男' : '女'
  // 基于时间的进度条，30 秒走完
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const progress = Math.min((elapsed / 30) * 100, 95) // 最多到 95%，留 5% 给完成
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
      <View className="flex flex-col items-center pt-10 pb-6">
        {/* Clean loading animation - bouncing dots */}
        <View className="flex items-center gap-2 mb-6">
          <View className="w-3 h-3 rounded-full bg-gray-500 animate-bounce-dot" style={{ animationDelay: '0ms' }} />
          <View className="w-3 h-3 rounded-full bg-gray-700 animate-bounce-dot" style={{ animationDelay: '150ms' }} />
          <View className="w-3 h-3 rounded-full bg-gray-700 animate-bounce-dot" style={{ animationDelay: '300ms' }} />
        </View>

        {/* Current Step Text */}
        <Text className="block text-base font-medium text-gray-900 mb-1">
          勾画中...
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
              <Text className="block text-sm font-medium text-black mb-3">
                个人信息
              </Text>
              <View className="flex flex-col gap-2">
                <View className="flex justify-between">
                  <Text className="text-gray-400 text-sm">昵称</Text>
                  <Text className="text-gray-700 text-sm">
                    {userData.nickname}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-400 text-sm">性别</Text>
                  <Text className="text-gray-700 text-sm">{genderText}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-400 text-sm">出生日期</Text>
                  <Text className="text-gray-700 text-sm">
                    {userData.birthDate}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-400 text-sm">出生时辰</Text>
                  <Text className="text-gray-700 text-sm">
                    {userData.birthTime}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-gray-400 text-sm">所在城市</Text>
                  <Text className="text-gray-700 text-sm">
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
