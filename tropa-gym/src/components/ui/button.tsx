import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 3 variantes — doc 08, sin excepciones. Máximo un "solido" por pantalla.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primario: 'border-primary bg-surface-container-high text-primary hover:bg-surface-container-highest',
        solido: 'border-primary bg-primary text-[#06210a] hover:bg-primary-fixed',
        ghost: 'border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-high',
      },
    },
    defaultVariants: {
      variant: 'primario',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  },
)
Button.displayName = 'Button'
