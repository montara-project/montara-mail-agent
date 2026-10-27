# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is an individual professional who is drowning in email spread across
personal and work accounts (Gmail, Outlook, Yahoo, iCloud, Lark, Zoho, or any
IMAP provider). They want one place where everything arrives pre-sorted, with
replies already drafted for their approval. Surfaces should speak to this person
directly ("your inbox", "your accounts").

Team usage is real but secondary: members of an organization share its
mailboxes, and a super user manages every organization. Design for the
individual first; org sharing serves that person, not the reverse.

## Product Purpose

Montara Mail is an AI mail client. Connect any mix of providers to one account;
a background sync keeps every mailbox current and writes changes (read, starred,
move, delete) back to the mail server. An agent sorts new inbox mail into
`important` or `low_priority`, summarizes long threads, and drafts replies for
the user to review, edit, and approve. Full read, send, threaded reply, and
forward happen in the same place, with attachments.

Success: the user spends measurably less time in their inbox while staying the
one who decides what gets sent.

## Positioning

"Your models, your server." Each organization picks its own LLM — any OpenAI-
or Anthropic-compatible endpoint, or a self-hosted one such as Ollama — and the
entire product ships as a single self-hostable Docker image under GPL-3.0
(`community` edition). Control over model and data is the claim a neighboring
product (Superhuman, Shortwave, Gmail AI) cannot truthfully copy: they rent you
their AI; Montara runs yours, anywhere.

## Operating Context

- Hosted app at <https://app.montaramail.web.id>; the API and web app also ship
  as one Docker image for self-hosting, behind the user's own domain.
- Two build-time editions: `cloud` (hosted, open sign-up, Resend for
  verification email) and `community` (single self-hosted user, no sign-up,
  seeded `SUPER_USER`).
- Accounts: email & password, magic link, Google sign-in, TOTP two-factor with
  backup codes, activity log.
- Mailbox credentials and LLM provider secrets are encrypted in the database
  with a key derived from `APP_SECRET`; rotating it means reconnecting mailboxes.
- Background sync per mailbox (default every 5 minutes); HTML mail renders in a
  sandboxed frame; compose goes out over the account's SMTP.

## Capabilities and Constraints

- Providers: app-password connection for any IMAP/SMTP provider; OAuth for
  Google, Microsoft, Zoho; Yahoo OAuth pending provider approval; iCloud and
  Lark connect via app password.
- AI features: classification, thread summaries, reply suggestions, agent
  copilot and auto-draft into a review queue. Per-organization model choice;
  `ANTHROPIC_API_KEY` is the fallback when none is set.
- Terminology that must stay consistent: `important` / `low_priority` labels,
  agent "drafts" the user "approves"; editions `cloud` / `community`.
- Stage: registration at the hosted app is open, but the marketing posture is
  early access — access is arranged through the contact page. No public pricing;
  marketing must not publish prices or imply paid tiers that don't exist yet.
- License: GPL-3.0.

## Brand Commitments

- Name: Montara Mail (repository `montara-mail-agent`, GitHub `montara-project`).
- Logo and favicon set live in `apps/main-web/public/` (app-icon-style tile).
- Voice: plain and human ("we will set up early access for you"), no hype.
- Privacy claim is binding on every surface: email data is "used only to provide
  the service and never sold" (home FAQ, Privacy Policy).
- The marketing site's visual reference (user-provided, pinned in
  `apps/main-web/.impeccable/config.json` — Plus Jakarta Sans) is a standing
  constraint for `main-web` styling.

## Evidence on Hand

- Working product: hosted app, public repository, Docker images on GHCR
  (`cloud` and `community` editions), generated `CHANGELOG.md`.
- Marketing pages: home, contact, privacy, terms (`apps/main-web/app/`).
- Known findings tracked in `ISSUES.md`; security audit trail in git history.
- Absent, and future work must not fabricate: customer testimonials, case
  studies, usage numbers, press mentions, and pricing.

## Product Principles

1. The human sends, the agent prepares: drafts and queues, never sends alone.
2. Control is the product: your own model, optionally your own server.
3. One inbox per person first: unify the providers an individual already uses.
4. Claim only what is true: no invented proof, no public pricing while in early
   access.
5. Privacy promises are contracts, not copy.
