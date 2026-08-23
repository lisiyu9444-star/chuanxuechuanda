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
     * 并在收到 401 时执行静默重登；重登成功后 Network 层会自动重试一次原请求
     * （对业务层透明，符合 PRD「401 自动重试原请求」要求）。
     */
    interface AuthHooks {
        getAuthHeader?: () => Record<string, string>
        /** 收到 401 时调用；返回 true 表示登录态已恢复（Network 将自动重发原请求一次） */
        onUnauthorized?: () => Promise<boolean> | boolean
    }
    let authHooks: AuthHooks = {}

    export const setAuthHooks = (hooks: AuthHooks): void => {
        authHooks = hooks
    }

    const mergeAuthHeader = (header?: Record<string, string>): Record<string, string> => {
        const authHeader = authHooks.getAuthHeader?.() || {}
        return { ...authHeader, ...(header || {}) }
    }

    /** 401 处理：触发静默重登，成功则重发一次原请求（重试仅一次，避免死循环） */
    const withAuthRetry = async <R extends { statusCode?: number }>(
        doSend: () => Promise<R>,
        skipAuthRetry?: boolean,
    ): Promise<R> => {
        const res = await doSend()
        if (res.statusCode !== 401 || skipAuthRetry) {
            return res
        }
        let recovered = false
        try {
            recovered = (await authHooks.onUnauthorized?.()) === true
        } catch (e) {
            console.warn('[Network] onUnauthorized hook error:', e)
        }
        if (!recovered) {
            // 静默重登失败（未同意隐私协议/微信侧异常），把 401 原样返回给业务层
            return res
        }
        console.log('[Network] 登录态已恢复，自动重试原请求')
        return doSend()
    }

    /** 额外请求选项 */
    interface ExtraRequestOption {
        /** 跳过 401 自动重试（登录类请求自身使用，防止 login 401 → 重登 → 又发起 login 的递归死锁） */
        _skipAuthRetry?: boolean
    }

    type RequestOption = Parameters<typeof Taro.request>[0] & ExtraRequestOption
    type UploadOption = Parameters<typeof Taro.uploadFile>[0] & ExtraRequestOption
    /** 包装后的任务类型：Promise（响应数据 any）+ abort 能力（401 重试期间作用于当前在途请求） */
    type AnyTask = Promise<any> & { abort: () => void }

    export const request = (option: RequestOption): AnyTask => {
        const { _skipAuthRetry, ...rest } = option
        let currentTask: ReturnType<typeof Taro.request> | undefined

        const doSend = (): Promise<any> =>
            new Promise((resolve, reject) => {
                currentTask = Taro.request({
                    ...rest,
                    url: createUrl(option.url),
                    header: mergeAuthHeader(rest.header as Record<string, string> | undefined),
                    success: resolve,
                    fail: reject,
                })
            })

        const promise = (async (): Promise<any> => {
            let res: any
            let err: unknown
            try {
                res = await withAuthRetry(doSend, _skipAuthRetry)
                option.success?.(res)
                return res
            } catch (e) {
                err = e
                option.fail?.(err as Parameters<NonNullable<typeof option.fail>>[0])
                throw err
            } finally {
                option.complete?.((err !== undefined ? err : res) as Parameters<NonNullable<typeof option.complete>>[0])
            }
        })()

        // 转发 abort：401 重试期间 abort 作用于当前在途请求
        const task = promise as AnyTask
        task.abort = () => {
            currentTask?.abort()
        }
        return task
    }

    export const uploadFile = (option: UploadOption): AnyTask => {
        const { _skipAuthRetry, ...rest } = option
        let currentTask: ReturnType<typeof Taro.uploadFile> | undefined

        const doSend = (): Promise<any> =>
            new Promise((resolve, reject) => {
                currentTask = Taro.uploadFile({
                    ...rest,
                    url: createUrl(option.url),
                    header: mergeAuthHeader(rest.header as Record<string, string> | undefined),
                    success: resolve,
                    fail: reject,
                })
            })

        const promise = (async (): Promise<any> => {
            let res: any
            let err: unknown
            try {
                res = await withAuthRetry(doSend, _skipAuthRetry)
                option.success?.(res)
                return res
            } catch (e) {
                err = e
                option.fail?.(err as Parameters<NonNullable<typeof option.fail>>[0])
                throw err
            } finally {
                option.complete?.((err !== undefined ? err : res) as Parameters<NonNullable<typeof option.complete>>[0])
            }
        })()

        const task = promise as AnyTask
        task.abort = () => {
            currentTask?.abort()
        }
        return task
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
        })
    }
}
