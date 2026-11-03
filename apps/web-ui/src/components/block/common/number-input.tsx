'use client'

import React, { type ChangeEvent } from 'react'
import { NumericFormat, PatternFormat } from 'react-number-format'

import { inputVariants } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface NumberInputProps {
  id?: string
  name?: string
  value?: string | number
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  /** true for ",", or the character itself, e.g. "." for rupiah. */
  thousandSeparator?: boolean | string
  decimalSeparator?: string
  decimalScale?: number
  prefix?: string
  suffix?: string
  allowNegative?: boolean
  disabled?: boolean
  format?: string // For pattern format like phone numbers
  mask?: string
  type?: 'numeric' | 'pattern'
  min?: number
  minLength?: number
  max?: number
  maxLength?: number
  /** Defaults to the keypad that fits: numeric for whole numbers, decimal otherwise. */
  inputMode?: 'numeric' | 'decimal'
  autoFocus?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      id,
      name,
      value,
      onBlur,
      onValueChange,
      placeholder,
      className,
      thousandSeparator = true,
      decimalSeparator,
      decimalScale = 2,
      prefix,
      suffix,
      allowNegative = true,
      disabled = false,
      format,
      mask,
      type = 'numeric',
      inputMode = decimalScale > 0 ? 'decimal' : 'numeric',
      ...props
    },
    ref
  ) => {
    // The app's own input look; data-slot lets an InputWrapper take over its frame.
    const baseClassName = cn(
      inputVariants({ variant: 'lg' }),
      'tabular-nums pointer-coarse:text-base',
      className
    )

    if (type === 'pattern' && format) {
      return (
        <PatternFormat
          getInputRef={ref}
          data-slot="input"
          inputMode={inputMode}
          id={id}
          name={name}
          format={format}
          mask={mask}
          value={value}
          onBlur={onBlur}
          onValueChange={(values) => onValueChange?.(values.value)}
          placeholder={placeholder}
          className={baseClassName}
          disabled={disabled}
          {...props}
        />
      )
    }

    return (
      <NumericFormat
        getInputRef={ref}
        data-slot="input"
        inputMode={inputMode}
        id={id}
        name={name}
        value={value}
        onBlur={onBlur}
        onValueChange={(values) => onValueChange?.(values.value)}
        thousandSeparator={thousandSeparator}
        decimalSeparator={decimalSeparator}
        decimalScale={decimalScale}
        fixedDecimalScale={decimalScale > 0}
        prefix={prefix}
        suffix={suffix}
        allowNegative={allowNegative}
        placeholder={placeholder}
        className={baseClassName}
        disabled={disabled}
        {...props}
      />
    )
  }
)

NumberInput.displayName = 'NumberInput'

export { NumberInput }

/*
Using NumberInput:
## Basic
  <NumberInput
    value={currency}
    onValueChange={setCurrency}
    prefix="$"
    placeholder="Enter amount"
    decimalScale={2}
    thousandSeparator={true}
  />

## Percentage
  <NumberInput
    value={percentage}
    onValueChange={setPercentage}
    suffix="%"
    placeholder="Enter percentage"
    decimalScale={2}
    thousandSeparator={false}
  />

## Phone Number
  <NumberInput
    type="pattern"
    format="(###) ###-####"
    mask="_"
    value={phone}
    onValueChange={setPhone}
    placeholder="(555) 123-4567"
  />

## Credit Card
  <NumberInput
    type="pattern"
    format="#### #### #### ####"
    mask="_"
    value={creditCard}
    onValueChange={setCreditCard}
    placeholder="1234 5678 9012 3456"
  />
*/
