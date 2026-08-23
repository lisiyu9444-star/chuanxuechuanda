import { sql } from "drizzle-orm";
import { pgTable, varchar, text, bigint, boolean, index } from "drizzle-orm/pg-core";

export const shares = pgTable(
  "shares",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }), // 可选：已登录用户的分享关联
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
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    lastLoginAt: bigint("last_login_at", { mode: "number" }),
  },
  (table) => [index("users_openid_idx").on(table.openid)]
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
    profileId: varchar("profile_id", { length: 64 }).references(() => profiles.id),
    type: varchar("type", { length: 20 }).notNull(), // calculate / daily / native
    nickname: varchar("nickname", { length: 100 }),
    gender: varchar("gender", { length: 10 }),
    result: text("result").notNull(), // JSON 完整结果
    imageUrl: varchar("image_url", { length: 500 }),
    tryOnUrl: varchar("try_on_url", { length: 500 }),
    llmPlan: text("llm_plan"), // JSON
    luckyScore: text("lucky_score"), // JSON
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("bazi_records_user_id_idx").on(table.userId),
    index("bazi_records_profile_id_idx").on(table.profileId),
    index("bazi_records_type_idx").on(table.type),
  ]
);

export type Share = typeof shares.$inferSelect;
export type InsertShare = typeof shares.$inferInsert;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type BaziRecord = typeof baziRecords.$inferSelect;
