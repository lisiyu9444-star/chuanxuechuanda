import { View, Text, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sparkles, MapPin } from 'lucide-react-taro'
import './index.css'

const SHICHEN_OPTIONS = [
  '子时 (23:00-01:00)',
  '丑时 (01:00-03:00)',
  '寅时 (03:00-05:00)',
  '卯时 (05:00-07:00)',
  '辰时 (07:00-09:00)',
  '巳时 (09:00-11:00)',
  '午时 (11:00-13:00)',
  '未时 (13:00-15:00)',
  '申时 (15:00-17:00)',
  '酉时 (17:00-19:00)',
  '戌时 (19:00-21:00)',
  '亥时 (21:00-23:00)',
]

const IndexPage = () => {
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('male')
  const [birthDate, setBirthDate] = useState('')
  const [shichenIndex, setShichenIndex] = useState(-1)
  const [location, setLocation] = useState('')

  const handleSubmit = () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }
    if (shichenIndex < 0) {
      Taro.showToast({ title: '请选择出生时辰', icon: 'none' })
      return
    }
    if (!location.trim()) {
      Taro.showToast({ title: '请输入所在城市', icon: 'none' })
      return
    }

    const userData = {
      nickname: nickname.trim(),
      gender,
      birthDate,
      birthTime: SHICHEN_OPTIONS[shichenIndex],
      location: location.trim(),
    }

    Taro.setStorageSync('userData', userData)
    Taro.navigateTo({ url: '/pages/loading/index' })
  }

  return (
    <View className="min-h-full bg-[#0d1117] px-6 py-8">
      {/* Header */}
      <View className="flex flex-col items-center pt-8 pb-10">
        <View className="w-16 h-16 rounded-full bg-[#161b22] border border-[#c9a96e] flex items-center justify-center mb-4">
          <Sparkles size={28} color="#c9a96e" />
        </View>
        <Text className="block text-2xl font-serif text-[#c9a96e] mb-2">天命穿搭</Text>
        <Text className="block text-sm text-[#8b8680]">
          洞察八字玄机 · 定制每日穿搭
        </Text>
      </View>

      {/* Form */}
      <View className="flex flex-col gap-5">
        {/* Nickname */}
        <Card className="bg-[#161b22] border-[#2a2a35]">
          <CardContent className="p-5">
            <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
              您的昵称
            </Text>
            <View className="bg-[#1a1f28] rounded-lg px-4 py-3">
              <Input
                className="w-full bg-transparent text-[#f0ebe3] placeholder:text-[#8b8680]"
                placeholder="请输入昵称"
                value={nickname}
                onInput={(e) => setNickname(e.detail.value)}
              />
            </View>
          </CardContent>
        </Card>

        {/* Gender */}
        <Card className="bg-[#161b22] border-[#2a2a35]">
          <CardContent className="p-5">
            <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
              您的性别
            </Text>
            <RadioGroup
              value={gender}
              onValueChange={(val) => setGender(val)}
              className="flex gap-4"
            >
              <View className="flex-1 flex items-center justify-center py-3 rounded-lg bg-[#1a1f28] border border-[#2a2a35] data-[state=checked]:border-[#c9a96e] data-[state=checked]:bg-[#1a1f28]">
                <RadioGroupItem value="male" className="border-[#8b8680] data-[state=checked]:border-[#c9a96e] data-[state=checked]:bg-[#c9a96e]" />
                <Text className="block ml-2 text-[#f0ebe3]">男</Text>
              </View>
              <View className="flex-1 flex items-center justify-center py-3 rounded-lg bg-[#1a1f28] border border-[#2a2a35] data-[state=checked]:border-[#c9a96e] data-[state=checked]:bg-[#1a1f28]">
                <RadioGroupItem value="female" className="border-[#8b8680] data-[state=checked]:border-[#c9a96e] data-[state=checked]:bg-[#c9a96e]" />
                <Text className="block ml-2 text-[#f0ebe3]">女</Text>
              </View>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Birth Date */}
        <Card className="bg-[#161b22] border-[#2a2a35]">
          <CardContent className="p-5">
            <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
              出生日期
            </Text>
            <Picker
              mode="date"
              start="1940-01-01"
              end="2025-12-31"
              value={birthDate}
              onChange={(e) => setBirthDate(e.detail.value)}
            >
              <View className="bg-[#1a1f28] rounded-lg px-4 py-3">
                <Text
                  className={
                    birthDate
                      ? 'block text-[#f0ebe3]'
                      : 'block text-[#8b8680]'
                  }
                >
                  {birthDate || '请选择出生日期'}
                </Text>
              </View>
            </Picker>
          </CardContent>
        </Card>

        {/* Birth Time (时辰) */}
        <Card className="bg-[#161b22] border-[#2a2a35]">
          <CardContent className="p-5">
            <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
              出生时辰
            </Text>
            <Picker
              mode="selector"
              range={SHICHEN_OPTIONS}
              value={shichenIndex}
              onChange={(e) =>
                setShichenIndex(Number(e.detail.value))
              }
            >
              <View className="bg-[#1a1f28] rounded-lg px-4 py-3">
                <Text
                  className={
                    shichenIndex >= 0
                      ? 'block text-[#f0ebe3]'
                      : 'block text-[#8b8680]'
                  }
                >
                  {shichenIndex >= 0
                    ? SHICHEN_OPTIONS[shichenIndex]
                    : '请选择出生时辰'}
                </Text>
              </View>
            </Picker>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="bg-[#161b22] border-[#2a2a35]">
          <CardContent className="p-5">
            <Text className="block text-sm text-[#c9a96e] mb-3 font-serif">
              所在城市
            </Text>
            <View className="bg-[#1a1f28] rounded-lg px-4 py-3 flex items-center gap-2">
              <MapPin size={16} color="#8b8680" />
              <Input
                className="flex-1 bg-transparent text-[#f0ebe3] placeholder:text-[#8b8680]"
                placeholder="请输入所在城市"
                value={location}
                onInput={(e) => setLocation(e.detail.value)}
              />
            </View>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <View className="pt-2 pb-8">
          <Button
            className="w-full bg-[#c9a96e] text-[#0d1117] font-bold py-4 rounded-lg text-base border-0"
            onClick={handleSubmit}
          >
            <Sparkles size={18} color="#0d1117" />
            <Text className="ml-2 text-[#0d1117] font-bold">开始推演</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default IndexPage
