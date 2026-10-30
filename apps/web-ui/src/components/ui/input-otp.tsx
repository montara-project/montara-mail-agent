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
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
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
      <InputOTP.Group>
        {[0, 1, 2].map((index) => (
          <InputOTP.Slot key={index} index={index} />
        ))}
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        {[3, 4, 5].map((index) => (
          <InputOTP.Slot key={index} index={index} />
        ))}
      </InputOTP.Group>
    </InputOTP>
  )
}
