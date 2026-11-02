import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge only knows Tailwind's own radius names, so the theme's extra
// ones (--radius-control, --radius-chip, --radius-tag) never replaced a
// later `rounded-*` and the cascade picked the winner instead.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['control', 'chip', 'tag'] }],
    },
  },
})

/**
 * Merge Tailwind CSS classes
 * @param inputs - Class names to merge
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
