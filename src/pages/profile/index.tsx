import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Clock, Shirt } from 'lucide-react-taro'

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
    backgroundColor?: string
  }
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
  tryOnUrl?: string
  createdAt: number
}

const HISTORY_KEY = 'outfit_history'
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export default function ProfilePage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  useDidShow(() => {
    loadHistory()
  })

  const loadHistory = () => {
    try {
      const raw = Taro.getStorageSync(HISTORY_KEY)
      const data = Array.isArray(raw) ? raw : []
      const now = Date.now()
      const validRecords = data.filter((item: HistoryRecord) => now - item.createdAt < THIRTY_DAYS)
      if (validRecords.length !== data.length) {
        Taro.setStorageSync(HISTORY_KEY, validRecords)
      }
      setHistory(validRecords.sort((a: HistoryRecord, b: HistoryRecord) => b.createdAt - a.createdAt))
    } catch (e) {
      console.error('Load history failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id)
    setHistory(updated)
    Taro.setStorageSync(HISTORY_KEY, updated)
    Taro.showToast({ title: '已删除', icon: 'success' })
  }

  const handleViewDetail = (record: HistoryRecord) => {
    Taro.setStorageSync('baziResult', record)
    Taro.navigateTo({ url: '/pages/result/index' })
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-6 pb-4 bg-white">
        <Text className="block text-xl font-bold text-gray-900">我的</Text>
        <Text className="block text-sm text-gray-500 mt-1">历史记录保留近 30 天</Text>
      </View>

      <ScrollArea className="h-[calc(100vh-100px)]">
        <View className="p-4">
          {loading ? (
            <View className="flex items-center justify-center py-20">
              <Text className="block text-sm text-gray-400">加载中...</Text>
            </View>
          ) : history.length === 0 ? (
            <View className="flex flex-col items-center justify-center py-20">
              <View className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Shirt size={28} color="#9ca3af" />
              </View>
              <Text className="block text-base font-medium text-gray-900">暂无历史记录</Text>
              <Text className="block text-sm text-gray-500 mt-2">完成穿搭生成后将在这里展示</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-4">
              {history.map(record => (
                <Card key={record.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <View onClick={() => handleViewDetail(record)}>
                      <Image
                        src={record.imageUrl}
                        mode="aspectFill"
                        className="w-full h-64 bg-gray-100"
                        lazyLoad
                      />
                      <View className="p-4">
                        <View className="flex items-center justify-between mb-2">
                          <Text className="block text-base font-semibold text-gray-900">
                            {record.nickname} · {record.gender === 'female' ? '女' : '男'}
                          </Text>
                          <View className="flex items-center text-gray-400">
                            <Clock size={14} color="#9ca3af" />
                            <Text className="block text-xs text-gray-400 ml-1">
                              {formatDate(record.createdAt)}
                            </Text>
                          </View>
                        </View>
                        <View className="flex flex-wrap gap-2 mb-3">
                          {record.outfit?.colors?.map((color, index) => (
                            <View
                              key={index}
                              className="px-2 py-1 rounded-full bg-gray-100"
                            >
                              <Text className="block text-xs text-gray-600">{color}</Text>
                            </View>
                          ))}
                        </View>
                        <Text className="block text-xs text-gray-400">
                          {record.ganZhiDate?.month || ''} {record.ganZhiDate?.day || ''}
                        </Text>
                      </View>
                    </View>

                    <View className="px-4 pb-4">
                      <AlertDialog>
                        {/* @ts-expect-error asChild not in Taro View props */}
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 size={16} color="#ef4444" />
                            <Text className="block ml-1">删除记录</Text>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              <Text className="block text-lg font-semibold">确认删除？</Text>
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              <Text className="block text-sm text-gray-500">
                                删除后将无法恢复，该记录将从历史记录中移除。
                              </Text>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            {/* @ts-expect-error asChild not in Taro View props */}
                            <AlertDialogCancel asChild>
                              <Button variant="outline" size="sm">
                                <Text className="block">取消</Text>
                              </Button>
                            </AlertDialogCancel>
                            {/* @ts-expect-error asChild not in Taro View props */}
                            <AlertDialogAction asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Text className="block">删除</Text>
                              </Button>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollArea>
    </View>
  )
}
