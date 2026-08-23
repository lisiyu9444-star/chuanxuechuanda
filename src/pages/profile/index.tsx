import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChevronRight, FolderOpen, Clock, ShieldCheck, LogOut, UserRound } from 'lucide-react-taro'
import { getCurrentArchive, getArchives, type Archive } from '@/utils/archiveStorage'
import { getAuthUser, isLoggedIn, isWeappEnv, logout, silentLogin, type AuthUser } from '@/utils/auth'

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

  useDidShow(() => {
    const archive = getCurrentArchive()
    setCurrentArchive(archive)
    const archives = getArchives()
    setUserArchiveCount(archives.filter(a => !a.isDefault).length)
    refreshAuthState()
  })

  const handleManageArchives = () => {
    Taro.navigateTo({ url: '/pages/archive/list/index' })
  }

  const handleViewHistory = () => {
    Taro.navigateTo({ url: '/pages/history/index' })
  }

  const handleViewPrivacy = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  const handleRelogin = async () => {
    const ok = await silentLogin()
    refreshAuthState()
    Taro.showToast({ title: ok ? '登录成功' : '登录失败，请稍后重试', icon: ok ? 'success' : 'none' })
  }

  const handleLogout = () => {
    logout()
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
        {/* 登录状态卡片（仅微信小程序展示） */}
        {showAuthSection && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <View className="flex items-center justify-between">
                <View className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 bg-slate-100">
                    {authUser?.avatarUrl && <AvatarImage src={authUser.avatarUrl} mode="aspectFill" />}
                    <AvatarFallback className="bg-slate-100">
                      <UserRound size={22} color="#9ca3af" />
                    </AvatarFallback>
                  </Avatar>
                  <View>
                    <Text className="block text-base font-semibold text-slate-900">
                      {loggedIn ? authUser?.nickname || '微信用户' : '未登录'}
                    </Text>
                    <Text className="block text-xs text-slate-500 mt-1">
                      {loggedIn ? '已开启云端数据同步' : '登录后云端保存档案与记录'}
                    </Text>
                  </View>
                </View>
                {loggedIn ? (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLogoutDialogOpen(true)}>
                    <View className="flex items-center gap-1">
                      <LogOut size={14} color="#64748b" />
                      <Text className="text-xs">退出</Text>
                    </View>
                  </Button>
                ) : (
                  <Button size="sm" className="rounded-full" onClick={handleRelogin}>
                    <Text className="text-xs">微信登录</Text>
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
              退出后将清除本设备的登录状态，本地档案与历史记录不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLogoutDialogOpen(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>退出登录</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
