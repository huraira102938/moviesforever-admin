import { SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export default function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function SelectTrigger({ children, className, ...props }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)}>
      {children}
    </span>
  )
}

export function SelectContent({ children, className, ...props }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative z-50 max-h-64 overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-md', className)} {...props}>
      {children}
    </div>
  )
}

export function SelectItem({ children, value, className, ...props }: { children: ReactNode; value: string; className?: string }) {
  return (
    <div className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground', className)} {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-current" />
      </span>
      {children}
    </div>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-sm text-gray-500">{placeholder}</span>
}