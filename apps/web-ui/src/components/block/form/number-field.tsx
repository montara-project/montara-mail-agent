import { NumberInput, type NumberInputProps } from '@/components/block/common/number-input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputWrapper } from '@/components/ui/input'
import { useFieldContext, useVisibleFieldErrors } from '@/hooks/form-context'

type NumberFieldProps = Omit<
  NumberInputProps,
  'id' | 'name' | 'value' | 'onBlur' | 'onValueChange'
> & {
  label?: string
  asterisk?: boolean
}

/** TextField's frame around a NumberInput; the field holds the unformatted digits as a string. */
export default function NumberField({ label, asterisk = false, ...props }: NumberFieldProps) {
  const field = useFieldContext<string>()
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
        <NumberInput
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onValueChange={(value) => field.handleChange(value)}
          aria-invalid={isInvalid}
          aria-required={asterisk || undefined}
          {...props}
        />
      </InputWrapper>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}
