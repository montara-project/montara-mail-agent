import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { useState } from 'react'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input, InputWrapper } from '@/components/ui/input'
import { useFieldContext } from '@/hooks/form-context'

interface PasswordFieldProps {
  label?: string
  placeholder?: string
  asterisk?: boolean
}

export default function PasswordField({ label, placeholder, asterisk }: PasswordFieldProps) {
  const field = useFieldContext<string>()
  const [visible, setVisible] = useState(false)
  const errors = field.state.meta.errors
  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name} className="gap-1">
        {label}
        {asterisk && <span className="text-destructive">*</span>}
      </FieldLabel>
      <InputWrapper className="h-10">
        <Input
          id={field.name}
          name={field.name}
          type={visible ? 'text' : 'password'}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={isInvalid}
          placeholder={placeholder}
          variant="lg"
        />
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
        </button>
      </InputWrapper>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}
