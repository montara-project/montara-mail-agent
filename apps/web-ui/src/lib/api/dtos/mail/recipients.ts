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
