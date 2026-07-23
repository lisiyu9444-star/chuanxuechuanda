import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
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
}

const LOADING_STEPS = [
  '正在排列八字四柱...',
  '正在推演五行旺缺...',
  '正在分析喜用神...',
  '正在生成今日推荐穿搭...',
]

const LoadingPage = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [trustCount] = useState(128456 + Math.floor(Math.random() * 1000))
  const apiCalledRef = useRef(false)

  useDidShow(() => {
    const data = Taro.getStorageSync('userData')
    if (data) {
      setUserData(data)
    }
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

    const callApi = async () => {
      try {
        const res = await Network.request({
          url: '/api/bazi/calculate',
          method: 'POST',
          data: {
            nickname: userData.nickname,
            gender: userData.gender,
            birthDate: userData.birthDate,
            birthTime: userData.birthTime,
            location: userData.location,
          },
        })
        console.log('BaZi API response:', res.data)

        const result = res.data?.data
        if (result) {
          Taro.setStorageSync('baziResult', result)
          Taro.navigateTo({ url: '/pages/result/index' })
        }
      } catch (error) {
        console.error('BaZi calculation failed:', error)
        Taro.showToast({ title: '推演失败，请重试', icon: 'none' })
        apiCalledRef.current = false
      }
    }

    callApi()
  }, [userData])

  const genderText = userData?.gender === 'male' ? '男' : '女'
  const progressValue = ((currentStep + 1) / LOADING_STEPS.length) * 100

  return (
    <View className="min-h-full bg-white px-6 py-8 flex flex-col">
      {/* Animation Area */}
      <View className="flex flex-col items-center pt-10 pb-6">
        {/* Clean loading animation - bouncing dots */}
        <View className="flex items-center gap-2 mb-6">
          <View className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce-dot" style={{ animationDelay: '0ms' }} />
          <View className="w-3 h-3 rounded-full bg-indigo-400 animate-bounce-dot" style={{ animationDelay: '150ms' }} />
          <View className="w-3 h-3 rounded-full bg-purple-400 animate-bounce-dot" style={{ animationDelay: '300ms' }} />
        </View>

        {/* Current Step Text */}
        <Text className="block text-base font-medium text-gray-900 mb-1">
          {LOADING_STEPS[currentStep]}
        </Text>
        <Text className="block text-sm text-gray-400">
          推演中，请稍后...
        </Text>

        {/* Progress Bar */}
        <View className="w-full mt-5 px-4">
          <Progress value={progressValue} className="h-2 bg-gray-100" />
        </View>
      </View>

      {/* User Info Summary */}
      {userData && (
        <View className="mb-5">
          <Card className="bg-gray-50 border-gray-100">
            <CardContent className="p-4">
              <Text className="block text-sm font-medium text-indigo-500 mb-3">
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
      <View className="flex-1 flex flex-col justify-end pb-8">
        <View className="flex flex-col gap-3 mb-6">
          {LOADING_STEPS.map((step, index) => (
            <View key={step} className="flex items-center gap-3">
              <View
                className={`w-2 h-2 rounded-full ${
                  index <= currentStep
                    ? 'bg-indigo-500'
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
    </View>
  )
}

export default LoadingPage
