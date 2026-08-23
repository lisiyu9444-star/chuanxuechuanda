import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChevronRight, FolderOpen, Clock, ShieldCheck, LogOut, UserRound } from 'lucide-react-taro'
import { getCurrentArchive, getArchives, type Archive } from '@/utils/archiveStorage'
import { AUTH_EVENTS, getAuthUser, isLoggedIn, isWeappEnv, logout, requireLogin, type AuthUser } from '@/utils/auth'
import { LoginSheet } from '@/components/login-sheet'

export default function ProfilePage() {
  const [currentArchive, setCurrentArchive] = useState<Archive | null>(null)
  const [userArchiveCount, setUserArchiveCount] = useState(0)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  const refreshAuthState = () => {
    setLoggedIn(isLoggedIn())
    setAuthUser(getAuthUser())
  }

  const refreshPageState = () => {
    const archive = getCurrentArchive()
    setCurrentArchive(archive)
    const archives = getArchives()
    // 未登录（微信端）时隐藏用户档案数量：档案数据与登录状态绑定
    const authed = !isWeappEnv() || isLoggedIn()
    setUserArchiveCount(authed ? archives.filter(a => !a.isDefault).length : 0)
    refreshAuthState()
  }

  useDidShow(() => {
    refreshPageState()
  })

  // 登录弹窗在本页上方完成（页面不切换，useDidShow 不触发），需监听事件实时刷新登录状态与档案视图
  useEffect(() => {
    Taro.eventCenter.on(AUTH_EVENTS.LOGIN_SUCCESS, refreshPageState)
    Taro.eventCenter.on(AUTH_EVENTS.LOGOUT, refreshPageState)
    return () => {
      Taro.eventCenter.off(AUTH_EVENTS.LOGIN_SUCCESS, refreshPageState)
      Taro.eventCenter.off(AUTH_EVENTS.LOGOUT, refreshPageState)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManageArchives = () => {
    Taro.navigateTo({ url: '/pages/archive/list/index' })
  }

  const handleViewHistory = async () => {
    // 历史记录需登录：未登录时唤起全局登录引导，登录后再次点击进入
    if (!(await requireLogin())) return
    Taro.navigateTo({ url: '/pages/history/index' })
  }

  const handleViewPrivacy = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  const handleLogin = async () => {
    // 统一登录门禁：未同意隐私协议时唤起登录弹层；失败提示由 requireLogin 内部处理
    const ok = await requireLogin()
    refreshAuthState()
    if (ok) {
      Taro.showToast({ title: '登录成功', icon: 'success' })
    }
  }

  const handleLogout = () => {
    // logout 内部已将当前视角重置为示例档案并广播退出事件
    logout()
    setCurrentArchive(getCurrentArchive())
    refreshAuthState()
    setLogoutDialogOpen(false)
    Taro.showToast({ title: '已退出登录', icon: 'none' })
  }

  const showAuthSection = isWeappEnv()

  return (
    <View className="min-h-screen bg-gray-50">
      <View className="px-4 pt-6 pb-6">
        <Text className="block text-2xl font-bold text-slate-900 mb-1">我的</Text>
        <Text className="block text-sm text-slate-500">管理档案与历史穿搭记录</Text>
      </View>

      <View className="px-4 space-y-4 pb-8">
        {/* 登录状态卡片（仅微信小程序展示）：未登录整卡即登录入口，点击唤起登录弹层 */}
        {showAuthSection && (
          <Card
            className={`border-0 shadow-sm ${loggedIn ? '' : 'active:opacity-80'}`}
            onClick={loggedIn ? undefined : () => { void handleLogin() }}
          >
            <CardContent className="p-4">
              <View className="flex items-center justify-between">
                <View className="flex items-center gap-3">
                  <Avatar className="w-14 h-14 bg-slate-100">
                    {authUser?.avatarUrl && <AvatarImage src={authUser.avatarUrl} mode="aspectFill" />}
                    <AvatarFallback className="bg-slate-100">
                      <UserRound size={26} color="#9ca3af" />
                    </AvatarFallback>
                  </Avatar>
                  <View>
                    {loggedIn ? (
                      <>
                        <Text className="block text-base font-semibold text-slate-900">
                          {authUser?.nickname || '微信用户'}
                        </Text>
                        <Text className="block text-xs text-slate-500 mt-1">
                          ID: {authUser?.displayId || '--'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text className="block text-lg font-semibold text-slate-900">点击登录</Text>
                        <Text className="block text-xs text-slate-500 mt-1">登录后解锁更多精彩功能</Text>
                      </>
                    )}
                  </View>
                </View>
                {loggedIn && (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => { e.stopPropagation(); setLogoutDialogOpen(true) }}>
                    <View className="flex items-center gap-1">
                      <LogOut size={14} color="#64748b" />
                      <Text className="text-xs">退出</Text>
                    </View>
                  </Button>
                )}
              </View>
            </CardContent>
          </Card>
        )}

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
                <View className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <FolderOpen size={20} color="#1f2937" />
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
              className="w-full h-auto px-4 py-4 justify-between rounded-none border-b border-slate-100 active:bg-slate-50"
              onClick={handleViewHistory}
            >
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Clock size={20} color="#1f2937" />
                </View>
                <View className="text-left">
                  <Text className="block text-base font-medium text-slate-900">历史记录</Text>
                  <Text className="block text-xs text-slate-500 mt-1">查看过往穿搭</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Button>

            <Button
              variant="ghost"
              className="w-full h-auto px-4 py-4 justify-between rounded-none active:bg-slate-50"
              onClick={handleViewPrivacy}
            >
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <ShieldCheck size={20} color="#1f2937" />
                </View>
                <View className="text-left">
                  <Text className="block text-base font-medium text-slate-900">隐私政策</Text>
                  <Text className="block text-xs text-slate-500 mt-1">了解我们如何保护你的信息</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* 退出登录二次确认 */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出登录？</AlertDialogTitle>
            <AlertDialogDescription>
              退出后将恢复为示例档案视图，档案与历史记录会暂时隐藏，重新登录后可找回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLogoutDialogOpen(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>退出登录</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 全局登录弹层（页面级挂载，小程序端 App 不渲染 UI） */}
      <LoginSheet />
    </View>
  )
}
