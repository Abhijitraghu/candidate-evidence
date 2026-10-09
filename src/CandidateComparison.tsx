import {snapshotContent} from './lib/snapshot';
import {verdict, verdictRank} from './lib/verdict';
import type {CandidateResult, EvidenceRule} from '../shared/recommendation';
import type {DraftRequirement} from '../shared/assessment';
type Candidate = {name:string; result:CandidateResult|null; cvText?:string};
export function CandidateComparison({candidates,requirements,rules}:{candidates:Candidate[]; requirements:DraftRequirement[]; rules:Record<string,EvidenceRule>}) {
 const content = candidates.map(c => snapshotContent(c.result!,requirements,rules,c.cvText ?? ''));
 const statusScore = (status:string) => status === 'found' ? 2 : status === 'partial' ? 1 : 0;
 const rows = [
  {label:'Verdict',values:candidates.map(c=>verdict(c.result!,requirements)),scores:candidates.map(c=>verdictRank(c.result))},
  {label:'Coverage %',values:candidates.map(c=>`${c.result!.coverage}%`),scores:candidates.map(c=>c.result!.coverage)},
  ...requirements.filter(r=>r.mustHave).map(r=>({label:r.text,values:candidates.map(c=>{const e=c.result!.evidence.find(e=>e.requirementId===r.id);return `${e?.status === 'needs_checking' ? 'Check on call (unscored)' : e?.status === 'found' ? 'Shown' : e?.status === 'partial' ? 'Partial' : 'Missing'}${e?.status === 'conflicting' ? ' (conflicting evidence)' : ''}\n${e?.quotes.length ? e.quotes.slice(0,1).map(q=>`“${q.text}”`).join('\n') : 'No CV quote available.'}`;}),scores:candidates.map(c=>statusScore(c.result!.evidence.find(e=>e.requirementId===r.id)?.status ?? ''))})),
  {label:'Top strength',values:content.map(s=>s.strengths[0] ? `${s.strengths[0].text}\n“${s.strengths[0].quote}”` : 'No specific work-history quote available.'),scores:content.map(s=>s.strengths.length ? 1 : 0)},
  {label:'Top gap',values:content.map(s=>s.gaps[0] ? `${s.gaps[0].text}\n${s.gaps[0].evidence.status === 'partial' ? 'Partial' : 'Missing'}${s.gaps[0].evidence.quotes.length ? '\n'+s.gaps[0].evidence.quotes.slice(0,1).map(q=>`“${q.text}”`).join('\n') : '\nNo CV quote available.'}` : 'No gaps in CV-checkable requirements.'),scores:content.map(s=>s.gaps[0] ? statusScore(s.gaps[0].evidence.status) : 2)},
 ];
 return <section aria-label="Candidate comparison"><h2>Candidate comparison</h2><p>Green highlights the best supported value in each row, including ties. Strengths highlight available work-history evidence; gaps highlight the least severe gap. Call-only requirements are unscored.</p><div className="table-scroll"><table className="comparison-table"><thead><tr><th>Criterion</th>{candidates.map(c=><th key={c.name}>{c.name.replace(/\.(docx|pdf)$/i,'').trim()}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.label}><th scope="row">{r.label}</th>{r.values.map((value,i)=><td key={candidates[i].name} className={r.scores[i] > 0 && r.scores[i] === Math.max(...r.scores) ? 'best-value' : ''}>{value}</td>)}</tr>)}</tbody></table></div></section>;
}
