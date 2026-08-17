import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'

import { Sparkles } from 'lucide-react-taro'
import { Network } from '@/network'
import {
  getArchiveById,
  saveDailyResult,
  saveNativeResult,
  type DailyResult,
} from '@/utils/archiveStorage'
import './index.css'

const LOADING_STEPS = [
  '正在排列四柱...',
  '正在推演旺缺...',
  '正在分析喜用神...',
  '正在生成今日推荐穿搭...',
  '正在测算今日幸运指数...',
]

const LoadingPage = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [progressValue, setProgressValue] = useState(0)
  const startTimeRef = useRef(Date.now())
  const [trustCount] = useState(128456 + Math.floor(Math.random() * 1000))

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const max = 120000
      const nextValue = Math.min((elapsed / max) * 100, 95)
      setProgressValue(nextValue)
      const stepIndex = Math.min(
        Math.floor((elapsed / max) * LOADING_STEPS.length),
        LOADING_STEPS.length - 1,
      )
      setCurrentStep(stepIndex)
    }, 500)
    return () => clearInterval(timer)
  }, [])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const archiveId = instance?.router?.params?.archiveId as string | undefined
    const mode = (instance?.router?.params?.mode as string | undefined) || 'daily'

    if (!archiveId) {
      Taro.showToast({ title: '缺少档案信息', icon: 'none' })
      setTimeout(() => Taro.redirectTo({ url: '/pages/index/index' }), 1500)
      return
    }

    loadData(archiveId, mode)
  })

  const loadData = async (archiveId: string, mode: string) => {
    try {
      const archive = await getArchiveById(archiveId)
      if (!archive) {
        Taro.showToast({ title: '档案不存在', icon: 'none' })
        setTimeout(() => Taro.redirectTo({ url: '/pages/index/index' }), 1500)
        return
      }

      const payload = {
        nickname: archive.nickname,
        gender: archive.gender,
        birthDate: archive.birthDate,
        birthTime: archive.birthTime,
        location: archive.location,
        calendarType: archive.calendarType,
        age: archive.age,
        stylePreference: archive.stylePreference,
      }

      const today = new Date().toISOString().split('T')[0]

      if (mode === 'native') {
        const res = await Network.request({
          url: '/api/bazi/native',
          method: 'POST',
          data: payload,
        })
        console.log('[Loading] native response:', res.data)
        const data = res.data?.data
        await saveNativeResult({
          archiveId,
          baziResult: data.baziResult,
          llmPlan: data.llmPlan,
          generatedAt: Date.now(),
        })
      } else {
        const res = await Network.request({
          url: '/api/bazi/daily',
          method: 'POST',
          data: payload,
        })
        console.log('[Loading] daily response:', res.data)
        const data = res.data?.data
        const dailyResult: DailyResult = {
          date: today,
          archiveId,
          baziResult: data.baziResult,
          llmPlan: data.llmPlan,
          luckyScore: data.luckyScore,
          ganZhiDate: data.ganZhiDate,
          dailyYongShen: data.dailyYongShen,
          dailyXiShen: data.dailyXiShen,
          generatedAt: Date.now(),
        }
        await saveDailyResult(dailyResult)
      }

      setProgressValue(100)
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 500)
    } catch (error) {
      console.error('[Loading] loadData failed:', error)
      Taro.showModal({
        title: '加载失败',
        content: '今日内容生成失败，是否重试？',
        showCancel: false,
        confirmText: '重试',
        success: () => {
          loadData(archiveId, mode)
        },
      })
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <View className="w-full max-w-sm">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-8">
            <View className="flex flex-col items-center gap-6">
              <View className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF8E7' }}>
                <Sparkles size={40} color="#F5A623" />
              </View>

              <View className="text-center">
                <Text className="block text-xl font-bold text-gray-900 mb-2">
                  {LOADING_STEPS[currentStep]}
                </Text>
                <Text className="block text-sm text-gray-500">
                  已帮助 {trustCount.toLocaleString()} 位用户生成今日穿搭
                </Text>
              </View>

              <View className="w-full">
                <View className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F0FF' }}>
                  <View
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressValue}%`,
                      backgroundColor: '#8B5CF6',
                    }}
                  />
                </View>
                <Text className="block text-xs text-gray-400 text-center mt-2">
                  {Math.round(progressValue)}%
                </Text>
              </View>

              <View className="w-full rounded-xl p-4" style={{ backgroundColor: '#FFF9F0' }}>
                <Text className="block text-sm text-center leading-relaxed" style={{ color: '#B45309' }}>
                  传统文化与现代穿搭的结合，正在为你编织今日的幸运色彩...
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    </View>
  )
}

export default LoadingPage
