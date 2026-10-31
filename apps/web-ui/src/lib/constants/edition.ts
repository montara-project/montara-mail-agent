/**
 * Community Edition (VITE_EDITION=community): one self-hosted user, so no
 * sign-up, no members and no billing. The API is the server that serves this
 * app until the user picks another under Self hosted, which only this edition
 * has. Inlined at build time, so the branches it guards drop out of the bundle.
 */
export const COMMUNITY = import.meta.env.VITE_EDITION === 'community'
