import { useSelector } from '@tanstack/react-form'
import React from 'react'

import type { Option } from '@/types/select'

import { Button, ButtonArrow } from '@/components/ui/button'
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useFieldContext } from '@/hooks/form-context'
import { cn } from '@/lib/utils'

interface ComboboxFieldProps<TData> {
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  options: Option<TData>[]
  /** Offers the typed search as a value of its own when no option contains it. */
  allowCustom?: boolean
  className?: string
  asterisk?: boolean
  disabled?: boolean
}

/** A searchable select (ReUI's combobox: a popover around a command list). */
export default function ComboboxField<TData>({
  label,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'Nothing found.',
  options,
  allowCustom = false,
  className,
  asterisk = false,
  disabled = false,
}: ComboboxFieldProps<TData>) {
  const field = useFieldContext<string>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const listId = React.useId()

  const isInvalid = !!errors?.length
  const value = field.state.value
  const selected = options.find((option) => option.value === value)
  const typed = search.trim()
  // Only when no option matches, so Enter on a partial search picks a real option.
  const custom =
    allowCustom &&
    typed !== '' &&
    !options.some((option) =>
      `${option.value} ${option.label}`.toLowerCase().includes(typed.toLowerCase())
    )

  const pick = (next: string) => {
    field.handleChange(next)
    setOpen(false)
    setSearch('')
  }

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name} className="gap-1">
        {label}
        {asterisk && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.name}
            type="button"
            variant="outline"
            role="combobox"
            mode="input"
            placeholder={!value}
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={isInvalid}
            disabled={disabled}
            onBlur={field.handleBlur}
            className={cn('h-10 w-full', className)}
          >
            <span className="truncate">{selected?.label ?? (value || placeholder)}</span>
            <ButtonArrow />
          </Button>
        </PopoverTrigger>
        <PopoverContent id={listId} className="w-(--radix-popper-anchor-width) p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {custom && (
                  <CommandItem value={typed} onSelect={() => pick(typed)}>
                    <span className="truncate">Use “{typed}”</span>
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => pick(option.value)}
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value && <CommandCheck />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
