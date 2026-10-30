import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input, InputWrapper } from '@/components/ui/input'
import { useFieldContext, useVisibleFieldErrors } from '@/hooks/form-context'

interface PasswordFieldProps {
  label?: string
  placeholder?: string
  asterisk?: boolean
  autoComplete?: string
}

export default function PasswordField({
  label,
  placeholder,
  asterisk,
  autoComplete,
}: PasswordFieldProps) {
  const field = useFieldContext<string>()
  const [visible, setVisible] = useState(false)
  const errors = useVisibleFieldErrors()
  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name} className="gap-1">
        {label}
        {asterisk && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </FieldLabel>
      <InputWrapper className="h-10 pointer-coarse:h-11">
        <Input
          id={field.name}
          name={field.name}
          type={visible ? 'text' : 'password'}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={isInvalid}
          aria-required={asterisk || undefined}
          autoComplete={autoComplete}
          placeholder={placeholder}
          variant="lg"
        />
        {/* The ::after grows the 16px icon to a 44px tap target without moving it. */}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground relative after:absolute after:-inset-3.5"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </InputWrapper>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}
