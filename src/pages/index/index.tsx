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
  const [birthDate, setBirthDate] = useState('2000-01-01')
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
    <View className="min-h-full bg-white px-6 py-6">
      {/* Header */}
      <View className="flex flex-col items-center pt-8 pb-8">
        <View className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4">
          <Sparkles size={28} color="#ffffff" />
        </View>
        <Text className="block text-xl font-bold text-gray-900 mb-1">AI五行穿搭</Text>
        <Text className="block text-sm text-gray-400">
          根据你的八字 · 推荐每日穿搭
        </Text>
      </View>

      {/* Form */}
      <View className="flex flex-col gap-4">
        {/* Nickname */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-gray-500 mb-2">
              你的昵称
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent text-gray-900 placeholder:text-gray-400"
                placeholder="请输入昵称"
                value={nickname}
                onInput={(e) => setNickname(e.detail.value)}
              />
            </View>
          </CardContent>
        </Card>

        {/* Gender */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-gray-500 mb-2">
              你的性别
            </Text>
            <RadioGroup
              value={gender}
              onValueChange={(val) => setGender(val)}
              className="flex gap-3"
            >
              <View className="flex-1 flex items-center justify-center py-3 rounded-xl bg-gray-50 border border-gray-100 data-[state=checked]:border-indigo-400 data-[state=checked]:bg-indigo-50">
                <RadioGroupItem value="male" className="border-gray-300 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500" />
                <Text className="block ml-2 text-gray-700 text-sm">男</Text>
              </View>
              <View className="flex-1 flex items-center justify-center py-3 rounded-xl bg-gray-50 border border-gray-100 data-[state=checked]:border-indigo-400 data-[state=checked]:bg-indigo-50">
                <RadioGroupItem value="female" className="border-gray-300 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500" />
                <Text className="block ml-2 text-gray-700 text-sm">女</Text>
              </View>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Birth Date */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-gray-500 mb-2">
              出生日期
            </Text>
            <Picker
              mode="date"
              start="1940-01-01"
              end="2025-12-31"
              value={birthDate}
              onChange={(e) => setBirthDate(e.detail.value)}
            >
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Text
                  className={
                    birthDate
                      ? 'block text-gray-900'
                      : 'block text-gray-400'
                  }
                >
                  {birthDate || '请选择出生日期'}
                </Text>
              </View>
            </Picker>
          </CardContent>
        </Card>

        {/* Birth Time (时辰) */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-gray-500 mb-2">
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
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Text
                  className={
                    shichenIndex >= 0
                      ? 'block text-gray-900'
                      : 'block text-gray-400'
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
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <Text className="block text-sm text-gray-500 mb-2">
              所在城市
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <MapPin size={16} color="#9ca3af" />
              <Input
                className="flex-1 bg-transparent text-gray-900 placeholder:text-gray-400"
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
            className="w-full bg-indigo-500 text-white font-bold py-4 rounded-xl text-base border-0 shadow-sm"
            onClick={handleSubmit}
          >
            <Sparkles size={18} color="#ffffff" />
            <Text className="ml-2 text-white font-bold">开始推演</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default IndexPage
