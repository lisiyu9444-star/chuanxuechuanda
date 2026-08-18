import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, Trash2 } from 'lucide-react-taro'
import { getHistoryRecords, deleteHistoryRecord, type HistoryRecordItem } from '@/utils/historyStorage'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecordItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadRecords = () => {
    const list = getHistoryRecords()
    setRecords(list)
  }

  useDidShow(() => {
    loadRecords()
  })

  const handleDelete = (id: string) => {
    deleteHistoryRecord(id)
    loadRecords()
    setSelectedId(null)
  }

  const handleViewDetail = (record: HistoryRecordItem) => {
    Taro.navigateTo({
      url: `/pages/result/index?mode=history&archiveId=${record.archiveId}&date=${record.date}`
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-6 pb-4">
        <Text className="block text-2xl font-bold text-slate-900 mb-1">历史记录</Text>
        <Text className="block text-sm text-slate-500">过往穿搭与运势回顾</Text>
      </View>

      <View className="px-4 pb-8 space-y-3">
        {records.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 flex flex-col items-center justify-center">
              <Text className="block text-slate-400 text-center mb-2">暂无历史记录</Text>
              <Text className="block text-xs text-slate-400 text-center">
                生成今日穿搭后将自动保存到这里
              </Text>
            </CardContent>
          </Card>
        ) : (
          records.map(record => (
            <Card key={record.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-0 justify-start active:bg-slate-50"
                  onClick={() => handleViewDetail(record)}
                >
                  <View className="flex items-center gap-3 w-full">
                    {/* 缩略图：与首页今日穿搭保持一致，约 80x107 的 3:4 比例 */}
                    <View className="relative w-20 h-[107px] rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {record.tryOnUrl || record.imageUrl ? (
                        <Image
                          src={record.tryOnUrl || record.imageUrl || ''}
                          mode="aspectFill"
                          className="w-full h-full"
                        />
                      ) : (
                        <View className="w-full h-full flex items-center justify-center">
                          <Text className="text-xs text-slate-400">暂无图片</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-1 min-w-0 text-left py-1">
                      <Text className="block text-base font-semibold text-slate-900 truncate">
                        {record.nickname || '穿搭记录'}
                      </Text>
                      <Text className="block text-sm text-slate-500 mt-1">
                        {formatDate(record.date)}
                      </Text>
                      <Text className="block text-xs text-slate-400 mt-1 truncate">
                        {record.llmPlan?.styleTheme || '今日穿搭方案'}
                      </Text>

                      <View className="flex items-center gap-2 mt-2">
                        {record.imageUrl && (
                          <Text className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-600">
                            平铺图
                          </Text>
                        )}
                        {record.tryOnUrl && (
                          <Text className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                            上身图
                          </Text>
                        )}
                      </View>
                    </View>

                    <ChevronRight size={18} color="#9ca3af" />
                  </View>
                </Button>

                <View className="flex justify-end mt-2">
                  <AlertDialog open={selectedId === record.id} onOpenChange={(open) => !open && setSelectedId(null)}>
                    <AlertDialogTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-slate-400 hover:text-red-500"
                        onClick={() => setSelectedId(record.id)}
                      >
                        <Trash2 size={16} color="#94a3b8" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除记录</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要删除这条穿搭记录吗？删除后无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedId(null)}>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(record.id)}>删除</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </View>
    </View>
  )
}
