import Taro from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * IMPORTANT: 除非你需要添加全局参数，如给所有请求加上 header，否则不能修改此文件
 */
export namespace Network {
    const createUrl = (url: string): string => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }
        return `${PROJECT_DOMAIN}${url}`
    }

    /**
     * 鉴权钩子（全局 header 场景）。
     * 由 src/utils/auth.ts 在应用启动时注册：为所有请求注入 Authorization，
     * 并在收到 401 时触发静默重登（不重试当前请求，保住 RequestTask 的 abort 能力）。
     */
    interface AuthHooks {
        getAuthHeader?: () => Record<string, string>
        onUnauthorized?: () => void
    }
    let authHooks: AuthHooks = {}

    export const setAuthHooks = (hooks: AuthHooks): void => {
        authHooks = hooks
    }

    const mergeAuthHeader = (header?: Record<string, string>): Record<string, string> => {
        const authHeader = authHooks.getAuthHeader?.() || {}
        return { ...authHeader, ...(header || {}) }
    }

    const handleResponseStatus = (statusCode: number): void => {
        if (statusCode === 401) {
            try {
                authHooks.onUnauthorized?.()
            } catch (e) {
                console.warn('[Network] onUnauthorized hook error:', e)
            }
        }
    }

    export const request: typeof Taro.request = option => {
        return Taro.request({
            ...option,
            url: createUrl(option.url),
            header: mergeAuthHeader(option.header as Record<string, string> | undefined),
            success: res => {
                handleResponseStatus(res.statusCode)
                option.success?.(res)
            },
        })
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        return Taro.uploadFile({
            ...option,
            url: createUrl(option.url),
            header: mergeAuthHeader(option.header as Record<string, string> | undefined),
            success: res => {
                handleResponseStatus(res.statusCode)
                option.success?.(res)
            },
        })
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
        })
    }
}
