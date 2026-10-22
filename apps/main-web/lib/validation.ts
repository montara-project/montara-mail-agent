import z from 'zod'

// Field-level zod helpers shared by the request DTO schemas. `attribute` is the
// field name shown in the message.

const required = (attribute: string) => `The ${attribute} field is required.`
const mustBeString = (attribute: string) => `The ${attribute} must be a string.`
const mustBeNumber = (attribute: string) => `The ${attribute} must be a number.`
const mustBeInteger = (attribute: string) => `The ${attribute} must be an integer.`

/**
 * Required string validation
 * @param attribute - The attribute name
 * @returns Zod string validator
 */
export const requiredString = (attribute: string) =>
  z
    .string({
      error: (issue) => (issue.input === undefined ? required(attribute) : mustBeString(attribute)),
    })
    .trim()
    .nonempty(required(attribute))

/**
 * Required non-negative integer validation
 * @param attribute - The attribute name
 * @returns Zod number validator
 */
export const requiredNonNegativeInteger = (attribute: string) =>
  z
    .number({
      error: (issue) => (issue.input === undefined ? required(attribute) : mustBeNumber(attribute)),
    })
    .int(mustBeInteger(attribute))
    .min(0, `The ${attribute} must be at least 0.`)

/**
 * Optional number validation
 * @param attribute - The attribute name
 * @returns Zod number validator
 */
export const optionalNumber = (attribute: string) =>
  z
    .number({ error: mustBeNumber(attribute) })
    .int(mustBeInteger(attribute))
    .optional()

/**
 * Optional string validation
 * @param attribute - The attribute name
 * @returns Zod string validator
 */
export const optionalString = (attribute: string) =>
  z.string({ error: mustBeString(attribute) }).optional()

/**
 * Required enum validation; the accepted values are the source of truth for
 * the union type it validates.
 */
export const requiredEnum = <const T extends readonly [string, ...string[]]>(
  values: T,
  attribute: string
) => z.enum(values, { error: `The selected ${attribute} is invalid.` })
