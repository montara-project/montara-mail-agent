import { createFormHook } from '@tanstack/react-form'

import ComboboxField from '@/components/block/form/combobox-field'
import PasswordField from '@/components/block/form/password-field'
import SelectField from '@/components/block/form/select-field'
import SubmitButton from '@/components/block/form/submit'
import TextField from '@/components/block/form/text-field'
import TextareaField from '@/components/block/form/textarea-field'

import { fieldContext, formContext } from './form-context'

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextareaField,
    PasswordField,
    SelectField,
    ComboboxField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
