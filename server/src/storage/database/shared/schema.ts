import { pgTable, serial, timestamp, varchar, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const appConfig = pgTable("app_config", {
	id: serial().notNull(),
	key: varchar("key", { length: 50 }).notNull().unique(),
	value: boolean("value").notNull().default(true),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
