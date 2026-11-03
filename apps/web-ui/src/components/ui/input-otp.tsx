import { InputOTP, REGEXP_ONLY_DIGITS } from '@heroui/react/input-otp'

const SLOTS = 6

/**
 * A 6-digit code, on HeroUI's InputOTP. Its slots are styled in styles.css
 * from this app's tokens: HeroUI's own stylesheet would replace them globally.
 */
export function OTPCodeInput({
  id,
  value,
  onChange,
  autoFocus,
  size = 'md',
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  /**
   * md stretches the cells across a narrow sign-in card; sm caps them at 44px,
   * for wide cards where stretched cells grow far too large.
   */
  size?: 'md' | 'sm'
}) {
  return (
    <InputOTP
      id={id}
      maxLength={SLOTS}
      pattern={REGEXP_ONLY_DIGITS}
      // Authenticator apps often copy the code as "123 456".
      pasteTransformer={(text) => text.replace(/\s/g, '')}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
    >
      {/* Six uniform cells per the design: no separator between the halves. */}
      <InputOTP.Group>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <InputOTP.Slot
            key={index}
            index={index}
            className={size === 'sm' ? 'h-11 max-w-11 text-lg pointer-coarse:h-11' : undefined}
          />
        ))}
      </InputOTP.Group>
    </InputOTP>
  )
}
