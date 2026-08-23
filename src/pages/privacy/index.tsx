import { ScrollView, Text, View } from '@tarojs/components'
import { CURRENT_PRIVACY_VERSION } from '@/utils/auth'

interface Section {
  title: string
  paragraphs: string[]
}

const SECTIONS: Section[] = [
  {
    title: '一、我们收集的信息',
    paragraphs: [
      '为了向你提供个性化穿搭建议服务，我们会在你同意后收集以下信息：',
      '1. 微信账号信息：当你使用微信登录时，我们会获取你的微信 OpenID（用于标识你的账号），以及你授权提供的昵称和头像。',
      '2. 你主动填写的档案信息：包括昵称、性别、出生日期、出生时间、出生地点、年龄及穿搭风格偏好，用于生成个性化的穿搭方案。',
      '3. 使用记录：你使用穿搭生成、试穿等功能产生的历史记录，用于向你提供历史回顾服务。',
    ],
  },
  {
    title: '二、信息的使用',
    paragraphs: [
      '我们仅将收集的信息用于以下用途：',
      '1. 为你生成、展示和保存个性化的穿搭方案；',
      '2. 提供分享功能，让你可以将穿搭方案分享给好友；',
      '3. 改进和优化我们的服务质量。',
      '我们不会将你的个人信息用于任何其他商业用途，也不会向任何第三方出售你的个人信息。',
    ],
  },
  {
    title: '三、信息的存储与保护',
    paragraphs: [
      '1. 你的信息存储于安全的服务器中，我们采取合理的技术手段保护你的信息安全。',
      '2. 你的登录凭证（Token）仅存储在你的设备本地，有效期为 7 天，过期后需重新登录。',
      '3. 分享内容自创建之日起保留 180 天，过期后自动删除。',
    ],
  },
  {
    title: '四、你的权利',
    paragraphs: [
      '1. 你可以在「我的」页面查看和管理你的档案信息；',
      '2. 你可以随时删除你的档案和历史记录；',
      '3. 你可以通过退出登录清除本设备上的登录状态；',
      '4. 如需注销账号或删除全部数据，请联系我们。',
    ],
  },
  {
    title: '五、未成年人保护',
    paragraphs: [
      '本服务不面向未满 14 周岁的未成年人。如果你是未成年人的监护人，请确保被监护人在你的监护和指导下使用本服务。',
    ],
  },
  {
    title: '六、政策的更新',
    paragraphs: [
      '我们可能会适时更新本隐私政策。当政策发生重大变更时，我们会在你下次启动小程序时重新征得你的同意。',
    ],
  },
  {
    title: '七、联系我们',
    paragraphs: [
      '如果你对本隐私政策有任何疑问、意见或建议，可通过小程序内的反馈渠道与我们联系。',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen">
        <View className="px-5 py-6 pb-12">
          <Text className="block text-xl font-bold text-gray-900">隐私政策</Text>
          <Text className="mt-2 block text-xs text-gray-400">版本：{CURRENT_PRIVACY_VERSION} · 更新日期：2026-08-22</Text>

          <View className="mt-6 flex flex-col gap-6">
            {SECTIONS.map(section => (
              <View key={section.title} className="flex flex-col">
                <Text className="block text-base font-semibold text-gray-900">{section.title}</Text>
                {section.paragraphs.map((p, i) => (
                  <Text key={i} className="mt-2 block text-sm leading-6 text-gray-600">
                    {p}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
