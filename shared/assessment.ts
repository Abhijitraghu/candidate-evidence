import type { RawEvidence, Requirement, VerifiedEvidence } from './evidence.ts';

export type Passage = { id: string; text: string };
export type SelectedEvidence = Omit<RawEvidence, 'quotes'> & { passageIds: string[] };

// Every passage is an unchanged substring. Blank lines and wrapping inside it are preserved.
export function buildPassages(text: string): Passage[] {
  const passages: Passage[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    for (let offset = 0; offset < trimmed.length; offset += 1400) {
      passages.push({ id: `p${passages.length + 1}`, text: trimmed.slice(offset, offset + 1400) });
    }
  }
  return passages;
}

export function selectedEvidence(rows: SelectedEvidence[], passages: Passage[]): RawEvidence[] {
  const byId = new Map(passages.map(passage => [passage.id, passage.text]));
  return rows.map(({ passageIds, ...row }) => ({ ...row, quotes: passageIds.map(id => {
    const quote = byId.get(id);
    if (quote === undefined) throw new Error('Unknown CV passage.');
    return quote;
  }) }));
}

export function displayExplanation(text: string): string {
  // Passage references are implementation details, not recruiter-facing citations.
  // Uppercase P1/P2 incident priorities and all original quote text remain intact.
  return text.replace(/\s*\((?:p\d+(?:\s*[-–]\s*p\d+)?(?:\s*(?:,|and)\s*)?)+\)/g, '');
}

function jobMonths(quotes: string[]): { months: number; uncertainty: number } | null {
  const date = '(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\\s/.,-]*(?:\\d{1,2}(?:st|nd|rd|th)?[,\\s]+)?(?:19|20)\\d{2})';
  const period = new RegExp(`(${date})\\s*(?:[-–—]|to)\\s*(${date}|Present|Current)`, 'gi');
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const toMonth = (value: string) => {
    if (/present|current/i.test(value)) { const now = new Date(); return now.getUTCFullYear() * 12 + now.getUTCMonth(); }
    return Number(value.match(/(?:19|20)\d{2}/)![0]) * 12 + monthNames.indexOf(value.slice(0, 3).toLowerCase());
  };
  const intervals: [number, number][] = [];
  for (const quote of quotes) {
    // A quoted qualification/date is never job experience.
    if (/\b(?:degree|university|college|school|bachelor)\b|B[.\s]?(?:Tech|Com|Sc|E)\b/i.test(quote)) continue;
    for (const match of quote.matchAll(period)) {
      const start = toMonth(match[1]), end = toMonth(match[2]);
      if (end >= start) intervals.push([start, end]);
    }
  }
  if (!intervals.length) return null;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return { months: merged.reduce((total, [start, end]) => total + end - start, 0), uncertainty: merged.length };
}

function namedTools(text: string): string[] {
  const list = text.match(/^Experience with\s+(.+?)[.]?$/i);
  return list ? list[1].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(part => part.trim()) : [];
}

function mentionsTool(tool: string, evidence: string): boolean {
  if (/\bDLP\b|data loss prevention/i.test(tool)) return /\bDLP\b|data loss prevention/i.test(evidence);
  if (/\bAzure\b/i.test(tool)) return /\bAzure\b/i.test(evidence);
  if (/\bMDM\b|Intune|mobile device management/i.test(tool)) return /\bMDM\b|Intune|mobile device management/i.test(evidence);
  if (/application support/i.test(tool)) return /application|web-based|software/i.test(evidence);
  // Only apply the specific tool safeguards above; other tasks remain a semantic review.
  return true;
}

// These qualities cannot be established from a CV, even when its self-description is exact.
export function applyEvidencePolicy(requirements: Requirement[], rows: VerifiedEvidence[]): VerifiedEvidence[] {
  return rows.map(row => {
    if (row.verificationIssue) return row;
    const requirement = requirements.find(r => r.id === row.requirementId)!;
    if (/\bcommunication\b|\bculture\b|\bpersonality\b/i.test(requirement.text)) {
      return { ...row, status: 'needs_checking', explanation: 'The CV cannot establish communication quality, culture fit or personality. Any quoted text is a candidate claim or a description of support channels; verify ability in a recruiter call.' };
    }
    if (['found', 'partial'].includes(row.status) && /strong knowledge|\bproficien|\bexpert|\bexcellent|analytical skills/i.test(requirement.text)) {
      return { ...row, status: 'partial', explanation: 'The CV claims related skills or task experience. The depth, quality and efficiency of that work require a recruiter check; these passages do not establish the requested proficiency level.' };
    }
    const tools = namedTools(requirement.text);
    if (['found', 'partial'].includes(row.status) && tools.length) {
      const quoted = row.quotes.map(q => q.text).join('\n');
      const missing = tools.filter(tool => !mentionsTool(tool, quoted));
      if (missing.length) return { ...row, status: missing.length === tools.length ? 'needs_checking' : 'partial',
        explanation: `The selected CV passages do not explicitly establish ${missing.join(', ')}. Other related task claims may be present, but ordinary Microsoft 365 or Intune work does not establish DLP or Azure experience. Verify each named tool separately.` };
    }
    const range = requirement.text.match(/(\d+)\s*[-–]\s*(\d+)\s*years/i);
    if (['found', 'partial'].includes(row.status) && range) {
      const quoted = row.quotes.map(q => q.text).join('\n');
      const duration = jobMonths(row.quotes.map(q => q.text));
      if (duration) {
        const min = Number(range[1]) * 12, max = Number(range[2]) * 12;
        const outside = duration.months - duration.uncertainty > max || duration.months + duration.uncertainty < min;
        const inside = duration.months - duration.uncertainty >= min && duration.months + duration.uncertainty <= max;
        return { ...row, status: outside ? 'needs_checking' : inside ? row.status : 'partial',
          explanation: `The quoted job dates indicate approximately ${duration.months} months, counting overlapping periods once. ${outside ? `That is outside the stated ${range[1]}–${range[2]}-year range; clarify the role's experience requirement and the candidate's relevant dates.` : inside ? 'These claimed dates fit the range; verify the job scope and dates in a recruiter call.' : 'Month-only dates leave uncertainty at the range boundary; verify exact dates and relevant job scope.'}` };
      }
      return { ...row, status: 'partial', explanation: /\d+(?:\.\d+)?\s*\+\s*years/i.test(quoted)
        ? 'The CV gives an open-ended experience claim. It does not establish the upper bound of the required range; verify the job dates and relevant duration.'
        : 'The CV states an experience duration, but this summary is not an exact calculation from job dates. Verify the relevant duration and required range.' };
    }
    return row;
  });
}

export type JDSource = { id: string; text: string; section: string; mustHave: boolean };
export type DraftRequirement = Requirement & { sourceQuote: string | null; reviewNote?: string };
type ExtractedRequirement = { text: string; mustHave: boolean; sourceQuote: string };

// Coverage is anchored to original bullets, including their wrapped continuation lines.
export function extractJDSources(jd: string): JDSource[] {
  const sources: JDSource[] = [];
  let section = '';
  let active: { start: number; end: number } | null = null;
  const flush = () => {
    if (active) sources.push({ id: `s${sources.length + 1}`, text: jd.slice(active.start, active.end).trimEnd(), section, mustHave: /mandatory|required|essential|minimum/i.test(section) });
    active = null;
  };
  for (const match of jd.matchAll(/^.*$/gm)) {
    const line = match[0];
    const heading = line.trim().replace(/:$/, '');
    if (/^Years? of (?:relevant )?Experience\b/i.test(heading)) {
      flush();
      sources.push({ id: `s${sources.length + 1}`, text: line.trim(), section: 'Experience', mustHave: false });
      continue;
    }
    if (/^(?:(?:key|main|job)\s+)?(?:responsibilities|duties|mandatory skills|required skills|essential skills|preferred skills|qualifications|requirements|minimum qualifications|preferred qualifications)$/i.test(heading)) {
      flush(); section = heading; continue;
    }
    if (!section) continue;
    const bullet = line.match(/^\s*(?:[•●▪*\-]|l(?=\s{2,})|\d+[.)])\s+/);
    if (bullet) {
      flush(); active = { start: match.index! + bullet[0].length, end: match.index! + line.length };
    } else if (active && line.trim()) {
      active.end = match.index! + line.length;
    } else if (!line.trim()) flush();
  }
  flush();
  return sources;
}

function splitTools(text: string): string[] {
  const list = text.match(/^(Experience with|Strong knowledge of|Familiarity with)\s+(.+?)[.]?$/i);
  if (!list || (!list[2].includes(',') && !/\s+and\s+/i.test(list[2]))) return [text];
  return list[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(tool => `${list[1]} ${tool.trim()}.`);
}

export function completeRequirements(jd: string, sources: JDSource[], extracted: ExtractedRequirement[]): DraftRequirement[] {
  const rows: Omit<DraftRequirement, 'id'>[] = [];
  for (const draft of extracted) {
    if (!draft.sourceQuote.trim() || !jd.includes(draft.sourceQuote)) continue;
    for (const text of splitTools(draft.text)) rows.push({ ...draft, text });
  }
  for (const source of sources) {
    // A mention of a tool is insufficient to cover a detailed task bullet.
    const covered = rows.some(row => row.sourceQuote !== null && row.sourceQuote.trim() === source.text.trim());
    if (!covered) for (const text of splitTools(source.text.replace(/\s+/g, ' '))) rows.push({
      text, mustHave: source.mustHave, sourceQuote: source.text,
      reviewNote: 'Restored from a JD line the extraction did not cover fully. Check its wording and priority.',
    });
  }
  const unique = rows.filter((row, index) => rows.findIndex(other => other.text.toLowerCase() === row.text.toLowerCase()) === index);
  if (unique.length > 40) throw new Error('The JD contains more than 40 distinct requirements. Review a shorter JD; no requirements have been silently removed.');
  return unique.map((row, i) => ({ ...row, id: `r${i + 1}` }));
}

export function experienceWarnings(texts: string[]): string[] {
  const ranges = new Set(texts.flatMap(text => [...text.matchAll(/(\d+)\s*[-–]\s*(\d+)\s*years/gi)].map(match => `${match[1]}–${match[2]} years`)));
  return ranges.size > 1 ? [`The JD contains different experience ranges (${[...ranges].join(' and ')}). Clarify which applies before using this report.`] : [];
}

// Default demo cap remains 30. A bounded development test override is temporary.
export function demoRequestLimit(override: string | undefined): number {
  const value = Number(override);
  return Number.isInteger(value) && value >= 30 ? Math.min(value, 60) : 30;
}
