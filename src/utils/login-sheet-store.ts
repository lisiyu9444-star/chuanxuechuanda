import { useSyncExternalStore } from 'react'

/**
 * 全局登录弹层开关（跨页面共享的单例状态）。
 *
 * 背景：Taro 小程序端 App 组件（app.tsx）不渲染任何 UI，全局浮层必须挂在页面组件树内。
 * 因此 LoginSheet 在每个有登录入口的页面各挂载一个实例，通过本 store 同步开关状态：
 * requireLogin 调 open() 后所有页面实例同步，仅当前可见页面的弹层呈现；
 * 关闭/登录成功时 close() 全局同步，避免返回上一页时弹层残留。
 */

let openState = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export const loginSheetStore = {
  open(): void {
    if (openState) return
    openState = true
    emit()
  },
  close(): void {
    if (!openState) return
    openState = false
    emit()
  },
}

/** 订阅全局登录弹层开关状态 */
export function useLoginSheetOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => openState,
  )
}
