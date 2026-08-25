import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { ChevronLeft, ChevronRight, Shirt } from 'lucide-react-taro'
import { Network } from '@/network'
import { isLoggedIn } from '@/utils/auth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FashionPoster } from '@/components/fashion-poster'
import type { FashionRatingRecord } from '@/types/fashion'

/** 时间戳 → 'YYYY-MM-DD HH:mm' */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function FashionRatingHistoryPage() {
  const [records, setRecords] = useState<FashionRatingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FashionRatingRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const fetchList = useCallback(async () => {
    if (!isLoggedIn()) {
      setLoading(false)
      return
    }
    try {
      const res = await Network.request({ url: '/api/fashion-rating/list' })
      console.log('[FashionHistory] list response:', res.data)
      const list = res.data?.data?.list
      if (Array.isArray(list)) setRecords(list)
    } catch (error) {
      console.error('[FashionHistory] fetch list failed:', error)
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    // 入口（我的页）已做登录拦截；此处防御未登录直达场景
    if (!isLoggedIn()) {
      Taro.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
      setTimeout(() => Taro.navigateBack(), 1200)
      return
    }
    setLoading(true)
    fetchList()
  })

  // 导航栏配色跟随页面状态：海报重现态黑底白字，列表态白底黑字
  useEffect(() => {
    // nextTick 确保页面 root view 就绪，避免 removeTextView:fail 报错
    Taro.nextTick(() => {
      Taro.setNavigationBarColor(
        selected
          ? { frontColor: '#ffffff', backgroundColor: '#000000' }
          : { frontColor: '#000000', backgroundColor: '#ffffff' },
      ).catch((e) => {
        console.warn('[FashionHistory] setNavigationBarColor failed:', e)
      })
    })
  }, [selected])

  /** 长按删除：确认后调 DELETE 接口并从列表移除 */
  const handleDelete = async () => {
    if (!deletingId || deleteSubmitting) return
    setDeleteSubmitting(true)
    try {
      const res = await Network.request({ url: `/api/fashion-rating/${deletingId}`, method: 'DELETE' })
      console.log('[FashionHistory] delete response:', res.data)
      if (res.data?.data?.success) {
        setRecords((prev) => prev.filter((r) => r.id !== deletingId))
        Taro.showToast({ title: '已删除', icon: 'success' })
      } else {
        Taro.showToast({ title: '记录不存在或已删除', icon: 'none' })
      }
    } catch (error) {
      console.error('[FashionHistory] delete failed:', error)
      Taro.showToast({ title: '删除失败，请重试', icon: 'none' })
    } finally {
      setDeleteSubmitting(false)
      setDeletingId(null)
    }
  }

  // 分享：重现态分享当前记录（带 shareId，好友打开直达结果海报），列表态分享邀请语
  useShareAppMessage(() => {
    if (selected) {
      const { totalScore, stylePersonality, shareTexts, isInvalid } = selected.result
      const text = totalScore >= 80 ? shareTexts?.confident : shareTexts?.selfDeprecating
      return {
        title: isInvalid ? 'AI 毒舌时尚官，敢不敢晒出你的穿搭？' : text || `我的穿搭得了 ${totalScore} 分，被评为"${stylePersonality}"，你敢来挑战吗？`,
        // 指向分享中间页（非 tabBar 页面）：tabBar 页面分享打开时 query 参数可能丢失
        path: `/pages/fashion-share/index?shareId=${selected.id}`,
        imageUrl: selected.imageUrl,
      }
    }
    return {
      title: 'AI 毒舌时尚官，敢不敢晒出你的穿搭？',
      path: '/pages/fashion-rating/index',
    }
  })

  // ===== 海报重现态：黑底 + 顶部返回 =====
  if (selected) {
    return (
      <View className="min-h-screen bg-black flex flex-col px-6 pb-10">
        <View className="flex items-center h-12" onClick={() => setSelected(null)}>
          <ChevronLeft size={22} color="rgba(255,255,255,0.8)" />
          <Text className="text-sm text-white text-opacity-80 ml-1">返回列表</Text>
        </View>
        <View className="mt-2">
          <FashionPoster imageUrl={selected.imageUrl} result={selected.result} />
        </View>
      </View>
    )
  }

  // ===== 列表态（白底黑字，与其他页面风格一致） =====
  return (
    <View className="min-h-screen bg-background flex flex-col">
      <View className="flex-1 px-4 pt-4">
        {loading ? (
          // 加载骨架屏
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-3 mb-3">
                <View className="w-16 shrink-0 rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                  <Skeleton className="w-full h-full" />
                </View>
                <View className="flex-1">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-4 w-32 rounded mt-2" />
                  <Skeleton className="h-3 w-20 rounded mt-2" />
                </View>
              </View>
            ))}
          </>
        ) : records.length === 0 ? (
          // 空态：引导去测评
          <View className="flex flex-col items-center pt-32">
            <Shirt size={56} color="#94a3b8" />
            <Text className="block text-base text-muted-foreground mt-4">还没有测评记录</Text>
            <Text className="block text-xs text-muted-foreground mt-2">上传穿搭照片，让 AI 毒舌点评一下</Text>
            <Button
              className="mt-8 rounded-full px-8"
              onClick={() => Taro.switchTab({ url: '/pages/fashion-rating/index' })}
            >
              <Text>去测评</Text>
            </Button>
          </View>
        ) : (
          // 记录列表：点击重现海报，长按删除
          <>
            {records.map((record) => (
              <View
                key={record.id}
                className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-3 mb-3 active:opacity-80"
                onClick={() => setSelected(record)}
                onLongPress={() => setDeletingId(record.id)}
              >
                {/* 缩略图：固定 3:4 竖版容器（aspect-ratio 样式，跨端兼容修正），任意比例照片统一裁剪 */}
                <View className="w-16 shrink-0 rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '3/4' }}>
                  <Image src={record.imageUrl} mode="aspectFill" className="w-full h-full block" />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex items-baseline gap-2">
                    <Text className="text-3xl font-bold text-foreground">
                      {record.result.isInvalid ? '--' : record.result.totalScore}
                    </Text>
                    <Text className="text-sm text-muted-foreground">{record.result.level}</Text>
                  </View>
                  <Text className="block text-sm text-foreground mt-1 truncate">{record.result.stylePersonality}</Text>
                  <Text className="block text-xs text-muted-foreground mt-1">{formatTime(record.createdAt)}</Text>
                </View>
                <ChevronRight size={16} color="#9ca3af" />
              </View>
            ))}
            <Text className="block text-xs text-muted-foreground text-center mt-2 pb-6">长按记录可删除</Text>
          </>
        )}
      </View>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条测评记录？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复，确定要删除吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {deleteSubmitting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
