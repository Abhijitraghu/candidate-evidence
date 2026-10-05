import type { CandidateResult, EvidenceRule } from '../../shared/recommendation.ts';
import type { DraftRequirement } from '../../shared/assessment.ts';

// Presentation only: the assessment and its verdict are never recalculated here.
export function snapshotContent(result: CandidateResult, requirements: DraftRequirement[], rules: Record<string, EvidenceRule>, cvText: string) {
  const rows = requirements.map(r => ({...r, evidence: result.evidence.find(e => e.requirementId === r.id)!, callOnly: !!rules[r.id]?.interviewOnly || result.evidence.find(e => e.requirementId === r.id)?.status === 'needs_checking'}));
  const must = rows.filter(r => r.mustHave && !r.callOnly);
  const other = rows.filter(r => !must.includes(r));
  const isSkill = (text: string) => !/\byears?\b|\bmonths?\b|\bdegree\b|\bbachelor\b|\bqualification\b|\brole\b/i.test(text);
  const strongest = must.find(r => r.evidence.status === 'found' && isSkill(r.text));
  // Only explicit work-history/responsibility sections qualify. Ambiguous sections
  // are omitted, including skills and profile summaries even when they match.
  const ranges: {start:number; end:number}[] = [];
  let start: number | undefined;
  for (const line of cvText.matchAll(/[^\r\n]+/g)) {
    const text = line[0].trim().replace(/[:\s]+$/, '');
    const work = /^(?:(?:professional|work|employment|career)\s+(?:experience|history)|experience|(?:roles?\s*(?:&|and)\s*)?responsibilities|key responsibilities)$/i.test(text);
    const stop = /^(?:(?:professional|profile|career)\s+summary|summary|(?:technical\s+)?skills|core competencies|education\w*(?:\s+qualifications)?|qualifications|certifications|projects|achievements|key achievements|key highlights|accolades|scholastics|personal dossier|declaration)$/i.test(text);
    if (stop && start !== undefined) { ranges.push({start,end:line.index!}); start = undefined; }
    if (work && start === undefined) start = line.index! + line[0].length;
  }
  if (start !== undefined) ranges.push({start,end:cvText.length});
  const used = new Set<string>();
  const strengths: {id:string; text:string; quote:string}[] = [];
  const supported = rows.filter(r => r.evidence.status === 'found' && !r.callOnly && isSkill(r.text)).sort((a,b) => Number(b.mustHave)-Number(a.mustHave));
  for (const row of supported) {
    const quote = row.evidence.quotes.find(q => {
      const words = q.text.trim().split(/\s+/).length;
      return words >= 4 && words < 25 && !used.has(q.text.trim()) && cvText.slice(q.start,q.end) === q.text &&
        ranges.some(range => q.start >= range.start && q.end <= range.end) &&
        /\b(?:built|managed?|administered|supported?|resolved?|troubleshot|troubleshooting|configured?|handled?|delivered?|provided?|maintained?|monitored?|assisted?|created?|performed?|escalat\w*|diagnos\w*|installed?|logg\w*|used|worked|coordinated?|developed?|investigat\w*)\b/i.test(q.text);
    });
    if (quote) { used.add(quote.text.trim()); strengths.push({id:row.id,text:row.text,quote:quote.text}); }
    if (strengths.length === 3) break;
  }
  const allGaps = rows.filter(r => !r.callOnly && r.evidence.status !== 'found').sort((a,b) => Number(b.mustHave)-Number(a.mustHave));
  const gaps = allGaps.slice(0,3);
  const checks = [...rows.filter(r => r.callOnly), ...allGaps].slice(0,3);
  return {must,other,strongest,strengths,gaps,checks,otherShown:other.filter(r => r.evidence.status === 'found').length};
}
