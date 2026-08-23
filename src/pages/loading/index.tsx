import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useUnload } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CloudOff, RefreshCw } from 'lucide-react-taro'
import { WuxingLoader } from '@/components/wuxing-loader'
import { Network } from '@/network'
import { getArchiveById, getDailyResult, getNativeResult, saveDailyResult, saveNativeResult, getToday, markDailyGenerateFailed, clearDailyGenerateFailed, type DailyResult, type NativeResult } from '@/utils/archiveStorage'
import { buildHistoryRecord, saveHistoryFromDailyResult, saveHistoryFromNativeResult } from '@/utils/historyStorage'
import { syncArchiveToServer, syncHistoryToServer } from '@/utils/serverSync'
import { SHOW_METAPHYSICS } from '@/utils/channel'

const getLoadingSteps = (mode: 'daily' | 'native') => [
  '正在排列四柱...',
  '正在推演旺缺...',
  '正在分析喜用神...',
  mode === 'native' ? '正在生成本命穿搭方案...' : '正在生成今日推荐穿搭...',
]

const LoadingPage = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [progressValue, setProgressValue] = useState(0)
  const startTimeRef = useRef(Date.now())
  const [archive, setArchive] = useState<{ nickname: string; gender: string; birthDate: string; birthTime: string; location: string; stylePreference?: string } | null>(null)
  const [trustCount] = useState(128456 + Math.floor(Math.random() * 1000))
  const [isAccelerated, setIsAccelerated] = useState(false)
  const [mode, setMode] = useState<'daily' | 'native'>('daily')
  const requestedRef = useRef(false)
  // 请求任务与取消标记：退出页面时中断请求，阻止后续保存与跳转
  const requestTaskRef = useRef<{ abort?: () => void } | null>(null)
  const cancelledRef = useRef(false)
  // 当前请求的客户端任务 ID，退出页面时通知后端真实中断 LLM/生图请求
  const clientTaskIdRef = useRef('')
  // 请求序号：useDidShow 重复触发时 abort 旧请求，旧请求的响应/失败回调据此识别自身已过期，静默丢弃
  const requestSeqRef = useRef(0)
  // 最近一次请求参数：失败界面「重新生成」按钮据此重发
  const lastRequestRef = useRef<{ archiveId: string; pageMode: 'daily' | 'native'; action: string } | null>(null)
  // 25 秒加速动画计时器（Taro 的 useDidShow 回调返回值不会被当作 cleanup 调用，必须用 ref 手动管理）
  const accelerateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 请求失败标记：true 时本页展示失败界面（重试/返回），不再自动跳回首页（避免与首页自动跳转形成死循环）
  const [requestFailed, setRequestFailed] = useState(false)

  const notifyBackendCancel = () => {
    const taskId = clientTaskIdRef.current
    if (!taskId) return
    clientTaskIdRef.current = ''
    Network.request({
      url: '/api/bazi/cancel',
      method: 'POST',
      data: { taskId },
      timeout: 5000,
    }).catch((e) => console.warn('[Loading] cancel notify failed:', e))
  }
  const fromRef = useRef<string>('')
  const loadingSteps = getLoadingSteps(mode)

  const loadData = async (archiveId: string, pageMode: 'daily' | 'native' = 'daily') => {
    if (requestedRef.current) return
    requestedRef.current = true
    const seq = ++requestSeqRef.current

    try {
      const currentArchive = getArchiveById(archiveId)
      if (!currentArchive) {
        Taro.showToast({ title: '档案不存在', icon: 'none' })
        setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
        return
      }

      setArchive(currentArchive)

      const dateStr = getToday()
      const endpoint = pageMode === 'native' ? '/api/bazi/native' : '/api/bazi/daily'
      clientTaskIdRef.current = `${pageMode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      console.log(`[Loading] request ${pageMode}:`, { archiveId, date: dateStr, endpoint, taskId: clientTaskIdRef.current })
      const task = Network.request({
        url: endpoint,
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
          clientTaskId: clientTaskIdRef.current,
          // 透传档案 id：后端计算完成后自动保存 bazi_records（幂等键 `${archiveId}_${date}` / `${archiveId}_native`）
          archiveId,
        },
        timeout: 120000,
      })
      requestTaskRef.current = task as unknown as { abort?: () => void }
      const res = await task
      requestTaskRef.current = null
      clientTaskIdRef.current = ''
      // 页面已退出，或请求已被新一轮 useDidShow 取代，忽略结果
      if (cancelledRef.current || seq !== requestSeqRef.current) return
      console.log(`[Loading] ${pageMode} response:`, res.data)

      const apiData = res.data?.data
      if (!apiData) {
        throw new Error('返回数据为空')
      }

      if (pageMode === 'native') {
        const nativeResult: NativeResult = {
          archiveId,
          baziResult: apiData.baziResult,
          llmPlan: apiData.llmPlan,
          generatedAt: Date.now(),
        }
        saveNativeResult(nativeResult)
        // 本命穿搭也生成历史记录，与今日穿搭独立存储
        saveHistoryFromNativeResult(nativeResult, currentArchive)
        // 服务端历史记录由 native 接口自动保存（幂等键一致），此处仅档案兜底同步
        syncArchiveToServer(currentArchive)
        setProgressValue(100)
        if (fromRef.current === 'result') {
          // 从结果页“再测一次”进入，返回原结果页展示新数据
          Taro.navigateBack()
        } else {
          Taro.redirectTo({ url: `/pages/result/index?mode=native&archiveId=${archiveId}` })
        }
        return
      }

      const dailyResult: DailyResult = {
        ...apiData,
        archiveId,
        date: dateStr,
        dailyYongShen: apiData.baziResult?.dailyYongShen || apiData.baziResult?.favorableElement || '',
        dailyXiShen: apiData.baziResult?.dailyXiShen || apiData.baziResult?.favorableAnalysis?.assistantXiShen || '',
        ganZhiDate: apiData.baziResult?.ganZhiDate,
        // 顶层冗余一份平铺图 URL 与 key，便于结果页/历史记录直接读取与换签
        imageUrl: apiData.baziResult?.imageUrl || undefined,
        imageKey: apiData.baziResult?.imageKey || undefined,
        generatedAt: Date.now(),
      }
      saveDailyResult(dailyResult)
      // 本地历史记录由结果页统一保存（含图片补丁合并）；
      // 服务端历史记录由 daily 接口自动保存（幂等键一致），此处仅档案兜底同步
      syncArchiveToServer(currentArchive)
      clearDailyGenerateFailed(archiveId, dateStr)
      setProgressValue(100)
      if (fromRef.current === 'result') {
        // 从结果页“再测一次”进入，返回原结果页展示新数据
        Taro.navigateBack()
      } else {
        Taro.switchTab({ url: '/pages/index/index' })
      }
    } catch (error) {
      // 页面已退出、被主动取消或请求已被新一轮取代，静默处理
      if (cancelledRef.current || seq !== requestSeqRef.current) return
      // 请求已终结，清理残留引用，避免退出页面时误判为"进行中"而重复写标记/发无效 cancel
      requestTaskRef.current = null
      clientTaskIdRef.current = ''
      console.error(`[Loading] ${pageMode} request failed:`, error)
      // 失败停留本页展示重试入口，不再自动回首页：首页 onShow 会自动跳回 loading，直接返回会形成死循环。
      // daily 自动场景写冷却标记，首页据此暂停自动跳转，把主动权交还用户。
      if (pageMode === 'daily') markDailyGenerateFailed(archiveId)
      setRequestFailed(true)
    }
  }

  // 再测一次：仅重新生成穿搭方案，喜用神/幸运指数沿用缓存，已生成图片作废清空
  const redesignData = async (archiveId: string, pageMode: 'daily' | 'native') => {
    if (requestedRef.current) return
    requestedRef.current = true
    const seq = ++requestSeqRef.current

    try {
      const currentArchive = getArchiveById(archiveId)
      if (!currentArchive) {
        Taro.showToast({ title: '档案不存在', icon: 'none' })
        setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
        return
      }
      setArchive(currentArchive)

      const cached = pageMode === 'native' ? getNativeResult(archiveId) : getDailyResult(archiveId, getToday())
      if (!cached || !cached.baziResult) {
        // 无缓存可沿用，回退到完整生成流程
        requestedRef.current = false
        return loadData(archiveId, pageMode)
      }

      const bazi = cached.baziResult
      const yongShen = pageMode === 'native'
        ? bazi.favorableElement
        : ((cached as DailyResult).dailyYongShen || bazi.dailyYongShen || bazi.favorableElement || '')
      const xiShen = pageMode === 'native'
        ? (bazi.favorableAnalysis?.assistantXiShen || '')
        : ((cached as DailyResult).dailyXiShen || bazi.dailyXiShen || bazi.favorableAnalysis?.assistantXiShen || '')

      clientTaskIdRef.current = `redesign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      console.log(`[Loading] redesign ${pageMode}:`, { archiveId, yongShen, xiShen, taskId: clientTaskIdRef.current })
      const task = Network.request({
        url: '/api/bazi/redesign',
        method: 'POST',
        data: {
          mode: pageMode,
          gender: currentArchive.gender,
          age: currentArchive.age,
          stylePreference: currentArchive.stylePreference,
          season: bazi.outfit?.season || '',
          yongShen,
          xiShen,
          dayMaster: bazi.dayMaster,
          clientTaskId: clientTaskIdRef.current,
        },
        timeout: 120000,
      })
      requestTaskRef.current = task as unknown as { abort?: () => void }
      const res = await task
      requestTaskRef.current = null
      clientTaskIdRef.current = ''
      if (cancelledRef.current || seq !== requestSeqRef.current) return
      console.log('[Loading] redesign response:', res.data)

      const llmPlan = res.data?.data?.llmPlan
      if (!llmPlan) {
        throw new Error('返回数据为空')
      }

      if (pageMode === 'native') {
        const newNative: NativeResult = {
          ...(cached as NativeResult),
          llmPlan,
          imageUrl: '',
          tryOnUrl: '',
          imageKey: '',
          tryOnKey: '',
          baziResult: {
            ...(cached as NativeResult).baziResult,
            imageUrl: '',
            imageKey: '',
          },
          generatedAt: Date.now(),
        }
        saveNativeResult(newNative)
        saveHistoryFromNativeResult(newNative, currentArchive)
        syncArchiveToServer(currentArchive)
        syncHistoryToServer(buildHistoryRecord(newNative, currentArchive, 'native'))
      } else {
        const newDaily: DailyResult = {
          ...(cached as DailyResult),
          llmPlan,
          imageUrl: '',
          tryOnUrl: '',
          imageKey: '',
          tryOnKey: '',
          baziResult: {
            ...(cached as DailyResult).baziResult,
            imageUrl: '',
            imageKey: '',
          },
          generatedAt: Date.now(),
        }
        saveDailyResult(newDaily)
        saveHistoryFromDailyResult(newDaily, currentArchive)
        syncArchiveToServer(currentArchive)
        syncHistoryToServer(buildHistoryRecord(newDaily, currentArchive, 'daily'))
      }

      setProgressValue(100)
      if (cancelledRef.current || seq !== requestSeqRef.current) return
      if (fromRef.current === 'result') {
        Taro.navigateBack()
      } else if (pageMode === 'native') {
        Taro.redirectTo({ url: `/pages/result/index?mode=native&archiveId=${archiveId}` })
      } else {
        Taro.switchTab({ url: '/pages/index/index' })
      }
    } catch (error) {
      if (cancelledRef.current || seq !== requestSeqRef.current) return
      requestTaskRef.current = null
      clientTaskIdRef.current = ''
      console.error(`[Loading] redesign ${pageMode} failed:`, error)
      // redesign 均为用户手动触发（结果页「再测一次」），不参与首页自动跳转，无需写冷却标记
      setRequestFailed(true)
    }
  }

  useDidShow(() => {
    const params = Taro.getCurrentInstance().router?.params
    const archiveId = params?.archiveId
    const pageMode = (params?.mode as 'daily' | 'native') || 'daily'
    const action = (params?.action as string) || ''
    fromRef.current = (params?.from as string) || ''

    // 中断可能残留的上一次请求，并递增序号使其回调静默失效（在重置 cancelledRef 之前执行）
    requestTaskRef.current?.abort?.()
    requestTaskRef.current = null
    notifyBackendCancel()
    requestSeqRef.current += 1

    // 每次进入都重置为干净起点：requestedRef 必须复位，否则 loadData 首行直接 return 永远不发请求
    requestedRef.current = false
    cancelledRef.current = false
    setRequestFailed(false)
    setMode(pageMode)
    setCurrentStep(0)
    setProgressValue(0)
    setIsAccelerated(false)
    startTimeRef.current = Date.now()

    lastRequestRef.current = archiveId ? { archiveId: archiveId as string, pageMode, action } : null

    if (archiveId) {
      if (action === 'redesign') {
        redesignData(archiveId as string, pageMode)
      } else {
        loadData(archiveId as string, pageMode)
      }
    } else {
      Taro.showToast({ title: '缺少档案信息', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 1500)
    }

    // Taro 的 useDidShow 回调返回值不会被当作 cleanup 调用，计时器用 ref 管理并在 useUnload 中清理
    if (accelerateTimerRef.current) clearTimeout(accelerateTimerRef.current)
    accelerateTimerRef.current = setTimeout(() => {
      setIsAccelerated(true)
    }, 25000)
  })

  // 页面销毁（返回/关闭）时中断进行中的请求，阻止结果保存与页面跳转（通用能力）。
  // 注意：必须放在 useUnload 而非 useDidHide——navigateBack 销毁页面时只触发 onUnload，
  // onHide 不会触发，放 useDidHide 会导致取消逻辑失效。
  useUnload(() => {
    cancelledRef.current = true
    requestedRef.current = false
    // 递增序号，使进行中请求的响应/失败回调全部静默失效
    requestSeqRef.current += 1
    const wasRequesting = !!requestTaskRef.current
    requestTaskRef.current?.abort?.()
    requestTaskRef.current = null
    // 前端 abort 只断开本地等待，后端 AI 请求仍在执行；通知后端真实中断，避免空跑消耗
    notifyBackendCancel()
    if (accelerateTimerRef.current) {
      clearTimeout(accelerateTimerRef.current)
      accelerateTimerRef.current = null
    }
    // daily 自动生成场景下用户主动退出（请求未完成）：写冷却标记，防止回到首页后
    // 首页 onShow 立即又自动跳进 loading（用户感知为"退不出去"）
    const last = lastRequestRef.current
    if (wasRequesting && last && last.pageMode === 'daily' && last.action !== 'redesign') {
      markDailyGenerateFailed(last.archiveId)
    }
  })

  useEffect(() => {
    if (currentStep < loadingSteps.length - 1) {
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

  // 失败界面「重新生成」：按最近一次请求的参数重发
  const handleRetry = () => {
    const last = lastRequestRef.current
    if (!last) return
    setRequestFailed(false)
    requestedRef.current = false
    setCurrentStep(0)
    setProgressValue(0)
    setIsAccelerated(false)
    startTimeRef.current = Date.now()
    if (accelerateTimerRef.current) clearTimeout(accelerateTimerRef.current)
    accelerateTimerRef.current = setTimeout(() => {
      setIsAccelerated(true)
    }, 25000)
    if (last.action === 'redesign') {
      redesignData(last.archiveId, last.pageMode)
    } else {
      loadData(last.archiveId, last.pageMode)
    }
  }

  const handleBackFromFailed = () => {
    if (fromRef.current === 'result') {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  // 请求失败：停留本页给出明确出口，不自动跳转（避免与首页 onShow 自动跳 loading 形成死循环）
  if (requestFailed) {
    return (
      <View className="min-h-full bg-white px-6 py-8 flex flex-col items-center justify-center">
        <CloudOff size={56} color="#9ca3af" />
        <Text className="block text-lg font-semibold text-gray-900 mt-5">生成失败</Text>
        <Text className="block text-sm text-gray-500 mt-2 text-center leading-relaxed">
          网络繁忙或服务暂时不可用，请稍后重试
        </Text>
        <View className="w-full mt-8 flex flex-col gap-3">
          <Button className="w-full" onClick={handleRetry}>
            <View className="flex flex-row items-center justify-center gap-1">
              <RefreshCw size={16} color="#ffffff" />
              <Text className="text-sm">重新生成</Text>
            </View>
          </Button>
          <Button variant="outline" className="w-full" onClick={handleBackFromFailed}>
            <Text className="text-sm">{fromRef.current === 'result' ? '返回结果页' : '返回首页'}</Text>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-full bg-white px-6 py-8 flex flex-col">
      {/* Animation Area */}
      <View className="flex flex-col items-center pt-8 pb-6">
        {/* 五行流动动画 */}
        <WuxingLoader isAccelerated={isAccelerated} className="mb-6" />

        {/* Current Step Text */}
        <Text className="block text-base font-medium text-gray-900 mb-1">
          正在生成中
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
                <View className="flex justify-between">
                  <Text className="text-xs text-gray-500">穿搭风格</Text>
                  <Text className="text-sm text-gray-900">
                    {archive.stylePreference || '-'}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* Progress Steps（玄学文案，抖音渠道隐藏整个底部展示区） */}
      {SHOW_METAPHYSICS && (
      <View className="flex-1 flex flex-col justify-end pb-8">
        <View className="flex flex-col gap-3 mb-6">
          {loadingSteps.map((step, index) => (
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
