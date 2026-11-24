/**
 * Excerpt from Leadlantern (src/audit.ts).
 * Shown for illustration only. The full source code is available at https://store.mikodes.com/p/leadlantern/
 *
 * Before the website check reads a business's site, it reads robots.txt the way RFC 9309 describes: the group that names
 * the tool wins over the "*" group, the longest matching rule decides, a tie goes to Allow, and "*" and "$" in a
 * path are supported without building a regular expression from untrusted text.
 */

export interface RobotsRule { allow: boolean; path: string }

/** The rules that apply to this audit: the group that names LeadlanternAudit when there is one, else the `*` group. */
export function robotsRules(text: string): RobotsRule[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let cur: { agents: string[]; rules: RobotsRule[] } | null = null;
  let inAgents = false;
  for (const raw of text.split(/\r\n|\r|\n/).slice(0, 5000)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(.*)$/.exec(raw.replace(/#.*$/, ""));
    if (!m) continue;
    const key = m[1]!.toLowerCase(), value = m[2]!.trim();
    if (key === "user-agent") {
      if (!cur || !inAgents) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase().split("/")[0]!.trim());
      inAgents = true;
    } else if (key === "allow" || key === "disallow") {
      inAgents = false;
      // an empty Disallow means "nothing is disallowed": no rule
      if (cur && value) cur.rules.push({ allow: key === "allow", path: value.slice(0, 500) });
    }
  }
  const mine = groups.filter((g) => g.agents.includes(AUDIT_AGENT.toLowerCase()));
  return (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
}

/** A robots.txt path pattern (`*` = anything, `$` = end) against a path, without a regular expression. */
function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const parts = (anchored ? pattern.slice(0, -1) : pattern).split("*");
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i === 0) {
      if (!path.startsWith(part)) return false;
      pos = part.length;
    } else if (anchored && i === parts.length - 1) {
      return path.length - part.length >= pos && path.endsWith(part);
    } else {
      const at = path.indexOf(part, pos);
      if (at < 0) return false;
      pos = at + part.length;
    }
  }
  return anchored ? pos === path.length : true;
}

/** The longest matching rule decides; a tie goes to Allow; no matching rule means allowed. */
export function robotsAllows(rules: RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ------------------------------------------------------------------ the store

type Row = Record<string, unknown>;

function toAudit(r: Row): Audit {
  let checks: AuditChecks | null = null;
  if (typeof r.checks === "string" && r.checks) {
    try { const v: unknown = JSON.parse(r.checks); if (typeof v === "object" && v !== null && !Array.isArray(v)) checks = v as AuditChecks; } catch { checks = null; }
  }
