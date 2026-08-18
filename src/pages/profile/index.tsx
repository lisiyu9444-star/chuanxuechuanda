import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, FolderOpen, Clock } from 'lucide-react-taro'
import { getCurrentArchive, getArchives, type Archive } from '@/utils/archiveStorage'

export default function ProfilePage() {
  const [currentArchive, setCurrentArchive] = useState<Archive | null>(null)
  const [userArchiveCount, setUserArchiveCount] = useState(0)

  useDidShow(() => {
    const archive = getCurrentArchive()
    setCurrentArchive(archive)
    const archives = getArchives()
    setUserArchiveCount(archives.filter(a => !a.isDefault).length)
  })

  const handleManageArchives = () => {
    Taro.navigateTo({ url: '/pages/archive/list/index' })
  }

  const handleViewHistory = () => {
    Taro.navigateTo({ url: '/pages/history/index' })
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-6 pb-6">
        <Text className="block text-2xl font-bold text-slate-900 mb-1">我的</Text>
        <Text className="block text-sm text-slate-500">管理档案与历史穿搭记录</Text>
      </View>

      <View className="px-4 space-y-4 pb-8">
        {/* 当前档案卡片 */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-slate-500 mb-2">当前档案</Text>
            <View className="flex items-center justify-between">
              <View>
                <Text className="block text-lg font-semibold text-slate-900">
                  {currentArchive?.nickname || '示例档案'}
                </Text>
                <Text className="block text-sm text-slate-500 mt-1">
                  {currentArchive?.isDefault
                    ? '每日运势示例展示'
                    : `${currentArchive?.birthDate || ''} · ${currentArchive?.birthTime || ''}`}
                </Text>
              </View>
              {currentArchive?.isDefault && (
                <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">示例</Text>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 入口列表 */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full h-auto px-4 py-4 justify-between rounded-none border-b border-slate-100 active:bg-slate-50"
              onClick={handleManageArchives}
            >
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <FolderOpen size={20} color="#7c3aed" />
                </View>
                <View className="text-left">
                  <Text className="block text-base font-medium text-slate-900">档案管理</Text>
                  <Text className="block text-xs text-slate-500 mt-1">
                    {userArchiveCount > 0 ? `已保存 ${userArchiveCount} 个档案` : '添加和管理个人档案'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Button>

            <Button
              variant="ghost"
              className="w-full h-auto px-4 py-4 justify-between rounded-none active:bg-slate-50"
              onClick={handleViewHistory}
            >
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock size={20} color="#3b82f6" />
                </View>
                <View className="text-left">
                  <Text className="block text-base font-medium text-slate-900">历史记录</Text>
                  <Text className="block text-xs text-slate-500 mt-1">查看过往穿搭与运势</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  )
}
