import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, Trash2, LogIn } from 'lucide-react-taro'
import { getHistoryRecords, deleteHistoryRecord, clearHistoryRecords, refreshHistoryImageUrls, saveHistoryRecord, type HistoryRecordItem } from '@/utils/historyStorage'
import { refreshImageUrls, extractTosKeyFromUrl } from '@/constants/remote-assets'
import { deleteHistoryOnServer, clearHistoryOnServer, fetchServerHistory, parseServerHistoryRecord } from '@/utils/serverSync'
import { AUTH_EVENTS, isLoggedIn, isWeappEnv, requireLogin } from '@/utils/auth'

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecordItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // 历史记录与登录状态绑定：未登录（微信端）不展示任何记录，改为登录引导
  const [canView, setCanView] = useState(true)

  const loadRecords = () => {
    const list = getHistoryRecords()
    setRecords(list)
    return list
  }

  // 签名 URL 会过期，凭持久化的 key 批量换签（旧记录无 key 时从 URL 中兜底提取）
  const refreshRecordImages = async (list: HistoryRecordItem[]) => {
    try {
      const keys = new Set<string>()
      for (const record of list) {
        if (record.imageKey) keys.add(record.imageKey)
        if (record.tryOnKey) keys.add(record.tryOnKey)
        if (!record.imageKey && record.imageUrl) {
          const key = extractTosKeyFromUrl(record.imageUrl)
          if (key) keys.add(key)
        }
        if (!record.tryOnKey && record.tryOnUrl) {
          const key = extractTosKeyFromUrl(record.tryOnUrl)
          if (key) keys.add(key)
        }
      }
      if (keys.size === 0) return
      const urlMap = await refreshImageUrls(Array.from(keys))
      if (!urlMap || Object.keys(urlMap).length === 0) return
      const refreshed = refreshHistoryImageUrls(urlMap)
      setRecords(refreshed)
    } catch (e) {
      console.warn('[History] refresh image urls failed:', e)
    }
  }

  // 登录后从服务端拉取记录，把本地缺失的合并回来（跨设备/换机恢复），再刷新页面
  const restoreFromServer = async () => {
    const rows = await fetchServerHistory()
    if (!rows || rows.length === 0) return
    const localIds = new Set(getHistoryRecords().map(r => r.id))
    let restored = 0
    for (const row of rows) {
      if (!row.clientId || localIds.has(row.clientId)) continue
      const record = parseServerHistoryRecord(row)
      if (record) {
        saveHistoryRecord(record)
        restored++
      }
    }
    if (restored > 0) {
      console.log('[History] 从服务端恢复记录:', restored)
      const list = loadRecords()
      refreshRecordImages(list)
    }
  }

  useDidShow(() => {
    setActiveId(null)
    const authed = !isWeappEnv() || isLoggedIn()
    setCanView(authed)
    if (!authed) {
      // 未登录：清空视图，不读取本地记录、不请求服务端
      setRecords([])
      return
    }
    const list = loadRecords()
    refreshRecordImages(list)
    void restoreFromServer()
  })

  // 登录成功后立即加载记录；退出登录后清空为登录引导视图
  useEffect(() => {
    const handleLogin = () => {
      setCanView(true)
      const list = loadRecords()
      refreshRecordImages(list)
      void restoreFromServer()
    }
    const handleLogout = () => {
      setCanView(false)
      setRecords([])
      setActiveId(null)
    }
    Taro.eventCenter.on(AUTH_EVENTS.LOGIN_SUCCESS, handleLogin)
    Taro.eventCenter.on(AUTH_EVENTS.LOGOUT, handleLogout)
    return () => {
      Taro.eventCenter.off(AUTH_EVENTS.LOGIN_SUCCESS, handleLogin)
      Taro.eventCenter.off(AUTH_EVENTS.LOGOUT, handleLogout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = (id: string) => {
    deleteHistoryRecord(id)
    deleteHistoryOnServer(id)
    loadRecords()
    setActiveId(null)
  }

  const handleClearAll = () => {
    Taro.showModal({
      title: '清空记录',
      content: '确定要清空所有历史记录吗？删除后无法恢复。',
      confirmColor: '#1f2937',
      success: (res) => {
        if (res.confirm) {
          clearHistoryRecords()
          clearHistoryOnServer()
          loadRecords()
          setActiveId(null)
        }
      }
    })
  }

  const handleViewDetail = (record: HistoryRecordItem) => {
    if (activeId) {
      setActiveId(null)
      return
    }
    Taro.navigateTo({
      url: `/pages/result/index?mode=history&archiveId=${record.archiveId}&date=${record.date || ''}&recordMode=${record.mode}`
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-6 pb-4 flex items-center justify-between">
        <View>
          <Text className="block text-lg font-semibold text-slate-900">历史记录</Text>
          <Text className="block text-sm text-slate-500 mt-1">查看过往穿搭</Text>
        </View>
        {canView && records.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-900 h-8 px-2"
            onClick={handleClearAll}
          >
            <Text className="text-xs">清空</Text>
          </Button>
        )}
      </View>

      {!canView && (
        <View className="px-4 pb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 flex flex-col items-center justify-center">
              <LogIn size={32} color="#94a3b8" className="mb-3" />
              <Text className="block text-slate-500 text-center mb-2">历史记录与账号绑定</Text>
              <Text className="block text-xs text-slate-400 text-center mb-5">
                登录后可查看并跨设备同步你的穿搭记录
              </Text>
              <Button
                className="w-full bg-slate-900 text-white py-3 rounded-xl"
                onClick={() => { void requireLogin() }}
              >
                微信登录
              </Button>
            </CardContent>
          </Card>
        </View>
      )}

      {canView && (
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
            <Card key={record.id} className="border-0 shadow-sm overflow-visible">
              <CardContent className="p-3 relative">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-0 justify-start active:bg-slate-50"
                  onClick={() => handleViewDetail(record)}
                  onLongPress={() => setActiveId(record.id)}
                >
                  <View className="flex items-center gap-3 w-full">
                    {/* 缩略图：与结果页保持一致，3:4 比例防止裁剪 */}
                    <View className="relative w-20 aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
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
                        {record.mode === 'native' ? '本命穿搭' : (record.date ? formatDate(record.date) : '')}
                      </Text>

                      {/* 幸运色 */}
                      {record.llmPlan?.luckyColors && (
                        <View className="flex flex-wrap items-center gap-2 mt-2">
                          {record.llmPlan.luckyColors.primary && (
                            <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              主色：{record.llmPlan.luckyColors.primary}
                            </Text>
                          )}
                          {record.llmPlan.luckyColors.secondary && (
                            <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              辅色：{record.llmPlan.luckyColors.secondary}
                            </Text>
                          )}
                          {record.llmPlan.luckyColors.accent && (
                            <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              点缀：{record.llmPlan.luckyColors.accent}
                            </Text>
                          )}
                        </View>
                      )}

                      <View className="flex items-center gap-2 mt-2">
                        {record.imageUrl && (
                          <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            平铺图
                          </Text>
                        )}
                        {record.tryOnUrl && (
                          <Text className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            上身图
                          </Text>
                        )}
                      </View>
                    </View>

                    <ChevronRight size={18} color="#9ca3af" />
                  </View>
                </Button>

                {/* 长按删除菜单 */}
                {activeId === record.id && (
                  <>
                    <View
                      className="absolute inset-0 bg-black bg-opacity-40 rounded-xl z-10 flex items-center justify-center"
                      onClick={() => setActiveId(null)}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-slate-800 text-white hover:bg-slate-900 border-0 h-9 px-4"
                        onClick={(e) => {
                          e.stopPropagation()
                          Taro.showModal({
                            title: '删除记录',
                            content: '确定要删除这条穿搭记录吗？删除后无法恢复。',
                            confirmColor: '#1f2937',
                            cancelColor: '#6b7280',
                            success: (res) => {
                              if (res.confirm) {
                                handleDelete(record.id)
                              } else {
                                setActiveId(null)
                              }
                            }
                          })
                        }}
                      >
                        <Trash2 size={14} color="#ffffff" className="mr-1" />
                        <Text className="text-sm text-white">删除</Text>
                      </Button>
                    </View>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </View>
      )}
    </View>
  )
}
