import { sql } from "drizzle-orm";
import { pgTable, varchar, text, bigint, boolean, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

export const shares = pgTable(
  "shares",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    // 可选：已登录用户的分享关联；外键引用 users.id，用户删除后置空（保留匿名分享内容）
    userId: varchar("user_id", { length: 64 }).references(() => users.id, { onDelete: "set null" }),
    nickname: varchar("nickname", { length: 100 }).notNull(),
    gender: varchar("gender", { length: 10 }).notNull().default("male"),
    result: text("result").notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    tryOnUrl: varchar("try_on_url", { length: 500 }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("shares_expires_at_idx").on(table.expiresAt),
    index("shares_user_id_idx").on(table.userId),
  ]
);

// 用户表：微信登录用户
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    openid: varchar("openid", { length: 128 }).notNull().unique(),
    unionid: varchar("unionid", { length: 128 }),
    nickname: varchar("nickname", { length: 100 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    // 对外展示的随机数字 ID（如 ID: 16109284），创建用户时生成，全局唯一
    displayId: varchar("display_id", { length: 16 }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    lastLoginAt: bigint("last_login_at", { mode: "number" }),
    // 当前选中的穿搭档案 id（前端本地档案 id，含示例档案 'default'；跨设备同步用，不做外键约束）
    currentArchiveId: varchar("current_archive_id", { length: 128 }),
  },
  (table) => [
    index("users_openid_idx").on(table.openid),
    uniqueIndex("users_display_id_idx").on(table.displayId),
  ]
);

// 隐私协议同意记录表：每次同意留痕
export const privacyConsents = pgTable(
  "privacy_consents",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
    version: varchar("version", { length: 20 }).notNull(),
    agreedAt: bigint("agreed_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("privacy_consents_user_id_idx").on(table.userId)]
);

// 用户档案表（出生信息）
export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
    nickname: varchar("nickname", { length: 100 }).notNull(),
    gender: varchar("gender", { length: 10 }).notNull().default("male"),
    birthDate: varchar("birth_date", { length: 20 }).notNull(),
    birthTime: varchar("birth_time", { length: 20 }).notNull(),
    location: varchar("location", { length: 100 }),
    calendarType: varchar("calendar_type", { length: 10 }).default("solar"),
    stylePreference: varchar("style_preference", { length: 50 }),
    age: varchar("age", { length: 10 }),
    isDefault: boolean("is_default").default(false),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("profiles_user_id_idx").on(table.userId)]
);

// 八字计算记录表（历史记录）
export const baziRecords = pgTable(
  "bazi_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
    // 删除档案时历史记录保留，仅解除档案关联（clientId 前缀仍含档案 id，可定位来源）
    profileId: varchar("profile_id", { length: 64 }).references(() => profiles.id, { onDelete: "set null" }),
    type: varchar("type", { length: 20 }).notNull(), // calculate / daily / native
    nickname: varchar("nickname", { length: 100 }),
    gender: varchar("gender", { length: 10 }),
    result: text("result").notNull(), // JSON 完整结果
    imageUrl: varchar("image_url", { length: 500 }),
    tryOnUrl: varchar("try_on_url", { length: 500 }),
    llmPlan: text("llm_plan"), // JSON
    luckyScore: text("lucky_score"), // JSON
    /** 前端本地记录 id（`${archiveId}_${date}` / `${archiveId}_native`），用于幂等 upsert 与删除同步 */
    clientId: varchar("client_id", { length: 128 }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("bazi_records_user_id_idx").on(table.userId),
    index("bazi_records_profile_id_idx").on(table.profileId),
    index("bazi_records_type_idx").on(table.type),
    uniqueIndex("bazi_records_user_client_idx").on(table.userId, table.clientId),
  ]
);

// 时尚测评记录表（AI 毒舌时尚官：穿搭照片 + AI 评分结果）
export const fashionRatings = pgTable(
  "fashion_ratings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    result: jsonb("result").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("fashion_ratings_user_id_idx").on(table.userId),
    index("fashion_ratings_created_at_idx").on(table.createdAt),
  ]
);

// 分享访问统计表（穿搭测评分享 + 八字穿搭结果分享，两条路径统一记录）
// 统计口径：分享者本人打开不计；同一访客（登录按 userId / 匿名按 IP+UA 哈希）
// 24 小时内重复访问同一分享只记一次（PV/UV 同口径）
// 表结构由 share-visit.service.ts 的 ensureShareVisitsTable 运行时幂等自举（含索引），此处定义供 Drizzle 查询使用
export const shareVisits = pgTable(
  "share_visits",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    // 分享类型：fashion=穿搭测评分享（share_id 为 fashion_ratings.id），bazi=八字穿搭结果分享（share_id 为 shares.id）
    shareType: varchar("share_type", { length: 20 }).notNull(),
    shareId: varchar("share_id", { length: 64 }).notNull(),
    // 分享者 userId（匿名分享为 null；冗余存储便于按分享者聚合查询，不做外键）
    sharerUserId: varchar("sharer_user_id", { length: 64 }),
    // 已登录访客 userId（未登录访客为 null）
    visitorUserId: varchar("visitor_user_id", { length: 64 }),
    // UV 去重键：u:{userId} 或 a:{sha256(ip|ua) 前 32 位}
    visitorKey: varchar("visitor_key", { length: 128 }).notNull(),
    visitedAt: bigint("visited_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("share_visits_share_idx").on(table.shareType, table.shareId, table.visitedAt),
    index("share_visits_sharer_idx").on(table.sharerUserId, table.visitedAt),
    index("share_visits_dedup_idx").on(table.shareType, table.shareId, table.visitorKey, table.visitedAt),
  ]
);

// 每日运势结果缓存表（前端 DAILY_RESULTS_KEY 的云端副本）
// 唯一键 (user_id, archive_id, date)：同一档案同一天只保留最新一条，upsert 幂等
export const dailyResults = pgTable(
  "daily_results",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    // 前端本地档案 id（与 profiles.id 同源，但允许示例档案等任意值，不做外键）
    archiveId: varchar("archive_id", { length: 128 }).notNull(),
    // 日期串 YYYY-MM-DD（前端 getToday() 生成，按用户本地时区）
    date: varchar("date", { length: 10 }).notNull(),
    // 完整 DailyResult 对象（luckyScore/baziResult/llmPlan/imageUrl 等），恢复时直接回写本地
    result: jsonb("result").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("daily_results_user_id_idx").on(table.userId),
    uniqueIndex("daily_results_user_archive_date_idx").on(table.userId, table.archiveId, table.date),
  ]
);

export type Share = typeof shares.$inferSelect;
export type InsertShare = typeof shares.$inferInsert;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type BaziRecord = typeof baziRecords.$inferSelect;
export type FashionRating = typeof fashionRatings.$inferSelect;
export type DailyResultRow = typeof dailyResults.$inferSelect;
