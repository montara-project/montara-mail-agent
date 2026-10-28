/** The API's cap on the addresses of one outgoing mail, To and Cc together. */
export const MAX_RECIPIENTS = 20

const EMAIL = /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/

/** Addresses typed into one box, separated by commas, semicolons or spaces. */
export function parseRecipients(value: string) {
  return value.split(/[\s,;]+/).filter(Boolean)
}

/** Whether every address in the list is a plain email address. */
export function allEmails(recipients: string[]) {
  return recipients.every((r) => EMAIL.test(r))
}

/** Why a mail can't go to these To and Cc lists, or null when it can. */
export function recipientProblem(to: string[], cc: string[]) {
  if (to.length === 0) return 'Add at least one recipient.'
  if (!allEmails([...to, ...cc])) return 'One of the addresses is not a valid email.'
  if (to.length + cc.length > MAX_RECIPIENTS) {
    return `A mail goes to at most ${MAX_RECIPIENTS} addresses.`
  }
  return null
}
