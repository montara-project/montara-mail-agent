/**
 * Community Edition (VITE_EDITION=community): one self-hosted user, so no
 * sign-up, no members and no billing, and the API is the server that serves
 * this app. Inlined at build time, so the branches it guards drop out of the
 * bundle.
 */
export const COMMUNITY = import.meta.env.VITE_EDITION === 'community'
