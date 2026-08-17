import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Venus, Mars, Pencil, Trash2, Plus } from 'lucide-react-taro'
import {
  getArchives,
  deleteArchive,
  setCurrentArchiveId,
  getCurrentArchiveId,
} from '@/utils/archiveStorage'
import type { Archive } from '@/types/archive'
import './index.css'

const ArchiveListPage = () => {
  const [archives, setArchives] = useState<Archive[]>([])
  const [currentId, setCurrentId] = useState<string>('')

  useDidShow(() => {
    setArchives(getArchives())
    setCurrentId(getCurrentArchiveId())
  })

  const handleSwitch = (archive: Archive) => {
    setCurrentArchiveId(archive.id)
    setCurrentId(archive.id)
    Taro.showToast({ title: `已切换为${archive.nickname}`, icon: 'none' })
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    }, 600)
  }

  const handleEdit = (archive: Archive) => {
    if (archive.isDefault) {
      Taro.showToast({ title: '示例档案不可编辑', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/archive/form/index?id=${archive.id}` })
  }

  const userArchives = archives.filter(a => !a.isDefault)

  const handleDelete = (archive: Archive) => {
    if (archive.isDefault) {
      Taro.showToast({ title: '示例档案不可删除', icon: 'none' })
      return
    }
    if (userArchives.length <= 1) {
      Taro.showToast({ title: '至少保留一个档案', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '确认删除',
      content: `确定删除「${archive.nickname}」的档案吗？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          deleteArchive(archive.id)
          setArchives(getArchives())
          setCurrentId(getCurrentArchiveId())
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }

  const handleAdd = () => {
    Taro.navigateTo({ url: '/pages/archive/form/index' })
  }

  return (
    <View className="min-h-full bg-gray-50 px-4 pt-4 pb-24">
      <View className="flex items-center justify-between mb-4">
        <Text className="block text-lg font-semibold text-gray-900">我的档案</Text>
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={handleAdd}>
          <Plus size={16} color="#374151" />
          <Text className="block text-sm">添加档案</Text>
        </Button>
      </View>

      <View className="flex flex-col gap-3">
        {userArchives.map((archive) => {
          const isActive = archive.id === currentId
          return (
            <Card
              key={archive.id}
              className={`border-2 ${isActive ? 'border-gray-900' : 'border-transparent'}`}
            >
              <CardContent className="p-4">
                <View className="flex items-center justify-between">
                  <View className="flex-1" onClick={() => handleSwitch(archive)}>
                    <View className="flex items-center gap-2 mb-1">
                      <Text className="block text-base font-semibold text-gray-900">{archive.nickname}</Text>
                      {isActive && (
                        <Text className="block text-xs px-2 py-1 bg-gray-900 text-white rounded-full">当前</Text>
                      )}
                    </View>
                    <View className="flex items-center gap-2 text-sm text-gray-500">
                      {archive.gender === 'female' ? <Venus size={14} color="#9CA3AF" /> : <Mars size={14} color="#9CA3AF" />}
                      <Text className="block">{archive.gender === 'female' ? '女' : '男'}</Text>
                      <Text className="block">·</Text>
                      <Text className="block">{archive.birthDate}</Text>
                      <Text className="block">·</Text>
                      <Text className="block">{archive.location}</Text>
                    </View>
                  </View>
                  <View className="flex items-center gap-2">
                    <View
                      className="p-2 rounded-full bg-gray-100"
                      onClick={() => handleEdit(archive)}
                    >
                      <Pencil size={16} color="#4B5563" />
                    </View>
                    <View
                      className="p-2 rounded-full bg-red-50"
                      onClick={() => handleDelete(archive)}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      {userArchives.length === 0 && (
        <View className="mt-8 p-6 bg-white rounded-2xl text-center">
          <Text className="block text-gray-500 mb-4">还没有真实档案，添加后即可查看专属运势</Text>
          <Button className="w-full bg-gray-900 text-white py-3 rounded-xl" onClick={handleAdd}>
            添加档案
          </Button>
        </View>
      )}
    </View>
  )
}

export default ArchiveListPage
