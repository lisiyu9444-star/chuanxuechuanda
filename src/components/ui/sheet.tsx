import * as React from "react"
import { View } from "@tarojs/components"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react-taro"

import { cn } from "@/lib/utils"
import { Portal } from "@/components/ui/portal"

const SheetContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
} | null>(null)

const usePresence = (open: boolean | undefined, durationMs: number) => {
  const [present, setPresent] = React.useState(!!open)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (open) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      setPresent(true)
      return
    }

    timeoutRef.current = setTimeout(() => setPresent(false), durationMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [open, durationMs])

  return present
}

interface SheetProps {
    children: React.ReactNode
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    modal?: boolean
}

const Sheet = ({ children, open: openProp, defaultOpen, onOpenChange }: SheetProps) => {
    const [openState, setOpenState] = React.useState(defaultOpen || false)
    const open = openProp !== undefined ? openProp : openState
    
    const handleOpenChange = (newOpen: boolean) => {
        if (openProp === undefined) {
            setOpenState(newOpen)
        }
        onOpenChange?.(newOpen)
    }

    return (
        <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
            {children}
        </SheetContext.Provider>
    )
}

const SheetTrigger = React.forwardRef<
    React.ElementRef<typeof View>,
    React.ComponentPropsWithoutRef<typeof View> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
    const context = React.useContext(SheetContext)
    return (
        <View
          ref={ref}
          className={cn("w-fit", className)}
          onClick={(e) => {
                e.stopPropagation()
                context?.onOpenChange?.(true)
            }}
          {...props}
        >
            {children}
        </View>
    )
})
SheetTrigger.displayName = "SheetTrigger"

const SheetClose = React.forwardRef<
    React.ElementRef<typeof View>,
    React.ComponentPropsWithoutRef<typeof View> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
    const context = React.useContext(SheetContext)
    return (
        <View
          ref={ref}
          className={className}
          onClick={(e) => {
                e.stopPropagation()
                context?.onOpenChange?.(false)
            }}
          {...props}
        >
            {children}
        </View>
    )
})
SheetClose.displayName = "SheetClose"

const SheetPortal = ({ children }: { children: React.ReactNode }) => {
    const context = React.useContext(SheetContext)
    const present = usePresence(context?.open, 300)
    if (!present) return null
    return <Portal>{children}</Portal>
}

// 视觉开关：挂载首帧强制渲染 closed 初始态，延迟一帧再跟随真实 open，
// 让 CSS transition 有过渡起点（否则首帧即终态，弹层无生硬出现没有动画）。
// 关闭时 open 变 false 立即回落 closed 态，配合 usePresence 延迟卸载完成退出动画。
const useVisualOpen = () => {
  const context = React.useContext(SheetContext)
  const open = !!context?.open
  const [entered, setEntered] = React.useState(false)
  React.useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50)
    return () => clearTimeout(t)
  }, [])
  return open && entered
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, onClick, ...props }, ref) => {
  const context = React.useContext(SheetContext)
  const visualOpen = useVisualOpen()
  const state = visualOpen ? "open" : "closed"
  return (
      <View
        data-state={state}
        className={cn(
          "fixed inset-0 isolate z-50 bg-black bg-opacity-10 transition-opacity duration-300 ease-in-out supports-[backdrop-filter]:backdrop-blur-sm will-change-opacity",
          visualOpen ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
        ref={ref}
        onClick={(e) => {
            e.stopPropagation()
            onClick?.(e)
            context?.onOpenChange?.(false)
        }}
      />
    )
})
SheetOverlay.displayName = "SheetOverlay"

// 动画方案：transition-transform + translate（跨端可靠），不使用 tailwindcss-animate keyframes
//（项目未配置该插件，animate-in/slide-in-from-* 类无对应 CSS，会导致弹层生硬闪现）；
// 也不用 data-[state=...] 选择器类：小程序端该 variant 不会生成匹配规则，弹层会永远停在屏外
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform ease-in-out duration-300 will-change-transform",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom: "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

// 关闭态屏外偏移类（打开时由 translate-x-0/translate-y-0 覆盖归位，transition 产生滑动动画）
const sheetHiddenClass: Record<string, string> = {
  top: "-translate-y-full",
  bottom: "translate-y-full",
  left: "-translate-x-full",
  right: "translate-x-full",
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof View>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
    const context = React.useContext(SheetContext)
    const visualOpen = useVisualOpen()
    const state = visualOpen ? "open" : "closed"
  return (
    <SheetPortal>
      <View
        className="fixed inset-0 z-50"
        onClick={() => context?.onOpenChange?.(false)}
      >
        <SheetOverlay />
        <View
          ref={ref}
          className={cn(
            sheetVariants({ side }),
            "sheet-content",
            visualOpen ? "translate-x-0 translate-y-0" : sheetHiddenClass[side || "right"],
            className
          )}
          data-state={state}
          data-side={side}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
          <View
            className={cn(
              "absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
              visualOpen && "bg-secondary"
            )}
            data-state={state}
            onClick={(e) => {
                  e.stopPropagation()
                  context?.onOpenChange?.(false)
              }}
          >
            <X size={16} color="inherit" />
            <View className="sr-only">Close</View>
          </View>
        </View>
      </View>
    </SheetPortal>
  )
})
SheetContent.displayName = "SheetContent"

const SheetHeader = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) => (
  <View
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof View>) => (
  <View
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof View>,
  React.ComponentPropsWithoutRef<typeof View>
>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = "SheetDescription"

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
