import * as React from "react"
import { View, Button as NativeButton } from "@tarojs/components"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none active:outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [-webkit-tap-highlight-color:transparent] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary hover:bg-opacity-90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive hover:bg-opacity-90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary hover:bg-opacity-80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  disabled?: boolean
  className?: string
  openType?: 'share' | 'contact' | 'getPhoneNumber' | 'getUserInfo' | 'launchApp' | 'openSetting' | 'feedback'
}

const Button = React.forwardRef<React.ElementRef<typeof View>, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, openType, ...props }, ref) => {
    const tabIndex = (props as { tabIndex?: number }).tabIndex ?? (disabled ? -1 : 0)
    
    // 当 openType 存在时，使用原生 Button 组件（用于微信小程序分享等功能）
    if (openType) {
      // 仅在调用方未显式传入 border 相关类时才去除原生边框，避免覆盖自定义边框样式
      const hasCustomBorder = /\bborder(-|\s|$)/.test(className || "")
      return (
        <NativeButton
          className={cn(
            buttonVariants({ variant, size, className }),
            // after:border-none 用于去除小程序原生 button 的伪元素 hairline，不影响用户传入的 border
            "after:border-none outline-none",
            !hasCustomBorder && "border-none",
            disabled && "opacity-50 pointer-events-none"
          )}
          ref={ref}
          openType={openType}
          disabled={disabled}
          plain
          hoverClass="none"
          {...props}
        />
      )
    }
    
    return (
      <View
        className={cn(
          buttonVariants({ variant, size, className }),
          disabled && "opacity-50 pointer-events-none"
        )}
        ref={ref}
        {...({ tabIndex } as { tabIndex?: number })}
        hoverClass={disabled ? undefined : "none"}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
