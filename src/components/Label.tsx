import { LabelHTMLAttributes } from 'react'
import { cn } from './cn'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export default function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  )
}