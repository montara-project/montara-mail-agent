import type { ButtonHTMLAttributes } from 'react'

import { useSelector } from '@tanstack/react-form'
import { Loader2, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useFormContext } from '@/hooks/form-context'
import { cn } from '@/lib/utils'

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon?: LucideIcon
  className?: string
}

export default function SubmitButton({
  label,
  icon: Icon,
  className,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext()
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)

  return (
    <Button
      type="submit"
      className={cn('h-10 px-6', className)}
      aria-busy={isSubmitting}
      disabled={isSubmitting}
      {...props}
    >
      {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </Button>
  )
}
