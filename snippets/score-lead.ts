/**
 * Excerpt from Leadlantern (src/score.ts). Shown for illustration only.
 * The full source code is available at https://store.mikodes.com/p/leadlantern/
 *
 * An explainable opportunity score for a local business. Instead of a black-box model, every rule is
 * a point value plus one plain sentence, and fires only on a fact that was really checked. The result
 * is a 0-100 score and the strongest reasons, ready to quote in a first message.
 */
// … types (Lead, Audit, Facts) and most of the rule table omitted

interface Rule {
  points: number;
  when: (f: Facts) => boolean;
  say: string | ((f: Facts) => string);
}

const ok = (f: Facts): f is Facts & { c: AuditChecks } => f.c !== null;
const slow = (f: Facts) => ok(f) && f.c.pagespeed !== null && f.c.pagespeed.performance < 50;
const speedLine = (f: Facts) => `Google rates the site's speed on phones at ${f.c?.pagespeed?.performance ?? 0} out of 100.`;

/** The rule table. Points are relative inside a profile; the total is capped at 100. */
export const RULES: Record<ProfileId, Rule[]> = {
  // …
  booking: [
    { points: 60, when: (f) => ok(f) && f.c.booking.length === 0, say: "The site has no online booking." },
    { points: 55, when: (f) => f.noWebsite, say: "The business has no website." },
    { points: 15, when: (f) => ok(f) && !f.c.contactForm, say: "There is no contact form on the site." },
    { points: 15, when: (f) => ok(f) && !f.c.mobileViewport, say: "The site has no mobile layout." },
    { points: 5, when: (f) => ok(f) && f.c.chat.length === 0, say: "There is no chat on the site." },
    // …
  ],
  // …
};

const MAX_REASONS = 6;


/** A transparent rule score: every point comes from a fact in the lead or its audit. */
export function scoreLead(lead: Lead, audit: Audit | null, profile: ProfileId): Scored {
  const social = socialSite(lead.website);
  const noWebsite = !lead.website.trim() || social !== null;
  // an audit made before the lead had a web address says nothing about the site it has now
  const a = noWebsite || audit?.status === "no_website" ? null : audit;
  const unreachable = a?.status === "unreachable";
  const f: Facts = {
    lead, noWebsite, social, unreachable,
    noHttps: unreachable && /^http:\/\//i.test(a?.url ?? ""),
    c: a?.status === "ok" ? a.checks : null,
    year: new Date(a?.createdAt ?? 0).getUTCFullYear(),
  };
  const hits = (RULES[profile] ?? RULES.website)
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.when(f))
    .sort((x, y) => y.r.points - x.r.points || x.i - y.i);
  const total = hits.reduce((n, h) => n + h.r.points, 0);
  return {
    score: Math.min(100, total),
    reasons: hits.slice(0, MAX_REASONS).map(({ r }) => (typeof r.say === "string" ? r.say : r.say(f))),
  };
}
