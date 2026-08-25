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
    高度 700：点评 3 行末行基线 636 + 品牌字基线 676（间距 40）+ 底边距 24，
    避免点评与底部品牌字之间出现大段空白（等级印章移至照片右上角后布局收紧） */
const CANVAS_W = 375
const CANVAS_H = 700
/** 照片卡：与页面端一致的边距与 3:4 竖版比例 */
const CARD_X = 24
const CARD_Y = 16
const CARD_W = CANVAS_W - CARD_X * 2
const CARD_H = Math.round((CARD_W * 4) / 3)
/** 分数相对照片上移距离（页面端 -mt-12 对应 48px，压入底部渐隐遮罩） */
const SCORE_OVERLAP = 48

/** 分数 → 印章印色（≥90 鎏金 / 70-89 朱砂红 / 65-69 橙红 / <65 瓦灰） */
function stampColorOf(score: number): string {
  if (score >= 90) return '#fbbf24'
  if (score >= 70) return '#dc2626'
  if (score >= 65) return '#ea580c'
  return '#6b7280'
}

/** 回纹（雷纹）单元模板：连续 Greek key 折线（归一化坐标，x 沿弧向 0..1、y 沿径向 0..1） */
const GREEK_MOTIF: Array<[number, number]> = [
  [0, 0.5], [0.8, 0.5], [0.8, 0.15], [0.25, 0.15], [0.25, 0.65],
  [0.55, 0.65], [0.55, 0.35], [0.4, 0.35], [0.4, 0.5], [1, 0.5],
]
const GREEK_UNITS = 20

/** 回纹环极坐标映射：单元 u 内模板点 (tx, ty) → 画布坐标 */
function greekPoint(cx: number, cy: number, ringR: number, band: number, angle: number, ty: number): [number, number] {
  const r = ringR + (ty - 0.5) * band
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

/** 页面端印章环 SVG（回纹环 + 内外细圈，除线条外全透明）→ data-uri（与 canvas 绘制同算法） */
function buildStampRingUri(color: string): string {
  const step = (Math.PI * 2) / GREEK_UNITS
  let d = ''
  for (let u = 0; u < GREEK_UNITS; u++) {
    GREEK_MOTIF.forEach(([tx, ty], i) => {
      const [x, y] = greekPoint(60, 60, 50, 14, (u + tx) * step - Math.PI / 2, ty)
      d += `${u === 0 && i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<circle cx="60" cy="60" r="58" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `<path d="${d}Z" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<circle cx="60" cy="60" r="42" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

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
  // 印章：印色（按分数段分级）与回纹环 data-uri（与 canvas 绘制同算法）
  const stampColor = stampColorOf(result.totalScore)
  const stampRingUri = buildStampRingUri(stampColor)

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

  /** 实际绘制逻辑（375x700 逻辑坐标系，与页面端布局保持一致） */
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

    // 等级印章：圆形朱文印盖在照片右上角（回纹环 + 内外细圈 + 2×2 四字，与页面端同算法同位置）
    if (!result.isInvalid) {
      const R = 48
      ctx.save()
      ctx.translate(CARD_X + CARD_W - R - 12, CARD_Y + R + 12)
      ctx.rotate((-12 * Math.PI) / 180)
      ctx.strokeStyle = stampColor
      // 外细圈
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(0, 0, R * (58 / 60), 0, Math.PI * 2)
      ctx.stroke()
      // 回纹环
      ctx.lineWidth = 2
      ctx.beginPath()
      const step = (Math.PI * 2) / GREEK_UNITS
      for (let u = 0; u < GREEK_UNITS; u++) {
        GREEK_MOTIF.forEach(([tx, ty], i) => {
          const [x, y] = greekPoint(0, 0, R * (50 / 60), R * (14 / 60), (u + tx) * step - Math.PI / 2, ty)
          if (u === 0 && i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
      }
      ctx.closePath()
      ctx.stroke()
      // 内细圈
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(0, 0, R * (42 / 60), 0, Math.PI * 2)
      ctx.stroke()
      // 2×2 四字（衬线粗体）
      ctx.fillStyle = stampColor
      ctx.font = 'bold 19px "Noto Serif SC", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(result.level.slice(0, 2), 0, -10)
      ctx.fillText(result.level.slice(2, 4), 0, 12)
      ctx.restore()
      ctx.textBaseline = 'alphabetic'
    }

    ctx.textAlign = 'center'
    const cx = CANVAS_W / 2
    // 分数基线：上移 SCORE_OVERLAP，使字体顶部略压入照片遮罩（与页面端一致）
    const scoreY = CARD_Y + CARD_H + 108 - SCORE_OVERLAP

    // 分数：超大衬线粗体白字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 88px Georgia, "Times New Roman", serif'
    ctx.fillText(result.isInvalid ? '--' : String(result.totalScore), cx, scoreY)

    // 风格人格（等级印章移至照片右上角后，间距收紧与页面端一致）
    ctx.font = '500 22px "Helvetica Neue", sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(result.stylePersonality, cx, scoreY + 44)

    // 毒舌点评（灰色斜体，自动换行，最多 3 行；服务端已限制 wittyComment ≤54 字，3 行可完整展示）
    ctx.font = 'italic 14px "Helvetica Neue", sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    const lines = wrapLines(ctx, `“${result.wittyComment}”`, CANVAS_W - 96, 3)
    lines.forEach((line, i) => ctx.fillText(line, cx, scoreY + 80 + i * 22))

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
        {/* 等级印章：圆形朱文印盖在照片右上角（-12° 盖章角度）。环体为程序生成的回纹 SVG（data-uri），
            2×2 四字用原生 Text 叠加保证衬线粗体渲染，除线条与字外全透明 */}
        {!result.isInvalid && (
          <View className="absolute top-3 right-3 w-24 h-24 -rotate-12 pointer-events-none">
            <Image src={stampRingUri} className="w-full h-full" mode="aspectFit" />
            <View className="absolute inset-0 flex flex-col items-center justify-center">
              <Text className="block font-display font-black text-2xl leading-none tracking-[0.25em] pl-[0.25em]" style={{ color: stampColor }}>{result.level.slice(0, 2)}</Text>
              <Text className="block font-display font-black text-2xl leading-none tracking-[0.25em] pl-[0.25em] mt-2" style={{ color: stampColor }}>{result.level.slice(2, 4)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* 分数：上移压入遮罩，衬线粗体个性数字 */}
      <Text className="block text-8xl font-display font-bold text-white leading-none -mt-12 relative z-10">
        {result.isInvalid ? '--' : result.totalScore}
      </Text>
      {/* 等级印章已移至照片右上角（见照片卡内叠加层） */}
      {/* 风格人格 */}
      <Text className="block text-xl font-medium text-white mt-4">{result.stylePersonality}</Text>
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
        {/* 分享按钮：微信原生 button 编译为 taro-button-core 自定义组件，其内部 ::after 边框
            受样式隔离影响外部 CSS 无法选中。用透明 button 覆盖 icon 的方案：视觉是 icon，
            点击由全透明（边框也随之不可见）的分享 button 接收 */}
        {/* flex 居中容器：与另两个按钮（inline-flex）渲染一致，避免 inline icon 基线间隙导致视觉偏高 */}
        <View className="relative p-2 flex items-center justify-center">
          <Share2 size={22} color="rgba(255,255,255,0.8)" />
          <Button
            variant="ghost"
            openType="share"
            className="absolute inset-0 w-full h-full opacity-0 bg-transparent border-none shadow-none"
          >
            <Text>分享</Text>
          </Button>
        </View>
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
