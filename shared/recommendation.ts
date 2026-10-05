import type { Requirement, VerifiedEvidence } from './evidence.ts';

export const RULE_VERSION = '2.0.0';
export const labels = ['Move to next round', 'Maybe', 'Not now'] as const;
export type Recommendation = typeof labels[number];
export type EvidenceRule = Requirement & { groups: string[][]; interviewOnly: boolean; assessmentMonth?: string };
export type CandidateResult = { evidence: VerifiedEvidence[]; recommendation: Recommendation; coverage: number; missingMustHaves: string[]; reason: string; ruleVersion: string };

// Each group must match. Alternatives within a group are equivalent phrases the recruiter confirms.
const concepts: [RegExp, string[]][] = [
  [/service desk/i, ['service desk', 'service-desk', 'helpdesk', 'help desk']],
  [/active directory/i, ['active directory', 'AD']], [/\bVPN\b/i, ['VPN', 'VPNs', 'virtual private network']],
  [/Microsoft 365|O365|Office 365/i, ['Microsoft 365', 'Office 365', 'Office365', 'O365', 'M365']],
  [/\bITIL\b/i, ['ITIL']], [/ticketing/i, ['ticketing', 'ServiceNow', 'Service Now', 'Remedy', 'Jira', 'Freshdesk']],
  [/\bDLP\b/i, ['DLP', 'data loss prevention']], [/\bAzure\b/i, ['Azure']],
  [/MDM|Intune/i, ['MDM', 'Intune', 'mobile device management']],
  [/application support/i, ['application support', 'application troubleshooting']],
  [/Windows/i, ['Windows']], [/macOS/i, ['macOS', 'Mac OS']],
  [/Outlook/i, ['Outlook']], [/Teams/i, ['Teams']], [/OneDrive/i, ['OneDrive']], [/SharePoint/i, ['SharePoint']],
  [/password/i, ['password']], [/group updates/i, ['group membership', 'group management', 'groups']],
  [/user management/i, ['user management', 'user accounts', 'user creation']],
  [/installation/i, ['installation', 'install']], [/configuration/i, ['configuration', 'configure']],
  [/connectivity/i, ['connectivity', 'connection']], [/authentication/i, ['authentication', 'login']],
  [/printer/i, ['printer', 'printers']], [/hardware/i, ['hardware']], [/peripheral/i, ['peripherals', 'peripheral']],
  [/\bLAN\b/i, ['LAN']], [/Wi-Fi/i, ['Wi-Fi', 'WiFi', 'wireless']], [/\bDNS\b/i, ['DNS']],
  [/network troubleshooting/i, ['network troubleshooting', 'network issues', 'network connectivity']],
  [/escalat/i, ['escalation', 'escalate', 'escalated']], [/documentation/i, ['documentation', 'documented', 'documenting']],
  [/\bL2\/L3\b/i, ['L2', 'L3', 'level 2', 'level 3']], [/\bSLA/i, ['SLA', 'SLAs', 'service level']],
  [/queues/i, ['queue', 'queues']], [/phone/i, ['phone', 'calls']], [/email/i, ['email', 'e-mail']], [/chat/i, ['chat']],
  [/prioritize/i, ['prioritize', 'priority', 'prioritization']], [/resolve tickets/i, ['resolve', 'resolution', 'resolved']],
  [/international/i, ['international', 'global']], [/client-facing/i, ['client', 'customer', 'end-user', 'end user']],
  [/bachelor/i, ['bachelor', 'B.Tech', 'B.E', 'B.Sc']],
  [/Information Technology, Computer Science/i, ['information technology', 'computer science', 'B.Tech', 'B.E']],
  [/certifications/i, ['certified', 'certification', 'CompTIA']],
];
export function draftRule(requirement: Requirement): EvidenceRule {
  const interviewOnly = /communication|culture|personality|analytical skills/i.test(requirement.text);
  const groups = concepts.filter(([pattern]) => pattern.test(requirement.text)).map(([, terms]) => terms);
  return { ...requirement, groups: groups.length ? groups : [[requirement.text.replace(/[.]$/, '').trim()]], interviewOnly };
}
export function ruleText(rule: EvidenceRule): string { return rule.groups.map(group => group.join(' / ')).join('; '); }
export function parseGroups(text: string): string[][] { return text.split(';').map(group => group.split('/').map(term => term.trim()).filter(Boolean)).filter(group => group.length); }
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mentions(text: string, term: string) { return new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'iu').test(text); }

export function recommend(requirements: EvidenceRule[], cv: string): CandidateResult {
  if (cv.trim().length < 30) throw new Error('Unable to assess: too little readable CV text.');
  if (!requirements.length || requirements.some(r => !r.interviewOnly && (!r.groups.length || r.groups.some(g => !g.length)))) throw new Error('Confirm an evidence rule for every requirement.');
  if (new Set(requirements.map(r => r.id)).size !== requirements.length) throw new Error('Requirement IDs must be distinct.');
  const lines = [...cv.matchAll(/[^\r\n]+/g)].map(match => ({ text: match[0], start: match.index!, end: match.index! + match[0].length }));
  const evidence: VerifiedEvidence[] = requirements.map(r => {
    const question = `Verify the candidate’s experience with: ${r.text}`;
    if (r.interviewOnly) return { requirementId: r.id, status: 'needs_checking', quotes: [], explanation: 'This quality needs a recruiter call and is excluded from CV coverage and must-have gates.', question };
    const range = r.text.match(/(\d+)\s*[-–]\s*(\d+)\s*years/i);
    if (range) {
      const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const periods: [number, number][] = [];
      const quotes = lines.filter(line => /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ .,/-]*(?:19|20)\d{2}/i.test(line.text) && !/degree|university|college|school|bachelor/i.test(line.text));
      const month = (text: string): number => /present|current/i.test(text) ? Number(r.assessmentMonth?.slice(0,4)) * 12 + Number(r.assessmentMonth?.slice(5,7)) - 1 : Number(text.match(/(?:19|20)\d{2}/)![0]) * 12 + monthNames.indexOf(text.slice(0,3).toLowerCase());
      for (const quote of quotes) for (const match of quote.text.matchAll(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ .,/-]*(?:19|20)\d{2})\s*(?:to|[-–—])\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ .,/-]*(?:19|20)\d{2}|Present|Current)/gi)) {
        const a = month(match[1]), b = month(match[2]); if (Number.isFinite(b) && b >= a) periods.push([a,b]);
      }
      periods.sort((a,b) => a[0]-b[0]); const merged: [number,number][] = [];
      for (const period of periods) { const last = merged.at(-1); if (last && period[0] <= last[1]) last[1] = Math.max(last[1],period[1]); else merged.push([...period]); }
      const duration = merged.reduce((sum,[a,b]) => sum+b-a,0);
      const inside = periods.length && duration - merged.length >= Number(range[1])*12 && duration + merged.length <= Number(range[2])*12;
      return { requirementId:r.id, status: inside ? 'found' : 'partial', quotes, explanation: periods.length ? `Job dates indicate approximately ${duration} months at the confirmed assessment month ${r.assessmentMonth ?? 'unspecified'}, counting overlaps once. Relevant job scope and exact dates need a call; an outside range remains uncertain.` : 'No complete job-date intervals could be calculated. Verify relevant duration in a call.', question };
    }
    const matching = lines.filter(line => r.groups.some(group => group.some(term => mentions(line.text, term))));
    const uncertain = matching.filter(line => /\b(no|not|never|without|lack|learning|learn|beginner|basic|exposure|familiar|training|course|interested|willing)\b/i.test(line.text));
    const positive = matching.filter(line => !uncertain.includes(line));
    const matched = r.groups.filter(group => positive.some(line => group.some(term => mentions(line.text, term))) && !uncertain.some(line => /\b(no|not|never|without|lack)\b/i.test(line.text) && group.some(term => mentions(line.text, term)))).length;
    const quotes = matching; // All selected lines retain exact source offsets; no paraphrased evidence.
    const contradiction = matching.some(line => r.groups.some(group => group.some(term => new RegExp(`\\b(?:no|without|never used|do not have)\\s+(?:experience (?:with|in)\\s+)?${escape(term)}(?![\\p{L}\\p{N}])`, 'iu').test(line.text))));
    const status = contradiction ? 'conflicting' : matched === r.groups.length ? 'found' : matching.length ? 'partial' : 'not_found';
    return { requirementId: r.id, status, quotes, explanation: status === 'found' ? 'The CV states every phrase group in your confirmed evidence rule. This establishes a documented claim, not verified ability.' : status === 'conflicting' ? 'The CV explicitly states a negative claim about a required phrase. Review the exact quote before deciding.' : status === 'partial' ? 'Some required phrases are absent or appear in a limited, learning or negative claim. Check the full context in a recruiter call.' : 'No CV evidence matched the confirmed phrases. Different wording may have been missed; this does not establish that the candidate lacks the skill.', question };
  });
  const eligible = requirements.filter(r => !r.interviewOnly);
  const points = evidence.reduce((sum, row) => sum + (row.status === 'found' ? 1 : row.status === 'partial' ? .5 : 0), 0);
  const coverage = eligible.length ? Math.round(points / eligible.length * 10000) / 100 : 0;
  const missingMustHaves = eligible.filter(r => r.mustHave && evidence.find(row => row.requirementId === r.id)!.status === 'not_found' || (r.mustHave && evidence.find(row => row.requirementId === r.id)!.status === 'conflicting')).map(r => r.text);
  const allMust = eligible.filter(r => r.mustHave).every(r => evidence.find(row => row.requirementId === r.id)!.status === 'found');
  const recommendation: Recommendation = missingMustHaves.length ? 'Not now' : allMust && coverage >= 80 ? 'Move to next round' : 'Maybe';
  return { evidence, recommendation, coverage, missingMustHaves, ruleVersion: RULE_VERSION, reason: missingMustHaves.length ? 'A confirmed must-have has no matching CV evidence or an explicit negative claim. Review wording and context before deciding.' : recommendation === 'Move to next round' ? 'Every CV-checkable must-have has full evidence and requirement coverage is at least 80%.' : 'Partial evidence or coverage below 80% needs recruiter review.' };
}
