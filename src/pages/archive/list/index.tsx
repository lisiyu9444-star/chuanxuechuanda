import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Venus, Mars, Pencil, Trash2, Plus, LogIn } from 'lucide-react-taro'
import {
  getArchives,
  deleteArchive,
  saveArchive,
  setCurrentArchiveId,
  getCurrentArchiveId,
} from '@/utils/archiveStorage'
import { deleteArchiveOnServer, fetchServerArchives, syncAllArchivesToServer } from '@/utils/serverSync'
import { AUTH_EVENTS, isLoggedIn, isWeappEnv, requireLogin } from '@/utils/auth'
import type { Archive } from '@/types/archive'
import './index.css'

const ArchiveListPage = () => {
  const [archives, setArchives] = useState<Archive[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [animating, setAnimating] = useState(false)
  // 是否可查看用户档案：非微信端（dev bypass）或已登录；未登录时用户档案隐藏（数据与登录状态绑定）
  const [canViewArchives, setCanViewArchives] = useState(true)

  // 登录后：先把本地档案全量同步到服务端（老用户补传），再把服务端有而本地缺失的档案合并回来（云端恢复）
  const syncAndRestore = async () => {
    const local = getArchives()
    syncAllArchivesToServer(local)
    const serverProfiles = await fetchServerArchives()
    if (!serverProfiles) return
    const localIds = new Set(local.map(a => a.id))
    let restored = 0
    const now = Date.now()
    for (const p of serverProfiles) {
      if (localIds.has(p.id)) continue
      saveArchive({
        id: p.id,
        nickname: p.nickname || '未命名',
        gender: (p.gender === 'female' ? 'female' : 'male') as Archive['gender'],
        birthDate: p.birthDate || '',
        birthTime: p.birthTime || '',
        location: p.location || '',
        calendarType: (p.calendarType === 'lunar' ? 'lunar' : 'solar') as Archive['calendarType'],
        age: p.age ? parseInt(p.age, 10) || 0 : 0,
        stylePreference: p.stylePreference || '',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      })
      restored++
    }
    if (restored > 0) {
      console.log('[Archive] 从服务端恢复档案:', restored)
      setArchives(getArchives())
    }
  }

  const refreshView = () => {
    const canView = !isWeappEnv() || isLoggedIn()
    setCanViewArchives(canView)
    setArchives(getArchives())
    setCurrentId(getCurrentArchiveId())
    // 登录状态下从服务端合并恢复；未登录跳过（canSync 内部也有 token 判断，此处前置避免无谓调用）
    if (canView) void syncAndRestore()
  }

  useDidShow(() => {
    setAnimating(false)
    refreshView()
  })

  // 登录/退出登录后刷新视图：登录恢复用户档案 + 云端合并，退出回到示例视角
  useEffect(() => {
    Taro.eventCenter.on(AUTH_EVENTS.LOGIN_SUCCESS, refreshView)
    Taro.eventCenter.on(AUTH_EVENTS.LOGOUT, refreshView)
    return () => {
      Taro.eventCenter.off(AUTH_EVENTS.LOGIN_SUCCESS, refreshView)
      Taro.eventCenter.off(AUTH_EVENTS.LOGOUT, refreshView)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSwitch = (archive: Archive) => {
    if (archive.id === currentId) {
      Taro.showToast({ title: '当前已是该档案', icon: 'none' })
      return
    }
    setAnimating(true)
    setCurrentArchiveId(archive.id)
    setCurrentId(archive.id)
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    }, 550)
  }

  const handleEdit = (archive: Archive) => {
    if (archive.isDefault) {
      Taro.showToast({ title: '示例档案不可编辑', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/archive/form/index?id=${archive.id}` })
  }

  // 未登录（微信端）时不展示用户档案：档案数据与登录状态绑定，退出登录后隐藏，重新登录恢复
  const userArchives = canViewArchives ? archives.filter(a => !a.isDefault) : []

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
          deleteArchiveOnServer(archive.id)
          setArchives(getArchives())
          setCurrentId(getCurrentArchiveId())
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }

  const handleAdd = async () => {
    // 添加档案需登录：未登录时 requireLogin 会唤起全局登录（隐私弹窗），同意登录后再次点击即可
    if (!(await requireLogin())) return
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
          {!canViewArchives ? (
            <>
              <LogIn size={32} color="#9CA3AF" className="mx-auto mb-3" />
              <Text className="block text-gray-500 mb-4">登录后即可创建专属档案，生成你的每日穿搭</Text>
              <Button className="w-full bg-gray-900 text-white py-3 rounded-xl" onClick={handleAdd}>
                微信登录并添加档案
              </Button>
            </>
          ) : (
            <>
              <Text className="block text-gray-500 mb-4">还没有真实档案，添加后即可查看专属运势</Text>
              <Button className="w-full bg-gray-900 text-white py-3 rounded-xl" onClick={handleAdd}>
                添加档案
              </Button>
            </>
          )}
        </View>
      )}

      {animating && (
        <View className="page-flip-overlay">
          <Text className="block text-xl font-semibold text-gray-900">切换中...</Text>
        </View>
      )}
    </View>
  )
}

export default ArchiveListPage
