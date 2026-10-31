/**
 * Capitalize first letter of each word in a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalizeFirstLetter(str: string): string {
  const specialCharsRegex = /[-`~!@#$%^&*_|=?;:'",<>]/gi

  return str
    .replace(specialCharsRegex, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** A token count, compact: 12,345,678 becomes 12.3M, 10,000,000 becomes 10M. */
export const formatTokens = (n: number) => compactNumber.format(n)

/** An amount in rupiah: Rp10.000. */
export const formatRupiah = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`
