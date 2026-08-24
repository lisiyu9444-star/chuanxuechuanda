/**
 * AI 毒舌时尚官 - 穿搭评分结果结构
 * 与后端 fashion_ratings.result (JSONB) 对应，字段契约见 PRD 5.1
 */
export interface FashionRatingResult {
  /** 综合分数 0-100 */
  totalScore: number
  /** 等级称号，如「时尚达人」 */
  level: string
  /** 风格人格，如「🎨 撞色冒险家」 */
  stylePersonality: string
  /** 毒舌点评（isInvalid 时为幽默拒绝语） */
  wittyComment: string
  /** 分享文案：自信版（高分）/ 自黑版（低分） */
  shareTexts: {
    confident: string
    selfDeprecating: string
  }
  /** 非穿搭照标记：true 时分数无效，仅展示幽默拒绝语 */
  isInvalid: boolean
  /** 图片质量提示（模糊/光线差等），可选 */
  imageWarning?: string
}

/** 测评记录（rate / list 接口返回的单条数据） */
export interface FashionRatingRecord {
  id: string
  imageUrl: string
  result: FashionRatingResult
  createdAt: number
}
