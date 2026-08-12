import { useState, useEffect, useRef, useCallback } from 'react'
import { useDidHide, useUnload } from '@tarojs/taro'
import { Network } from '@/network'

interface UseLoadingTaskOptions<TParams, TResult> {
  /** API 请求 URL */
  url: string
  /** HTTP 方法 */
  method?: 'GET' | 'POST'
  /** 请求参数 */
  params?: TParams
  /** 请求超时时间（毫秒） */
  timeout?: number
  /** 请求成功回调 */
  onSuccess?: (result: TResult) => void
  /** 请求失败回调 */
  onError?: (error: any) => void
  /** 是否自动执行（默认 true） */
  autoExecute?: boolean
}

interface UseLoadingTaskReturn<TResult> {
  /** 任务 ID */
  taskId: string | null
  /** 是否正在加载 */
  loading: boolean
  /** 请求结果 */
  result: TResult | null
  /** 错误信息 */
  error: any
  /** 手动执行任务 */
  execute: (params?: any) => Promise<void>
  /** 手动取消任务 */
  cancel: () => void
  /** 重置状态 */
  reset: () => void
}

/**
 * 通用 Loading 任务管理 Hook
 * 
 * 功能：
 * - 自动管理任务生命周期（页面隐藏/卸载时自动取消）
 * - 支持手动执行、取消、重置
 * - 提供 loading、result、error 状态
 * 
 * @example
 * ```tsx
 * const { loading, result, execute, cancel } = useLoadingTask({
 *   url: '/api/bazi/calculate',
 *   method: 'POST',
 *   params: { nickname, gender, birthDate },
 *   onSuccess: (data) => console.log('Success:', data),
 *   onError: (error) => console.error('Error:', error),
 * })
 * 
 * // 手动执行
 * useEffect(() => {
 *   execute()
 * }, [])
 * 
 * // 页面会自动在隐藏/卸载时取消任务
 * ```
 */
export function useLoadingTask<TParams = any, TResult = any>(
  options: UseLoadingTaskOptions<TParams, TResult>
): UseLoadingTaskReturn<TResult> {
  const {
    url,
    method = 'POST',
    params,
    timeout = 120000,
    onSuccess,
    onError,
    autoExecute = true,
  } = options

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TResult | null>(null)
  const [error, setError] = useState<any>(null)
  
  const taskIdRef = useRef<string | null>(null)
  const isPageVisibleRef = useRef(true)
  const executedRef = useRef(false)

  // 生成任务 ID
  const generateTaskId = () => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 取消任务
  const cancel = useCallback(() => {
    isPageVisibleRef.current = false
    if (taskIdRef.current) {
      console.log('[useLoadingTask] Cancelling task:', taskIdRef.current)
      Network.request({
        url: '/api/bazi/cancel',
        method: 'POST',
        data: { taskId: taskIdRef.current },
      }).catch(err => {
        console.error('[useLoadingTask] Failed to cancel task:', err)
      })
    }
  }, [])

  // 执行任务
  const execute = useCallback(async (overrideParams?: TParams) => {
    const currentParams = overrideParams || params
    
    // 生成 taskId
    const localTaskId = generateTaskId()
    taskIdRef.current = localTaskId
    isPageVisibleRef.current = true
    
    setLoading(true)
    setError(null)
    executedRef.current = true

    try {
      const res = await Network.request({
        url,
        method,
        timeout,
        data: {
          ...currentParams,
          clientTaskId: localTaskId,
        },
      })
      
      console.log('[useLoadingTask] API response:', res.data)

      // 检查页面是否仍然可见
      if (!isPageVisibleRef.current) {
        console.log('[useLoadingTask] Page hidden/unloaded, skip callback')
        return
      }

      const data = res.data?.data
      if (data) {
        setResult(data)
        onSuccess?.(data)
      }
    } catch (err: any) {
      // 判断是否为取消操作
      if (err?.errMsg?.includes('abort') || err?.errMsg?.includes('cancel')) {
        console.log('[useLoadingTask] Request cancelled by user')
        return
      }
      
      console.error('[useLoadingTask] Request failed:', err)
      setError(err)
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }, [url, method, params, timeout, onSuccess, onError])

  // 重置状态
  const reset = useCallback(() => {
    setLoading(false)
    setResult(null)
    setError(null)
    taskIdRef.current = null
    isPageVisibleRef.current = true
    executedRef.current = false
  }, [])

  // 页面隐藏时取消任务
  useDidHide(() => {
    console.log('[useLoadingTask] Page hidden')
    cancel()
  })

  // 页面卸载时取消任务
  useUnload(() => {
    console.log('[useLoadingTask] Page unloading')
    cancel()
  })

  // 自动执行
  useEffect(() => {
    if (autoExecute && !executedRef.current && params) {
      execute()
    }
  }, [autoExecute, params, execute])

  // 当 params 变化时自动执行（用于延迟传入参数的场景）
  useEffect(() => {
    if (!autoExecute && params && !executedRef.current) {
      execute()
    }
  }, [params, autoExecute, execute])

  return {
    taskId: taskIdRef.current,
    loading,
    result,
    error,
    execute,
    cancel,
    reset,
  }
}
