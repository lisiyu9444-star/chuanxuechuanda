import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  '正在生成专属穿搭...',
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

  return (
    <View className="min-h-full bg-[#0d1117] px-6 py-8 flex flex-col">
      {/* Animation Area */}
      <View className="flex flex-col items-center pt-12 pb-8">
        {/* Spinning Bagua */}
        <View className="w-28 h-28 rounded-full border border-[#c9a96e] flex items-center justify-center mb-6 animate-spin-slow">
          <View className="w-20 h-20 rounded-full border border-[#c9a96e]/40 flex items-center justify-center">
            <Text className="text-3xl text-[#c9a96e] font-serif">卦</Text>
          </View>
        </View>

        {/* Current Step Text */}
        <Text className="block text-lg text-[#c9a96e] font-serif mb-2 animate-pulse-gold">
          {LOADING_STEPS[currentStep]}
        </Text>
        <Text className="block text-sm text-[#8b8680]">
          天机推演中，请稍候...
        </Text>
      </View>

      {/* User Info Summary */}
      {userData && (
        <View className="mb-6">
          <Card className="bg-[#161b22] border-[#2a2a35]">
            <CardContent className="p-5">
              <Text className="block text-sm text-[#c9a96e] mb-4 font-serif">
                命主信息
              </Text>
              <View className="flex flex-col gap-3">
                <View className="flex justify-between">
                  <Text className="text-[#8b8680] text-sm">昵称</Text>
                  <Text className="text-[#f0ebe3] text-sm">
                    {userData.nickname}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-[#8b8680] text-sm">性别</Text>
                  <Text className="text-[#f0ebe3] text-sm">{genderText}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-[#8b8680] text-sm">出生日期</Text>
                  <Text className="text-[#f0ebe3] text-sm">
                    {userData.birthDate}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-[#8b8680] text-sm">出生时辰</Text>
                  <Text className="text-[#f0ebe3] text-sm">
                    {userData.birthTime}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-[#8b8680] text-sm">所在城市</Text>
                  <Text className="text-[#f0ebe3] text-sm">
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
        <View className="flex flex-col gap-3 mb-8">
          {LOADING_STEPS.map((step, index) => (
            <View key={step} className="flex items-center gap-3">
              <View
                className={`w-2 h-2 rounded-full ${
                  index <= currentStep
                    ? 'bg-[#c9a96e]'
                    : 'bg-[#2a2a35]'
                }`}
              />
              <Text
                className={`text-sm ${
                  index <= currentStep
                    ? 'text-[#f0ebe3]'
                    : 'text-[#8b8680]'
                }`}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* Trust Indicator */}
        <View className="flex justify-center">
          <Text className="text-xs text-[#8b8680]">
            已有 {trustCount.toLocaleString()} 人完成测算
          </Text>
        </View>
      </View>
    </View>
  )
}

export default LoadingPage
