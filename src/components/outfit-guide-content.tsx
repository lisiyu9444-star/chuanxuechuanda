import { View, Text } from '@tarojs/components'
import { Shirt, Square, Footprints, ShoppingBag, Gem } from 'lucide-react-taro'
import { Card, CardContent } from '@/components/ui/card'
import { ELEMENT_COLORS } from '@/constants/element-colors'
import { SHOW_METAPHYSICS } from '@/utils/channel'
import type { BaZiResult, StylistResult } from '@/types/bazi'

const COLOR_HEX_MAP: Record<string, string> = {
  黑: '#1a1a1a', 黑色: '#1a1a1a', 深黑: '#000000',
  白: '#f8f8f8', 白色: '#ffffff', 乳白: '#fffdf5',
  灰: '#9ca3af', 灰色: '#9ca3af', 银灰: '#c0c0c0', 雾灰: '#b8b8b8',
  红: '#ef4444', 红色: '#ef4444', 酒红: '#722f37', 粉红: '#f9a8d4',
  蓝: '#3b82f6', 蓝色: '#3b82f6', 深蓝: '#1e3a8a', 浅蓝: '#93c5fd', 雾霾蓝: '#7aa1c4',
  绿: '#22c55e', 绿色: '#22c55e', 墨绿: '#064e3b', 浅绿: '#86efac',
  黄: '#eab308', 黄色: '#eab308', 米黄: '#fef3c7', 鹅黄: '#fde047',
  棕: '#92400e', 棕色: '#92400e', 咖啡: '#6f4e37', 驼色: '#c19a6b',
  紫: '#a855f7', 紫色: '#a855f7', 浅紫: '#d8b4fe',
  橙: '#f97316', 橙色: '#f97316', 橘: '#f97316',
  粉: '#f9a8d4', 粉色: '#f9a8d4',
  银: '#e5e7eb', 银色: '#e5e7eb',
  金: '#f59e0b', 金色: '#f59e0b',
  藏青: '#1e3a5a', 海军蓝: '#1e3a5a',
  象牙白: '#fffff0', 珍珠白: '#f8f6f1', 奶油白: '#fffdd0',
  牛仔蓝: '#5b7c99', 天蓝: '#87ceeb',
  豆沙粉: '#d4a5a5', 裸色: '#e3c1b5',
  香槟色: '#f7e7ce', 焦糖色: '#c68e4f',
}

function getColorHex(colorName: string): string {
  if (!colorName) return '#d1d5db'
  const normalized = colorName.replace(/色$/, '')
  for (const key in COLOR_HEX_MAP) {
    if (colorName.includes(key) || normalized.includes(key.replace(/色$/, ''))) {
      return COLOR_HEX_MAP[key]
    }
  }
  return '#d1d5db'
}

interface OutfitGuideContentProps {
  result: BaZiResult
  llmPlan?: StylistResult
  yongShen?: string
  xiShen?: string
  themeColor: string
  occasionColor?: string
  occasionBgTransparent?: boolean
  pageMode?: 'daily' | 'native'
  showTitle?: boolean
  showBaziOverview?: boolean
}

export function OutfitGuideContent({
  result,
  llmPlan: llmPlanProp,
  yongShen: yongShenProp,
  xiShen: xiShenProp,
  themeColor,
  occasionColor,
  occasionBgTransparent,
  pageMode = 'daily',
  showTitle = true,
  showBaziOverview = true,
}: OutfitGuideContentProps) {
  const tagColor = occasionColor || themeColor
  const tagBg = occasionBgTransparent ? 'transparent' : `${tagColor}1a`
  const llmPlan = llmPlanProp || result.llmPlan
  const yongShen = yongShenProp || result.dailyYongShen
  const xiShen = xiShenProp || result.dailyXiShen
  const elementColor = ELEMENT_COLORS[result.favorableElement] || '#6366f1'
  const showBaZiContent = result.fourPillars && result.fourPillars.length > 0

  return (
    <View className="flex flex-col gap-4">
      {/* 八字概览 */}
      {showBaziOverview && showBaZiContent && (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <Text className="block text-sm font-medium text-black">八字概览</Text>
              {result.dayMaster && (
                <Text className="block text-xs text-gray-400">
                  日主：
                  <Text style={{ color: ELEMENT_COLORS[result.dayMasterElement] || '#6366f1', fontWeight: 'bold' }}>
                    {result.dayMaster}
                  </Text>
                  （{result.dayMasterElement}）
                </Text>
              )}
            </View>
            <View className="flex justify-between gap-2">
              {result.fourPillars.map((pillar) => (
                <View key={pillar.name} className="flex-1 flex flex-col items-center gap-1">
                  <Text className="block text-xs text-gray-400">{pillar.name}</Text>
                  {pillar.tenGod ? <Text className="block text-xs text-gray-400">{pillar.tenGod}</Text> : null}
                  <Text className="block text-lg font-bold" style={{ color: ELEMENT_COLORS[pillar.stemElement] }}>
                    {pillar.stem}
                  </Text>
                  <Text className="block text-lg font-bold" style={{ color: ELEMENT_COLORS[pillar.branchElement] }}>
                    {pillar.branch}
                  </Text>
                  {pillar.naYin ? <Text className="block text-xs text-gray-300 mt-1">{pillar.naYin}</Text> : null}
                </View>
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {/* 喜用神分析（玄学内容，抖音渠道隐藏） */}
      {SHOW_METAPHYSICS && (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="p-4">
          <Text className="block text-sm font-medium text-gray-900 mb-3">喜用神分析</Text>
          <View className="flex items-center gap-3 mb-3">
            <View
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: `${elementColor}15`,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: elementColor,
              }}
            >
              <Text className="block text-xl font-bold" style={{ color: elementColor }}>
                {result.favorableElement}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="block text-gray-700 text-sm">
                核心用神「{result.favorableAnalysis.coreYongShen}」· 喜神「{result.favorableAnalysis.assistantXiShen}」
              </Text>
              <Text className="block text-gray-400 text-xs mt-1">
                忌神「{result.favorableAnalysis.taboo}」· {result.favorableAnalysis.strength}
              </Text>
            </View>
          </View>
          <View className="bg-gray-50 rounded-lg p-3">
            <Text className="block text-xs text-gray-500 leading-relaxed">
              {result.favorableAnalysis.logicSummary}
            </Text>
          </View>

          {/* 每日用神 - 仅今日穿搭展示 */}
          {pageMode === 'daily' && yongShen && (
            <View className="mt-3 bg-gray-50 rounded-lg p-3">
              <View className="flex items-center gap-2 mb-2">
                <View
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${ELEMENT_COLORS[yongShen] || '#a855f7'}15`,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: ELEMENT_COLORS[yongShen] || '#a855f7',
                  }}
                >
                  <Text
                    className="block text-sm font-bold"
                    style={{ color: ELEMENT_COLORS[yongShen] || '#a855f7' }}
                  >
                    {yongShen}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="block text-gray-700 text-sm">
                    今日用神「{yongShen}」· 喜神「{xiShen}」
                  </Text>
                  <Text className="block text-xs mt-1" style={{ color: themeColor, opacity: 0.7 }}>
                    {yongShen === result.favorableElement
                      ? '今日用神回归，穿搭主色调保持不变'
                      : '今日五行能量变化，穿搭主色调已相应调整'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </CardContent>
      </Card>
      )}

      {/* 穿搭方案 */}
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="p-4">
          {showTitle && (
            <Text className="block text-base font-semibold text-gray-900 mb-3">
              {pageMode === 'native' ? '本命穿搭' : '今日穿搭'}
            </Text>
          )}

          {llmPlan ? (
            <View className="space-y-4">
              {/* 风格主题 */}
              <Text className="block text-base font-semibold text-gray-900 leading-relaxed">
                {llmPlan.styleTheme}
              </Text>

              {/* 幸运色 */}
              <View className="space-y-2">
                <Text className="block text-sm font-semibold text-gray-700">幸运色</Text>
                <View className="grid grid-cols-2 gap-3">
                  <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                    <View
                      className="w-5 h-5 rounded-full flex-shrink-0 border"
                      style={{
                        backgroundColor: llmPlan.luckyColors.primaryHex || getColorHex(llmPlan.luckyColors.primary),
                        borderColor: 'rgba(0,0,0,0.05)',
                      }}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className="block text-xs text-gray-500">主色</Text>
                      <Text className="block text-sm font-medium text-gray-900 truncate">
                        {llmPlan.luckyColors.primary}
                      </Text>
                    </View>
                  </View>
                  <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                    <View
                      className="w-5 h-5 rounded-full flex-shrink-0 border"
                      style={{
                        backgroundColor: llmPlan.luckyColors.secondaryHex || getColorHex(llmPlan.luckyColors.secondary),
                        borderColor: 'rgba(0,0,0,0.05)',
                      }}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className="block text-xs text-gray-500">辅色</Text>
                      <Text className="block text-sm font-medium text-gray-900 truncate">
                        {llmPlan.luckyColors.secondary}
                      </Text>
                    </View>
                  </View>
                  <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                    <View
                      className="w-5 h-5 rounded-full flex-shrink-0 border"
                      style={{
                        backgroundColor: llmPlan.luckyColors.accentHex || getColorHex(llmPlan.luckyColors.accent),
                        borderColor: 'rgba(0,0,0,0.05)',
                      }}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className="block text-xs text-gray-500">点缀</Text>
                      <Text className="block text-sm font-medium text-gray-900 truncate">
                        {llmPlan.luckyColors.accent}
                      </Text>
                    </View>
                  </View>
                  {llmPlan.luckyColors.avoid?.length > 0 && (
                    <View className="flex items-center gap-3 bg-gray-50 px-3 py-3 rounded-xl">
                      <View className="w-5 h-5 rounded-full flex-shrink-0 bg-gray-200 border" style={{ borderColor: 'rgba(0,0,0,0.05)' }} />
                      <View className="flex-1 min-w-0">
                        <Text className="block text-xs text-gray-500">避雷</Text>
                        <Text className="block text-sm font-medium text-gray-900 truncate">
                          {llmPlan.luckyColors.avoid.join('、')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* 单品清单 */}
              <View className="space-y-2">
                <Text className="block text-sm font-semibold text-gray-700">单品清单</Text>
                <View className="grid grid-cols-2 gap-3">
                  {llmPlan.outfitPlan.top && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <Shirt size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">上衣</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">{llmPlan.outfitPlan.top}</Text>
                    </View>
                  )}
                  {llmPlan.outfitPlan.bottom && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <Square size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">下装</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">{llmPlan.outfitPlan.bottom}</Text>
                    </View>
                  )}
                  {llmPlan.outfitPlan.outerwear && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <Shirt size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">外套</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">{llmPlan.outfitPlan.outerwear}</Text>
                    </View>
                  )}
                  {llmPlan.outfitPlan.shoes && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <Footprints size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">鞋履</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">{llmPlan.outfitPlan.shoes}</Text>
                    </View>
                  )}
                  {llmPlan.outfitPlan.bag && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <ShoppingBag size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">包袋</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">{llmPlan.outfitPlan.bag}</Text>
                    </View>
                  )}
                  {llmPlan.outfitPlan.accessories.length > 0 && (
                    <View className="bg-gray-50 p-3 rounded-xl">
                      <View className="flex items-center gap-1 mb-1">
                        <Gem size={12} color="#6b7280" />
                        <Text className="block text-xs text-gray-500">配饰</Text>
                      </View>
                      <Text className="block text-sm font-medium text-gray-900 leading-snug">
                        {llmPlan.outfitPlan.accessories.join('、')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* 面料建议 */}
              {llmPlan.fabricSuggestion && (
                <View className="space-y-2">
                  <Text className="block text-sm font-semibold text-gray-700">面料建议</Text>
                  <Text className="block text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl">
                    {llmPlan.fabricSuggestion}
                  </Text>
                </View>
              )}

              {/* 适用场景 */}
              {llmPlan.occasions && llmPlan.occasions.length > 0 && (
                <View className="space-y-2">
                  <Text className="block text-sm font-semibold text-gray-700">适用场景</Text>
                  <View className="flex flex-wrap gap-2">
                    {llmPlan.occasions.map((scene, index) => {
                      const tag = scene.split('：')[0]
                      return (
                        <View
                          key={index}
                          className="px-3 py-1 rounded-full"
                          style={{
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: `${tagColor}66`,
                            backgroundColor: tagBg,
                          }}
                        >
                          <Text className="block text-sm font-medium" style={{ color: tagColor }}>
                            {tag}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text className="block text-sm text-gray-500">暂无穿搭方案</Text>
          )}
        </CardContent>
      </Card>
    </View>
  )
}
