/**
 * Excerpt from Leadlantern (src/outreach.ts).
 * Shown for illustration only. The full source code is available at https://store.mikodes.com/p/leadlantern/
 *
 * A first cold e-mail only goes out when every rule passes: wording rules (no fake "Re:" subject, no promised results),
 * a daily limit, and more rules not shown (do-not-contact list, gap between sends, sender identity). Sends run one
 * at a time so each sees what the one before recorded. Every rule returns a plain-English reason.
 */

/** Subject prefixes that pretend the message answers an earlier one (English and the common European forms). */
const REPLY_PREFIX = /^\s*(?:re|aw|antw|sv|vs|odp|rif|fwd?|wg|tr)\s*(?:\[\d+\])?\s*[:\uff1a]/i;

// …

/** The rules about the words alone, in guard order: EMPTY, TOO_LONG, FAKE_REPLY_PREFIX, PROMISE_OF_RESULTS. */
export function checkText(subject: string, body: string): GuardCheck[] {
  const sub = subject.trim(), text = body.trim();
  const promise = PROMISE_PATTERNS.some((p) => p.test(sub) || p.test(text));
  return [
    { code: "EMPTY", ok: sub !== "" && text !== "", text: sub === "" ? "The message has no subject." : text === "" ? "The message has no text." : "The message has a subject and a text." },
    { code: "TOO_LONG", ok: text.length <= MAX_BODY_CHARS, text: text.length <= MAX_BODY_CHARS
      ? "The text is short enough."
      : `The text has ${text.length} characters. A first message may have 2,000 at most: cut it down.` },
    { code: "FAKE_REPLY_PREFIX", ok: !REPLY_PREFIX.test(sub), text: REPLY_PREFIX.test(sub)
      ? "The subject starts like a reply or a forward (\"Re:\"), but this is a first message. Change the subject."
      : "The subject does not pretend to be a reply." },
    { code: "PROMISE_OF_RESULTS", ok: !promise, text: promise
      ? "The message promises an outcome (a sure win, a place in search results, a figure). Say what you saw, not what will happen."
      : "The message promises no result." },
  ];
}

// …

  const dailyLimit = setting(s, "outreach.dailyLimit", 30, 1, 200);
  const today = (db.prepare("SELECT COUNT(*) n FROM messages WHERE status = 'sent' AND channel = 'email' AND sent_at > ?").get(now - DAY) as { n: number }).n;
  add("DAILY_LIMIT", today < dailyLimit, `${today} of ${dailyLimit} e-mails went out in the last 24 hours.`,
    `${plural(today, "e-mail", "e-mails")} went out in the last 24 hours. The limit is ${dailyLimit} a day: continue tomorrow.`);

// …

const turns = new WeakMap<DB, Promise<unknown>>();

/** Runs sends on one database one after another, so each one sees what the one before it recorded. */
function inTurn<T>(db: DB, job: () => Promise<T>): Promise<T> {
  const before = turns.get(db) ?? Promise.resolve();
  const mine = before.then(job, job);
  turns.set(db, mine.catch(() => undefined));
  return mine;
}
