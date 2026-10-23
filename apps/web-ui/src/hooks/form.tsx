import { createFormHook } from '@tanstack/react-form'

import PasswordField from '@/components/block/form/password-field'
import SelectField from '@/components/block/form/select-field'
import SubmitButton from '@/components/block/form/submit'
import TextField from '@/components/block/form/text-field'

import { fieldContext, formContext } from './form-context'

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    PasswordField,
    SelectField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
