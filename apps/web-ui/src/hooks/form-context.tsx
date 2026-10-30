import { createFormHookContexts, useSelector } from '@tanstack/react-form'

export const { fieldContext, useFieldContext, formContext, useFormContext } =
  createFormHookContexts()

/**
 * The field's errors once they're worth showing: form-wide validators flag
 * every field on the first keystroke, so a field stays quiet until it's left
 * or the form is submitted.
 */
export function useVisibleFieldErrors() {
  const field = useFieldContext<unknown>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const blurred = useSelector(field.store, (state) => state.meta.isBlurred)
  const submitted = useSelector(field.form.store, (state) => state.submissionAttempts > 0)
  return blurred || submitted ? errors : []
}
