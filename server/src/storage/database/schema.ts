import { sql } from "drizzle-orm";
import { pgTable, varchar, text, bigint, index } from "drizzle-orm/pg-core";

export const shares = pgTable(
  "shares",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
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
  ]
);

export type Share = typeof shares.$inferSelect;
export type InsertShare = typeof shares.$inferInsert;
