import type { ChangeEvent } from 'react'

import { useSelector } from '@tanstack/react-form'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useFieldContext } from '@/hooks/form-context'

type TextareaFieldProps = React.ComponentProps<'textarea'> & {
  label?: string
  description?: string
  onChange?: (value: string) => void
  asterisk?: boolean
}

export default function TextareaField({
  label,
  description,
  placeholder,
  onChange,
  disabled,
  asterisk = false,
  ...props
}: TextareaFieldProps) {
  const field = useFieldContext<string>()
  const errors = useSelector(field.store, (state) => state.meta.errors)

  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name} className="gap-1">
        {label}
        {asterisk && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          field.handleChange(e.target.value)
          onChange?.(e.target.value)
        }}
        aria-invalid={isInvalid}
        placeholder={placeholder}
        disabled={disabled}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
