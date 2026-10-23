/** The API's limits on one mail's attachments (dtos.MaxAttachments, dtos.MaxAttachmentBytes). */
const MAX_ATTACHMENTS = 10
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024

/** A file size as people read it, e.g. "2.5 MB". */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Why adding files would break the limits, or null when they fit. */
export function attachmentProblem(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) return `A mail carries at most ${MAX_ATTACHMENTS} files.`
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_ATTACHMENT_BYTES) {
    return `Attachments may total at most ${formatBytes(MAX_ATTACHMENT_BYTES)}.`
  }
  return null
}

/**
 * A request body as JSON, or, when files ride along, as a multipart form with
 * that JSON in "payload" and the files in "attachments" (how the API reads it).
 */
export function withAttachments<T extends object>(body: T, files?: File[]): T | FormData {
  if (!files?.length) return body
  const form = new FormData()
  form.append('payload', JSON.stringify(body))
  files.forEach((file) => form.append('attachments', file))
  return form
}
