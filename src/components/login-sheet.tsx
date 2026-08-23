import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageCircle } from 'lucide-react-taro'
import { agreePrivacy } from '@/utils/auth'

interface LoginSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 全局登录弹层（底部半屏）。
 * - 由 requireLogin 在未登录时唤起（auth 事件总线 → app.tsx 挂载）
 * - 勾选「已阅读并同意隐私政策」后点击「微信快捷登录」完成静默登录
 * - 可取消（遮罩点击 / 右上角关闭）：取消后保持未登录示例视图，不做任何阻断
 */
export function LoginSheet({ open, onOpenChange }: LoginSheetProps) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!submitting) onOpenChange(nextOpen)
  }

  const openPrivacyPage = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  const handleLogin = async () => {
    if (submitting) return
    if (!checked) {
      Taro.showToast({ title: '请先阅读并同意隐私政策', icon: 'none', duration: 2000 })
      return
    }
    setSubmitting(true)
    try {
      // 同意隐私协议 + 微信静默登录（登录成功会广播 LOGIN_SUCCESS，各页面自动刷新）
      const ok = await agreePrivacy()
      if (ok) {
        onOpenChange(false)
        Taro.showToast({ title: '登录成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '登录失败，请稍后重试', icon: 'none', duration: 2000 })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-8 pt-8 pb-12">
        <View className="flex flex-col items-center">
          <Text className="block text-center text-lg font-semibold text-gray-900">
            欢迎来到幸运穿搭
          </Text>
          <Text className="block text-center text-xs text-gray-400 mt-2">
            登录后创建专属档案，解锁每日幸运穿搭
          </Text>

          <View className="w-full mt-8">
            <Button
              className="w-full rounded-full bg-[#07C160] text-white border-0 h-12"
              disabled={submitting}
              onClick={handleLogin}
            >
              <View className="flex flex-row items-center justify-center gap-2">
                <MessageCircle size={20} color="#ffffff" />
                <Text className="text-base text-white">
                  {submitting ? '登录中...' : '微信快捷登录'}
                </Text>
              </View>
            </Button>
          </View>

          <View className="mt-5 flex flex-row items-center justify-center">
            <Checkbox checked={checked} onCheckedChange={setChecked} />
            <View className="ml-2 flex flex-row flex-wrap items-center" onClick={() => setChecked(!checked)}>
              <Text className="text-xs text-gray-500">我已阅读并同意</Text>
              <Text
                className="text-xs text-primary"
                onClick={e => {
                  e.stopPropagation()
                  openPrivacyPage()
                }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>
        </View>
      </SheetContent>
    </Sheet>
  )
}
