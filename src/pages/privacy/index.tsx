import { ScrollView, Text, View } from '@tarojs/components'
import { CURRENT_PRIVACY_VERSION } from '@/utils/auth'

interface Section {
  title: string
  paragraphs: string[]
}

const SECTIONS: Section[] = [
  {
    title: '开发者与产品',
    paragraphs: [
      '本指引适用于「传学幸运穿搭」小程序。',
      '开发者 / 运营者：吉林省传学文化传播有限公司。',
      '联系电话：13651309404。',
    ],
  },
  {
    title: '一、我们收集、使用的信息',
    paragraphs: [
      '为了向你提供个性化穿搭建议与穿搭评分服务，我们仅收集实现相关功能所必需的信息：',
      '1. 微信账号信息：当你使用微信快捷登录时，我们会获取你的微信 OpenID，仅用于标识和识别你的账号身份。',
      '2. 你主动填写的档案信息：包括昵称、性别、出生日期、出生时间、出生地点及穿搭风格偏好，用于生成个性化的穿搭方案。',
      '3. 你主动上传的照片：在你使用 AI 穿搭评分功能时，我们会获取你从相册选择或使用摄像头拍摄的穿搭照片，仅用于分析与评分。',
      '4. 使用记录：你使用穿搭生成、穿搭评分等功能产生的历史记录，用于向你提供历史回顾服务。',
    ],
  },
  {
    title: '二、权限的使用目的',
    paragraphs: [
      '我们在你使用相关功能时，会向你申请以下权限，并按以下目的使用：',
      '1. 相册（选择照片）及摄像头：用于从相册选择或拍摄穿搭照片，以进行 AI 穿搭评分与分析。',
      '2. 相册（仅写入）：用于在保存结果海报时，将图片写入你的本地相册。',
      '以上权限仅在你主动发起对应操作时申请，你可以拒绝授权，拒绝后仅影响对应功能的使用。',
    ],
  },
  {
    title: '三、我们如何使用与共享信息',
    paragraphs: [
      '1. 我们仅将收集的信息用于生成、展示与保存个性化的穿搭方案或评分结果，以及提供分享与历史回顾功能。',
      '2. 为提供 AI 穿搭评分与分析服务，我们会将你主动上传的穿搭照片传输至第三方人工智能服务提供商（北京火山引擎科技有限公司提供的豆包大模型）进行分析处理；分析结果仅用于向你返回评分与建议内容。',
      '3. 除上述目的及法律法规另有规定外，我们不会将你的个人信息用于其他用途，也不会出售你的个人信息。',
    ],
  },
  {
    title: '四、信息的存储与保护',
    paragraphs: [
      '1. 你的信息存储于中华人民共和国境内的安全服务器中，我们采取合理的技术与管理措施保护你的信息安全。',
      '2. 你的登录凭证（Token）仅存储在你的设备本地，有效期为 7 天，过期后需重新登录。',
      '3. 分享内容自创建之日起保留 180 天，过期后自动删除。',
    ],
  },
  {
    title: '五、你的权利',
    paragraphs: [
      '1. 你可以在「我的」页面查看和管理你的档案信息；',
      '2. 你可以随时删除你的档案和历史记录；',
      '3. 你可以通过退出登录清除本设备上的登录状态；',
      '4. 如需注销账号、撤回授权或删除全部数据，请通过本指引末尾的联系方式联系我们。',
    ],
  },
  {
    title: '六、未成年人保护',
    paragraphs: [
      '本服务不面向未满 14 周岁的未成年人。如果你是未成年人的监护人，请确保被监护人在你的监护和指导下使用本服务，并仅在使用前征得你的同意。',
    ],
  },
  {
    title: '七、本指引的更新',
    paragraphs: [
      '我们可能会适时更新本指引。当发生重大变更时，我们会在你下次启动小程序时重新征得你的同意。',
    ],
  },
  {
    title: '八、联系我们',
    paragraphs: [
      '吉林省传学文化传播有限公司',
      '联系电话：13651309404',
      '如你对本指引有任何疑问、意见或建议，可通过上述电话与我们联系。',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollView scrollY className="h-screen">
        <View className="px-5 py-6 pb-12">
          <Text className="block text-xl font-bold text-gray-900">用户隐私保护指引</Text>
          <Text className="mt-2 block text-xs text-gray-400">版本：{CURRENT_PRIVACY_VERSION} · 更新日期：2026-08-26</Text>

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