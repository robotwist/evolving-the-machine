import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { useAudio } from "@/lib/stores/useAudio";

import { cn } from "@/lib/utils"

// Arcade cabinet buttons: pixel font, square neon border with glow, inverted fill on hover
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-arcade uppercase tracking-wider text-xs border-2 transition-[color,background-color,box-shadow,transform] duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-neon-cyan text-neon-cyan bg-black shadow-[0_0_8px_var(--neon-cyan)] hover:bg-neon-cyan hover:text-black",
        secondary:
          "border-neon-magenta text-neon-magenta bg-black shadow-[0_0_8px_var(--neon-magenta)] hover:bg-neon-magenta hover:text-black",
        success:
          "border-neon-green text-neon-green bg-black shadow-[0_0_8px_var(--neon-green)] hover:bg-neon-green hover:text-black",
        warning:
          "border-neon-yellow text-neon-yellow bg-black shadow-[0_0_8px_var(--neon-yellow)] hover:bg-neon-yellow hover:text-black",
        destructive:
          "border-neon-red text-neon-red bg-black shadow-[0_0_8px_var(--neon-red)] hover:bg-neon-red hover:text-black",
        outline: "border-white/40 text-white bg-black hover:border-neon-cyan hover:text-neon-cyan",
        ghost: "border-transparent hover:text-neon-cyan",
        link: "border-transparent text-neon-cyan underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-[0.65rem]",
        lg: "h-12 px-8 text-sm",
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, onClick, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { playUIClick } = useAudio();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return;

      playUIClick();
      if (onClick) {
        onClick(e);
      }
    };

    const isDisabled = disabled || loading;
    const buttonContent = loading ? (
      <>
        <span className="animate-spin mr-2">⟳</span>
        {children}
      </>
    ) : children;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        {...props}
      >
        {buttonContent}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
