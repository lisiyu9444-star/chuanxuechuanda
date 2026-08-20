import { S3Storage } from 'coze-coding-dev-sdk'

/**
 * TOS 对象存储工具：签名 URL 动态签发与 key 提取。
 *
 * 背景：TOS 签名 URL 带有效期（sign 参数内嵌过期时间戳），任何持久化场景
 * （前端历史记录、分享记录、静态资源配置）直接存 URL 都会过期失效。
 * 但 key 永久有效，且签名 URL 的路径部分就是 key，因此：
 * - 持久化只需保留 URL（或从中提取 key）
 * - 展示时通过 signKey / signUrl 动态换签，即可得到永不过期的访问能力
 */

let storageInstance: S3Storage | null = null

export function getStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    })
  }
  return storageInstance
}

/** 本项目 bucket 的访问域名，用于判断 URL 是否可换签 */
const BUCKET_HOST_SUFFIX = '.tos.coze.site'

/** 默认签发有效期：30 天（秒） */
export const DEFAULT_SIGN_EXPIRE_SECONDS = 2592000

/**
 * 从 TOS 签名 URL 中提取对象 key。
 * URL 形如 https://{bucket}.tos.coze.site/{key}?sign=...，路径部分即 key。
 * 非本 bucket 的 URL 返回空字符串。
 */
export function extractTosKey(url?: string): string {
  if (!url || typeof url !== 'string') return ''
  try {
    const u = new URL(url)
    if (!u.host.endsWith(BUCKET_HOST_SUFFIX)) return ''
    return decodeURIComponent(u.pathname.replace(/^\//, ''))
  } catch {
    return ''
  }
}

/** 对 key 签发访问 URL，失败返回空字符串 */
export async function signKey(key: string, expireTime = DEFAULT_SIGN_EXPIRE_SECONDS): Promise<string> {
  if (!key) return ''
  try {
    return await getStorage().generatePresignedUrl({ key, expireTime })
  } catch (e) {
    console.error('[TosUtils] sign key failed:', key, e)
    return ''
  }
}

/**
 * 对本 bucket 的（可能已过期的）签名 URL 重新换签；非本 bucket URL 原样返回。
 * 用于分享记录等"只存了 URL"的旧数据续期。
 */
export async function signUrl(url?: string, expireTime = DEFAULT_SIGN_EXPIRE_SECONDS): Promise<string> {
  if (!url) return ''
  const key = extractTosKey(url)
  if (!key) return url
  const signed = await signKey(key, expireTime)
  return signed || url
}
