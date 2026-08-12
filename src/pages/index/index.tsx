import { View, Text, Picker, Image } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Rocket, Venus, Mars, ChevronDown } from 'lucide-react-taro'
import { Network } from '@/network'
import logoPng from '@/assets/logo-brand.png'
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

const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉',
  '南京', '天津', '苏州', '西安', '长沙', '沈阳', '青岛', '郑州',
  '大连', '东莞', '宁波', '厦门', '福州', '无锡', '合肥', '昆明',
  '哈尔滨', '济南', '佛山', '长春', '温州', '石家庄', '南宁', '常州',
  '泉州', '南昌', '贵阳', '太原', '烟台', '嘉兴', '南通', '金华',
  '珠海', '惠州', '徐州', '海口', '乌鲁木齐', '绍兴', '中山', '台州',
  '兰州', '呼和浩特',
]

const DEFAULT_NICKNAMES = [
  'La Vie', "C'est la vie", 'Belle', 'Douceur', 'Étoile',
  'Aurora', 'Luna', 'Stella', 'Flora', 'Iris',
  '莫奈的睡莲', '梵高的星空', '德加的舞女', '日落大道', '比弗利山',
  '塞纳河畔', '左岸咖啡', '蒙马特', '波西米亚', '西西里',
]

const getRandomNickname = () => DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)]

const IndexPage = () => {
  const [nickname, setNickname] = useState(getRandomNickname())
  const [gender, setGender] = useState('female')
  const [calendarType, setCalendarType] = useState('solar')
  const [birthDate, setBirthDate] = useState('2000-01-01')
  const [shichenIndex, setShichenIndex] = useState(-1)
  const [cityIndex, setCityIndex] = useState(0)
  const [features, setFeatures] = useState({ showHomeSubtitle: true })

  useShareAppMessage(() => ({
    title: '测一测你的幸运穿搭',
    path: '/pages/index/index',
    imageUrl: '/share-cover.jpg',
  }))

  useShareTimeline(() => ({
    title: '测一测你的幸运穿搭',
    imageUrl: '/share-cover.jpg',
  }))

  Taro.useDidShow(() => {
    try {
      const saved = Taro.getStorageSync('formData')
      if (saved) {
        setNickname(saved.nickname || getRandomNickname())
        setGender(saved.gender || 'female')
        setCalendarType(saved.calendarType || 'solar')
        setBirthDate(saved.birthDate || '2000-01-01')
        const si = SHICHEN_OPTIONS.findIndex(s => s.includes(saved.birthTime || ''))
        setShichenIndex(si >= 0 ? si : -1)
        const ci = CITIES.findIndex(c => c === saved.location)
        setCityIndex(ci >= 0 ? ci : 0)
      }
    } catch (e) {
      // ignore
    }

    Network.request({ url: '/api/config/features' }).then((res: any) => {
      console.log('Features config:', res.data)
      if (res.data?.data?.features) {
        setFeatures(res.data.data.features)
      }
    }).catch(err => {
      console.error('Failed to load features:', err)
    })
  })

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
      Taro.showToast({ title: '选择时辰，未知选午时', icon: 'none' })
      return
    }

    const userData = {
      nickname: nickname.trim(),
      gender,
      calendarType,
      birthDate,
      birthTime: SHICHEN_OPTIONS[shichenIndex],
      location: CITIES[cityIndex],
    }

    Taro.setStorageSync('formData', userData)
    Taro.setStorageSync('userData', userData)
    Taro.navigateTo({ url: '/pages/loading/index' })
  }

  return (
    <View className="min-h-full bg-white px-6 py-6">
      {/* Header */}
      <View className="flex flex-col items-center pt-8 pb-8">
        <Image src={logoPng} className="w-24 h-24 mb-3" mode="aspectFit" />
        {features.showHomeSubtitle && (
          <Text className="block text-sm text-gray-400">
            填写个人信息 · 推荐每日穿搭
          </Text>
        )}
      </View>

      {/* Form */}
      <View className="flex flex-col gap-5">
        {/* Nickname */}
        <View>
          <Text className="block text-sm text-gray-500 mb-2">昵称</Text>
          <View className="bg-gray-50 rounded-xl px-4 py-3">
            <Input
              className="w-full bg-transparent border-0 text-gray-900 placeholder:text-gray-400"
              placeholder="请输入昵称"
              value={nickname}
              onInput={(e) => setNickname(e.detail.value)}
            />
          </View>
        </View>

        {/* Gender */}
        <View>
          <Text className="block text-sm text-gray-500 mb-2">性别</Text>
          <View className="flex gap-3">
            <View
              className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 ${
                gender === 'female'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              onClick={() => setGender('female')}
            >
              <Venus size={20} color={gender === 'female' ? '#1F2937' : '#9CA3AF'} />
              <Text className={`block ml-2 text-base font-medium ${gender === 'female' ? 'text-gray-900' : 'text-gray-500'}`}>女</Text>
            </View>
            <View
              className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 ${
                gender === 'male'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              onClick={() => setGender('male')}
            >
              <Mars size={20} color={gender === 'male' ? '#1F2937' : '#9CA3AF'} />
              <Text className={`block ml-2 text-base font-medium ${gender === 'male' ? 'text-gray-900' : 'text-gray-500'}`}>男</Text>
            </View>
          </View>
        </View>

        {/* Calendar Type + Birth Date */}
        <View>
          <Text className="block text-sm text-gray-500 mb-2">出生日期</Text>
          <View className="flex gap-3 mb-3">
            <View
              className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 ${
                calendarType === 'solar'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              onClick={() => setCalendarType('solar')}
            >
              <Text className={`block text-base font-medium ${calendarType === 'solar' ? 'text-gray-900' : 'text-gray-500'}`}>阳历</Text>
            </View>
            <View
              className={`flex-1 flex items-center justify-center py-3 rounded-xl border-2 ${
                calendarType === 'lunar'
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              onClick={() => setCalendarType('lunar')}
            >
              <Text className={`block text-base font-medium ${calendarType === 'lunar' ? 'text-gray-900' : 'text-gray-500'}`}>农历</Text>
            </View>
          </View>
          <Picker
            mode="date"
            start="1940-01-01"
            end="2025-12-31"
            value={birthDate}
            onChange={(e) => setBirthDate(e.detail.value)}
          >
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <Text className={`block ${birthDate ? 'text-gray-900' : 'text-gray-400'}`}>
                {birthDate || '请选择出生日期'}
              </Text>
              <ChevronDown size={18} color="#9CA3AF" />
            </View>
          </Picker>
        </View>

        {/* Birth Time */}
        <View>
          <Text className="block text-sm text-gray-500 mb-2">出生时辰</Text>
          <Picker
            mode="selector"
            range={SHICHEN_OPTIONS}
            value={shichenIndex}
            onChange={(e) => setShichenIndex(Number(e.detail.value))}
          >
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <Text className={`block ${shichenIndex >= 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {shichenIndex >= 0 ? SHICHEN_OPTIONS[shichenIndex] : '选择时辰，未知选午时'}
              </Text>
              <ChevronDown size={18} color="#9CA3AF" />
            </View>
          </Picker>
        </View>

        {/* City */}
        <View>
          <Text className="block text-sm text-gray-500 mb-2">出生城市</Text>
          <Picker
            mode="selector"
            range={CITIES}
            value={cityIndex}
            onChange={(e) => setCityIndex(Number(e.detail.value))}
          >
            <View className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <Text className="block text-gray-900">{CITIES[cityIndex]}</Text>
              <ChevronDown size={18} color="#9CA3AF" />
            </View>
          </Picker>
        </View>

        {/* Submit Button */}
        <View className="pt-2 pb-8">
          <Button
            className="w-full text-white font-bold py-4 rounded-xl text-base border-0 shadow-sm"
            style={{ background: '#1F2937' }}
            onClick={handleSubmit}
          >
            <Rocket size={18} color="#ffffff" />
            <Text className="ml-2 text-white font-bold">开始勾画</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default IndexPage
