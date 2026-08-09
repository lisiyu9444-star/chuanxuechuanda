import { Injectable } from '@nestjs/common'
import { db, eq } from '@/storage'
import { appConfig } from '@/storage/database/shared/schema'

@Injectable()
export class ConfigService {
  async getAllFeatures(): Promise<Record<string, boolean>> {
    const configs = await db.select().from(appConfig)

    const features: Record<string, boolean> = {}
    for (const config of configs) {
      features[config.key] = config.value
    }

    return features
  }

  async updateFeature(key: string, value: boolean): Promise<void> {
    await db
      .update(appConfig)
      .set({ value, updatedAt: new Date() })
      .where(eq(appConfig.key, key))
  }

  async getFeature(key: string): Promise<boolean | undefined> {
    const configs = await db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, key))
      .limit(1)

    return configs[0]?.value
  }

  async initializeDefaultFeatures(): Promise<void> {
    const defaults = [
      { key: 'showHomeSubtitle', value: true },
      { key: 'showLoadingSteps', value: true },
      { key: 'showResultDetails', value: true },
      { key: 'enableVideoUnlock', value: true },
      { key: 'enableShareUnlock', value: true },
    ]

    for (const config of defaults) {
      const existing = await this.getFeature(config.key)
      if (existing === undefined) {
        await db.insert(appConfig).values(config)
      }
    }
  }
}
