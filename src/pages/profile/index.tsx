import { useState, useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Trash2, Clock, Shirt, User } from 'lucide-react-taro'
import type { HistoryRecord } from '@/types/bazi'

const HISTORY_KEY = 'outfit_history'
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export default function ProfilePage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())

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
      const sorted = validRecords.sort((a: HistoryRecord, b: HistoryRecord) => b.createdAt - a.createdAt)
      setHistory(sorted)
      // 预加载封面图，命中小程序图片缓存，减少列表滑动时的闪烁
      sorted.forEach((record: HistoryRecord) => {
        if (record.imageUrl) {
          Taro.getImageInfo({ src: record.imageUrl }).catch(() => {})
        }
      })
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
        <View
          className="mt-4 flex items-center gap-3 p-4 bg-gray-50 rounded-xl active:bg-gray-100"
          onClick={() => Taro.navigateTo({ url: '/pages/archive/list/index' })}
        >
          <View className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <User size={22} color="#6b7280" />
          </View>
          <View className="flex-1">
            <Text className="block text-base font-medium text-gray-900">档案管理</Text>
            <Text className="block text-sm text-gray-500">添加、编辑、切换个人档案</Text>
          </View>
          <Text className="block text-sm text-gray-400">›</Text>
        </View>
      </View>

      <ScrollArea className="h-[calc(100vh-188px)]">
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
                      <View className="relative w-full h-64 bg-gray-100">
                        {!loadedImages.has(record.imageUrl) && (
                          <View className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
                            <Skeleton className="w-full h-full" />
                          </View>
                        )}
                        <Image
                          src={record.imageUrl}
                          mode="aspectFill"
                          className="w-full h-64"
                          lazyLoad
                          onLoad={() => {
                            setLoadedImages(prev => {
                              const next = new Set(prev)
                              next.add(record.imageUrl)
                              return next
                            })
                          }}
                          onError={() => {
                            setLoadedImages(prev => {
                              const next = new Set(prev)
                              next.add(record.imageUrl)
                              return next
                            })
                          }}
                        />
                      </View>
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
                        <Text className="block text-sm text-gray-600" numberOfLines={2}>
                          {record.llmPlan?.styleTheme || record.outfit?.style || '今日穿搭推荐'}
                        </Text>
                        <Text className="block text-xs text-gray-400">
                          {record.ganZhiDate?.month || ''} {record.ganZhiDate?.day || ''}
                        </Text>
                      </View>
                    </View>

                    <View className="px-4 pb-4">
                      <AlertDialog>
                        <AlertDialogTrigger
                          variant="outline"
                          size="sm"
                          className="w-full text-red-500 border-red-200 hover:bg-red-50 flex items-center justify-center"
                        >
                          <Trash2 size={16} color="#ef4444" />
                          <Text className="block ml-1">删除记录</Text>
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
                            <AlertDialogCancel variant="outline" size="sm">
                              <Text className="block">取消</Text>
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Text className="block">删除</Text>
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
