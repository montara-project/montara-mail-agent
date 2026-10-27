package models

// Built-in skills adapted from published agent skills, cut down to what one
// email or one reply draft needs. Both sources are MIT licensed; their notices
// are in THIRD_PARTY_NOTICES.md at the repository root.

// humanizeInstruction is adapted from the humanizer skill (v3.1.0) by Siqi
// Chen, https://github.com/blader/humanizer, itself based on Wikipedia's
// "Signs of AI writing".
const humanizeInstruction = `Rewrite the text so it reads like the person wrote it, not a chatbot. Keep what it says and do not make anything up: no new fact, name, number, date or quote.

Remove these AI tells, strongest first:
1. "Not X but Y" contrasts (it's not just X, it's Y; X rather than Y): state the point directly.
2. One-line closers and dramatic fragments that repeat the point ("That's the real win.", "Let that sink in."): cut them.
3. Sayings that sound deep ("at its core", "the real question is"): say the specific thing.
4. Staged run-ups before the point ("Here's the thing:", "Let me be honest:"): start with the point.
5. Answers to objections nobody raised.
6. Forced triads: lists of three that do not need three items.
7. Several sentences in a row that open the same way.
8. Dashes as the universal connector: use a comma, a period, or a word that says how the clauses relate.
9. Stacked qualifiers and hedges that make every claim sound unsure.
10. Overused AI words: additionally, align with, crucial, delve, enhance, foster, garner, highlight (verb), intricate, key (adjective), landscape, meticulous, pivotal, robust, seamless, showcase, testament, underscore, valuable, vibrant.
11. Inflated significance and sales language: "a testament to", "groundbreaking", "nestled", "stunning", "commitment to".
12. Avoiding is, are and has: "serves as", "stands as", "boasts".
13. Bold labels and decorative formatting in what should be plain prose.
14. Chatbot residue used as filler: "I hope this email finds you well", "Great question!", "I hope this helps", "Feel free to reach out".
15. Re-explaining what the reader already knows: in a reply, lead with the answer or the decision.

Then read it aloud and vary the sentence length. Keep the writer's voice: their opinions, a specific odd detail, an aside, plain greetings and sign-offs. If your persona has a STYLE, match it. Leave a phrase alone when it is a quote, a name, or clearly chosen on purpose.`

// copyEditInstruction is adapted from the copy-editing skill (the Seven
// Sweeps) in marketingskills by Corey Haines,
// https://github.com/coreyhaines31/marketingskills.
const copyEditInstruction = `Edit the text in these sweeps, in order, without changing what it means or adding claims:
1. Clarity: one idea per sentence, plain words over jargon, no ambiguous "it" or "this", no point buried under qualifications.
2. Voice and tone: one consistent register that fits the person and the relationship, with no slide from casual into corporate.
3. So what: every sentence earns its place for the reader; cut filler, throat-clearing and repeats.
4. Prove it: no unsupported "best", "leading" or "guaranteed"; soften or cut a claim the text cannot back, and never invent proof.
5. Specificity: concrete over vague ("improve", "optimize", "soon"); keep the real numbers, dates and names already there.
6. Emotion: warm where the moment calls for it, never gushing or salesy.
7. Zero risk: the ask or next step is clear, easy and low effort; remove anything that makes saying yes harder.

Also prefer active voice, short paragraphs and contractions where the tone allows, and leave out AI tells such as "I hope this finds you well", "delve", "leverage" and dashes everywhere.`

// prospectReplyInstruction is adapted from the cold-email skill and its
// reply-handling reference in marketingskills by Corey Haines.
const prospectReplyInstruction = `Write the reply to a prospect or contact in a B2B sales conversation: an answer to outreach, or the next follow-up in the thread.

First decide what the email is, then answer it that way:
- Positive ("let's talk", "send times"): thank them in one line and propose two specific times, offering to fit theirs instead.
- Information request ("what does it cost?", "do you work with X?"): answer the actual question briefly, then offer a short call.
- Objection ("we already use X", "no budget", "not a priority"): answer once, briefly, and make it easy to say no. For "we use X", name the one situation where teams like theirs still look elsewhere and ask if it applies; for "no budget", ask when budgets are set or offer something that needs none; for "not a priority", ask what is.
- Not now ("next quarter"): thank them, say you will be in touch at the time they gave, and stop there.
- Referral ("talk to Sam"): thank them and say you will reach that person, citing them.
- Wrong person: ask once who owns it.
- Unsubscribe or hostile: a short apology and a confirmation that they will not hear from you again. Never argue.
- A follow-up after silence: add something new (a different angle, a useful resource), never "just checking in".

Write like a peer, not a vendor: short and plain, with contractions, "you" more than "we", and one low-friction ask ("Worth a look?"). Every sentence must earn its place. No "I hope this email finds you well", "leverage", "synergy" or "best-in-class". Never invent prices, customers, results or dates; mark what the person must fill in as [add: ...].`

// objectionReplyInstruction is adapted from the sales-enablement skill and
// its objection library in marketingskills by Corey Haines.
const objectionReplyInstruction = `Write the reply to a customer or prospect who raised an objection: price ("too expensive", "the competitor is cheaper"), timing ("not now", "next quarter"), competition ("we use X", "what makes you different?"), authority ("I need to check with my boss"), the status quo ("what we have works"), or a technical one ("does it integrate?", "security?", "can it scale?").

1. Name to yourself the concern behind the words and answer that concern, not just the words. If two readings fit, ask the question that tells them apart.
2. Acknowledge it plainly. Do not defend the price straight away.
3. Address it: weigh the cost against what the problem costs them today, offer a smaller start or a pilot, give the one specific difference for teams like theirs, offer what helps them make the case to the decision-maker, or point to the documentation they need.
4. Bring at most one proof point, and only one the thread or your persona's MEMORY supports. Never invent a statistic, customer, price or competitor figure, and do not repeat their claim about a competitor as fact; mark a missing proof as [add: ...].
5. End with one question that moves the conversation forward.

If the objection shows a real gap in fit, say so honestly and suggest a narrower scope instead of pushing. Keep it short and warm: an email, not a talk track.`

// pressReplyInstruction is adapted from the public-relations skill and its
// press-platforms reference in marketingskills by Corey Haines.
const pressReplyInstruction = `Write the reply to a journalist, editor, podcaster or press request: an interview request, a request for comment, or a query from a press platform.

Shape it as a one-sentence intro, a one-sentence credential that matters for their story, then the answer: two or three sentences that answer the question they actually asked, with one specific, quotable example or detail. Offer what they need next (a call, more detail, assets), add a ready-to-use attribution line ("Name, Title at Company"), and say when you can deliver if they gave a deadline.

Give expert commentary, never a product pitch. Be specific: generic advice any expert could give gets cut. Stay accurate and on the record: do not invent data, quotes, customers or dates, and mark what the person must supply as [add: ...]. On a crisis or a sensitive topic, keep to confirmed facts, do not speculate, and say when there will be more. If the request is not a fit, decline politely in two lines.`
