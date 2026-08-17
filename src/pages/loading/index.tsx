import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Network } from '@/network'
import { getArchiveById, saveDailyResult, type DailyResult } from '@/utils/archiveStorage'
import './index.css'

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
  const [archive, setArchive] = useState<{ nickname: string; gender: string; birthDate: string; birthTime: string; location: string } | null>(null)
  const [trustCount] = useState(128456 + Math.floor(Math.random() * 1000))
  const [isAccelerated, setIsAccelerated] = useState(false)
  const requestedRef = useRef(false)

  const loadData = async (archiveId: string) => {
    if (requestedRef.current) return
    requestedRef.current = true

    try {
      const currentArchive = getArchiveById(archiveId)
      if (!currentArchive) {
        Taro.showToast({ title: '档案不存在', icon: 'none' })
        setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
        return
      }

      setArchive(currentArchive)

      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      console.log('[Loading] request daily:', { archiveId, date: dateStr })
      const res = await Network.request({
        url: '/api/bazi/daily',
        method: 'POST',
        data: {
          nickname: currentArchive.nickname,
          gender: currentArchive.gender,
          birthDate: currentArchive.birthDate,
          birthTime: currentArchive.birthTime,
          location: currentArchive.location,
          calendarType: currentArchive.calendarType,
          age: currentArchive.age,
          stylePreference: currentArchive.stylePreference,
        },
        timeout: 120000,
      })
      console.log('[Loading] daily response:', res.data)

      const apiData = res.data?.data
      if (!apiData) {
        throw new Error('返回数据为空')
      }

      const dailyResult: DailyResult = {
        ...apiData,
        archiveId,
        date: dateStr,
        dailyYongShen: apiData.baziResult?.dailyYongShen || apiData.baziResult?.favorableElement || '',
        dailyXiShen: apiData.baziResult?.dailyXiShen || apiData.baziResult?.favorableAnalysis?.assistantXiShen || '',
        ganZhiDate: apiData.baziResult?.ganZhiDate,
        generatedAt: Date.now(),
      }
      saveDailyResult(dailyResult)
      setProgressValue(100)
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (error) {
      console.error('[Loading] daily request failed:', error)
      Taro.showToast({ title: '推演失败，请重试', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
    }
  }

  useDidShow(() => {
    const params = Taro.getCurrentInstance().router?.params
    const archiveId = params?.archiveId
    if (archiveId) {
      loadData(archiveId as string)
    } else {
      Taro.showToast({ title: '缺少档案信息', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
    }

    const timer = setTimeout(() => {
      setIsAccelerated(true)
    }, 25000)
    return () => clearTimeout(timer)
  })

  useEffect(() => {
    if (currentStep < LOADING_STEPS.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [currentStep])

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const progress = Math.min((elapsed / 30) * 100, 95)
      setProgressValue(progress)
    }, 100)
    return () => clearInterval(timer)
  }, [])

  const genderText = archive?.gender === 'male' ? '男' : archive?.gender === 'female' ? '女' : archive?.gender || ''

  return (
    <View className="min-h-full bg-white px-6 py-8 flex flex-col">
      {/* Animation Area */}
      <View className="flex flex-col items-center pt-8 pb-6">
        {/* 五行流动动画 */}
        <View className={`wuxing-orbit-container mb-6 ${isAccelerated ? 'wuxing-speedup' : ''}`}>
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

        {/* Progress Bar */}
        <View className="w-full mt-5 px-4">
          <Progress value={progressValue} className="h-2" style={{ '--primary': '#1F2937', '--secondary': '#E5E7EB' } as React.CSSProperties} />
        </View>
      </View>

      {/* User Info Summary */}
      {archive && (
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
                    {archive.nickname}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">性别</Text>
                  <Text className="text-sm text-gray-900">{genderText}</Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">出生日期</Text>
                  <Text className="text-sm text-gray-900">
                    {archive.birthDate}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">出生时辰</Text>
                  <Text className="text-sm text-gray-900">
                    {archive.birthTime}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">所在城市</Text>
                  <Text className="text-sm text-gray-900">
                    {archive.location}
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
    </View>
  )
}

export default LoadingPage
