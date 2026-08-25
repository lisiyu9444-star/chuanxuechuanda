import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Canvas } from '@tarojs/components'
import { Save, RotateCcw, Share2 } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import type { FashionRatingResult } from '@/types/fashion'

interface FashionPosterProps {
  /** 穿搭照（TOS 公网 URL） */
  imageUrl: string
  /** 评分结果 */
  result: FashionRatingResult
  /** 再测一次回调（记录页重现时不传，隐藏该按钮） */
  onRetry?: () => void
}

/** 海报画布逻辑尺寸（px，绘制时按 dpr 放大）。
    高度 736：点评 3 行末行基线 672 + 品牌字基线 712（间距 40）+ 底边距 24，
    避免点评与底部品牌字之间出现大段空白 */
const CANVAS_W = 375
const CANVAS_H = 736
/** 照片卡：与页面端一致的边距与 3:4 竖版比例 */
const CARD_X = 24
const CARD_Y = 16
const CARD_W = CANVAS_W - CARD_X * 2
const CARD_H = Math.round((CARD_W * 4) / 3)
/** 分数相对照片上移距离（页面端 -mt-12 对应 48px，压入底部渐隐遮罩） */
const SCORE_OVERLAP = 48

/** 圆角矩形路径（兼容无 roundRect 的基础库） */
function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 长文本按宽度断行，最多 maxLines 行 */
function wrapLines(ctx: any, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    if (ctx.measureText(current + ch).width > maxWidth && current) {
      lines.push(current)
      current = ch
      if (lines.length >= maxLines) break
    } else {
      current += ch
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  return lines
}

/**
 * 时尚测评结果海报（黑色高级风）。
 * 照片卡固定 3:4 竖版（手机拍照比例），任意比例照片统一居中裁剪；
 * 页面端与保存图片共用同一布局：大图渐隐 + 分数上压遮罩 + 衬线粗体分数 + 等级 + 人格 + 毒舌点评。
 */
export function FashionPoster({ imageUrl, result, onRetry }: FashionPosterProps) {
  const [saving, setSaving] = useState(false)
  // 照片卡固定 3:4 竖版：屏宽减去页面两侧 px-6 边距后按比例计算高度
  // （跨端兼容修正：小程序端 padding 百分比/宽高比类不可靠，用计算值固定容器高度）
  const windowWidth = Taro.getWindowInfo?.().windowWidth || 375
  const cardHeight = Math.round(((windowWidth - 48) * 4) / 3)

  /** 将海报绘制到离屏 canvas 并保存到相册（H5 降级为长按截图提示） */
  const handleSave = async () => {
    if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
      Taro.showToast({ title: '请长按截图保存图片', icon: 'none' })
      return
    }
    if (saving) return
    setSaving(true)
    try {
      // 1. 下载穿搭照到本地（绘制网络图必须先取本地路径）
      const imgInfo = await Taro.getImageInfo({ src: imageUrl })

      // 2. 获取 canvas 2d 节点
      const page = Taro.getCurrentInstance().page
      const nodeRes = await new Promise<any>((resolve, reject) => {
        Taro.createSelectorQuery()
          .in(page as any)
          .select('#fashion-poster-canvas')
          .fields({ node: true, size: true })
          .exec((r) => (r?.[0]?.node ? resolve(r[0]) : reject(new Error('canvas node not found'))))
      })
      const canvas = nodeRes.node
      const dpr = (Taro.getWindowInfo?.().pixelRatio as number) || 2
      canvas.width = CANVAS_W * dpr
      canvas.height = CANVAS_H * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      // 3. 加载图片
      const img = canvas.createImage()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load failed'))
        img.src = imgInfo.path
      })

      // 4. 绘制
      drawPoster(ctx, img)

      // 5. 导出并保存相册
      const temp = await Taro.canvasToTempFilePath({ canvas, canvasId: 'fashion-poster-canvas' })
      await Taro.saveImageToPhotosAlbum({ filePath: temp.tempFilePath })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      console.error('[FashionPoster] save failed:', error)
      const msg = String(error?.errMsg || '')
      if (msg.includes('auth') || msg.includes('authorize') || msg.includes('deny')) {
        Taro.showToast({ title: '请授权相册权限后重试', icon: 'none' })
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  /** 实际绘制逻辑（375x800 逻辑坐标系，与页面端布局保持一致） */
  const drawPoster = (ctx: any, img: any) => {
    // 黑底
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 照片卡：3:4 竖版圆角卡，任意比例照片 cover 居中裁剪
    const imgRatio = img.width / img.height
    const cardRatio = CARD_W / CARD_H
    let sx = 0
    let sy = 0
    let sw = img.width
    let sh = img.height
    if (imgRatio > cardRatio) {
      sw = img.height * cardRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / cardRatio
      sy = (img.height - sh) / 2
    }
    ctx.save()
    roundRectPath(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24)
    ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, CARD_X, CARD_Y, CARD_W, CARD_H)
    // 图片底部黑色渐变遮罩（与页面端一致：60% 高度渐隐融入背景）
    const gradient = ctx.createLinearGradient(0, CARD_Y + CARD_H * 0.4, 0, CARD_Y + CARD_H)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.6, 'rgba(0,0,0,0.6)')
    gradient.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = gradient
    ctx.fillRect(CARD_X, CARD_Y + CARD_H * 0.4, CARD_W, CARD_H * 0.6)
    ctx.restore()

    ctx.textAlign = 'center'
    const cx = CANVAS_W / 2
    // 分数基线：上移 SCORE_OVERLAP，使字体顶部略压入照片遮罩（与页面端一致）
    const scoreY = CARD_Y + CARD_H + 108 - SCORE_OVERLAP

    // 分数：超大衬线粗体白字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 88px Georgia, "Times New Roman", serif'
    ctx.fillText(result.isInvalid ? '--' : String(result.totalScore), cx, scoreY)

    // 等级
    ctx.font = '16px "Helvetica Neue", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(result.level, cx, scoreY + 40)

    // 风格人格
    ctx.font = '500 22px "Helvetica Neue", sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(result.stylePersonality, cx, scoreY + 80)

    // 毒舌点评（灰色斜体，自动换行，最多 3 行；服务端已限制 wittyComment ≤54 字，3 行可完整展示）
    ctx.font = 'italic 14px "Helvetica Neue", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    const lines = wrapLines(ctx, `“${result.wittyComment}”`, CANVAS_W - 96, 3)
    lines.forEach((line, i) => ctx.fillText(line, cx, scoreY + 116 + i * 22))

    // 底部品牌小字
    ctx.font = '10px "Helvetica Neue", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillText('传学幸运穿搭', cx, CANVAS_H - 24)
  }

  return (
    <View className="w-full flex flex-col items-center">
      {/* 图片质量提示（模糊/光线差） */}
      {result.imageWarning && (
        <Text className="block text-xs text-amber-400 text-center mb-4 px-6">{result.imageWarning}</Text>
      )}

      {/* 照片卡：固定 3:4 竖版容器（计算高度），任意比例照片统一居中裁剪 + 底部渐隐遮罩。
          容器垫 bg-black：小程序端原生 image 圆角裁剪有缝隙，露出底色时用黑色填充而非白色 */}
      <View className="w-full rounded-3xl overflow-hidden relative bg-black" style={{ height: `${cardHeight}px` }}>
        <Image src={imageUrl} mode="aspectFill" className="w-full h-full block" />
        {/* 底部渐隐遮罩：60% 高度。透明度渐变用内联样式（小程序端 Tailwind 颜色透明度简写 opacity 会丢失，与 canvas 绘制保持一致） */}
        <View
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.6) 60%, transparent 100%)' }}
        />
      </View>

      {/* 分数：上移压入遮罩，衬线粗体个性数字 */}
      <Text className="block text-8xl font-display font-bold text-white leading-none -mt-12 relative z-10">
        {result.isInvalid ? '--' : result.totalScore}
      </Text>
      {/* 等级 */}
      <Text className="block text-lg text-white text-opacity-80 mt-3">{result.level}</Text>
      {/* 风格人格 */}
      <Text className="block text-xl font-medium text-white mt-2">{result.stylePersonality}</Text>
      {/* 毒舌点评 */}
      <Text className="block text-sm italic text-white text-opacity-50 text-center mt-4 max-w-72 leading-relaxed">
        “{result.wittyComment}”
      </Text>

      {/* 操作区：三个纯图标按钮一行居中（无文字、无边框） */}
      <View className="flex items-center justify-center gap-16 mt-10">
        <Button
          variant="ghost"
          className="h-auto w-auto p-2 bg-transparent border-none shadow-none"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={22} color="rgba(255,255,255,0.8)" />
        </Button>
        {onRetry && (
          <Button
            variant="ghost"
            className="h-auto w-auto p-2 bg-transparent border-none shadow-none"
            onClick={onRetry}
          >
            <RotateCcw size={22} color="rgba(255,255,255,0.8)" />
          </Button>
        )}
        <Button
          variant="ghost"
          openType="share"
          className="h-auto w-auto p-2 bg-transparent border-none shadow-none after:hidden"
        >
          <Share2 size={22} color="rgba(255,255,255,0.8)" />
        </Button>
      </View>

      {/* 底部品牌落款（与保存图片一致） */}
      <Text className="block text-xs text-white text-opacity-30 tracking-[0.3em] mt-8">传学幸运穿搭</Text>

      {/* 离屏画布：保存卡片用（视觉不可见但保持渲染） */}
      <Canvas
        type="2d"
        id="fashion-poster-canvas"
        canvasId="fashion-poster-canvas"
        className="fixed top-0 left-0 pointer-events-none opacity-0"
        style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, transform: 'translateX(-200%)' }}
      />
    </View>
  )
}
