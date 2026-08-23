import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface PrivacyDialogProps {
  open: boolean
  onAgree: () => void
}

/**
 * 隐私协议弹窗（首次启动必弹）。
 * - 遮罩点击不关闭（受控 open，忽略外部关闭请求）
 * - 勾选「已阅读并同意」后才能点击「同意并继续」
 * - 拒绝：提示并保留弹窗（不同意则不可使用）
 */
export function PrivacyDialog({ open, onAgree }: PrivacyDialogProps) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    // 受控模式：拒绝遮罩/返回键关闭，必须显式同意
    if (!nextOpen) return
  }

  const handleReject = () => {
    Taro.showToast({ title: '需同意隐私政策后才能使用', icon: 'none', duration: 2000 })
  }

  const handleAgree = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      await onAgree()
    } finally {
      setSubmitting(false)
    }
  }

  const openPrivacyPage = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black bg-opacity-60" />
        <DialogContent className="w-4/5 max-w-sm rounded-2xl bg-white p-6" closeClassName="hidden">
          <View className="flex flex-col">
            <Text className="block text-center text-lg font-semibold text-gray-900">隐私政策提示</Text>

            <View className="mt-4 max-h-64 overflow-hidden rounded-xl bg-gray-50 p-4">
              <Text className="block text-sm leading-6 text-gray-600">
                感谢你使用幸运穿搭！我们非常重视你的个人信息和隐私保护。在你使用本小程序前，请认真阅读并充分了解
              </Text>
              <Text className="block text-sm leading-6 text-primary" onClick={openPrivacyPage}>
                《隐私政策》
              </Text>
              <Text className="block text-sm leading-6 text-gray-600">
                的全部内容。我们仅会在获得你的同意后，收集为提供服务所必需的信息（如微信昵称、头像、你主动填写的档案信息），用于为你生成个性化穿搭方案。
              </Text>
            </View>

            <View className="mt-4 flex flex-row items-center">
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

            <View className="mt-5 flex flex-row gap-3">
              <View className="flex-1">
                <Button variant="outline" className="w-full rounded-full" onClick={handleReject}>
                  <Text>不同意</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  className="w-full rounded-full"
                  disabled={!checked || submitting}
                  onClick={handleAgree}
                >
                  <Text>{submitting ? '请稍候...' : '同意并继续'}</Text>
                </Button>
              </View>
            </View>
          </View>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
