import { useRef, useState } from 'react';
import type { CandidateResult, EvidenceRule } from '../shared/recommendation';
import type { DraftRequirement } from '../shared/assessment';

export function CandidateSnapshot({name, role, date, result, requirements, rules}: {
  name: string; role: string; date: string; result: CandidateResult;
  requirements: DraftRequirement[]; rules: Record<string, EvidenceRule>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rows = requirements.map(r => ({...r, evidence: result.evidence.find(e => e.requirementId === r.id)!, callOnly: rules[r.id]?.interviewOnly || result.evidence.find(e => e.requirementId === r.id)?.status === 'needs_checking'}));
  const must = rows.filter(r => r.mustHave && !r.callOnly);
  const strengths = rows.filter(r => r.evidence.status === 'found').slice(0,3);
  const gaps = rows.filter(r => !r.callOnly && r.evidence.status !== 'found');
  const checks = [...rows.filter(r => r.callOnly), ...gaps].slice(0,3);
  async function download() {
    if (!ref.current) return;
    setBusy(true); setError('');
    let clone: HTMLDivElement | undefined;
    try {
      await document.fonts.ready;
      const [{default: html2canvas}, {jsPDF}] = await Promise.all([import('html2canvas'), import('jspdf')]);
      clone = ref.current.cloneNode(true) as HTMLDivElement;
      clone.classList.add('snapshot-export');
      clone.style.position = 'absolute'; clone.style.left = '-10000px'; clone.style.top = '0';
      document.body.appendChild(clone);
      const canvas = await html2canvas(clone, {scale:2, backgroundColor:'#101b2b'});
      const pdf = new jsPDF({orientation:'portrait', unit:'mm', format:'a3'});
      const width = Math.min(281, 404 * canvas.width / canvas.height);
      const height = width * canvas.height / canvas.width;
      pdf.setFillColor('#101b2b'); pdf.rect(0,0,297,420,'F');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (297-width)/2, 8, width, height);
      pdf.save(`${name.replace(/[^a-z0-9 -]/gi,'')}-snapshot.pdf`);
    } catch { setError('PDF could not be saved. Try Download PDF again.'); }
    finally { clone?.remove(); setBusy(false); }
  }
  return <section className="snapshot-wrapper" aria-label={`Candidate snapshot for ${name}`}>
    <div className="snapshot-toolbar"><h3>Hiring manager snapshot</h3><button onClick={() => void download()} disabled={busy}>{busy ? 'Saving PDF…' : 'Download PDF'}</button></div>
    {error && <p role="alert">{error}</p>}
    <div className="candidate-snapshot" ref={ref}>
      <header className="snapshot-header"><div><h2>{name}</h2><p>{role}</p><p>Assessment date: {date}</p></div><span className={`snapshot-badge badge-${result.recommendation === 'Maybe' ? 'amber' : result.recommendation === 'Not now' ? 'red' : 'green'}`}>{result.recommendation}</span></header>
      <div className="snapshot-overview"><div className="coverage-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="ring-track"/><circle cx="60" cy="60" r="52" className="ring-value" strokeDasharray={`${result.coverage * 3.267256} 326.7256`}/></svg><div><strong>{result.coverage}%</strong><span>JD coverage</span></div></div><div><h3>Candidate summary</h3><p>{result.reason}</p><small>CV evidence coverage, not a measure of ability. Call-only requirements are excluded.</small></div></div>
      <div className="snapshot-stats"><div className="snapshot-card"><span>Must-haves met</span><strong>{must.filter(r => r.evidence.status === 'found').length} of {must.length}</strong></div><div className="snapshot-card"><span>Coverage</span><strong>{result.coverage}%</strong></div><div className="snapshot-card"><span>Strongest requirement</span><strong className="stat-requirement">{strengths[0]?.text ?? 'None fully shown'}</strong><small>{strengths.length ? 'Fully shown; tied requirements follow JD order.' : 'No fully supported requirement.'}</small></div></div>
      <div className="snapshot-card breakdown"><h3>Requirement breakdown</h3><p className="snapshot-legend">Green: shown · Amber: partial · Red: missing or conflicting · Call check: unscored</p>{rows.map(r => <div className="snapshot-requirement" key={r.id}><div><span>{r.text}</span><strong>{r.callOnly ? 'Check on call' : r.evidence.status === 'found' ? 'Shown' : r.evidence.status === 'partial' ? 'Partial' : r.evidence.status === 'conflicting' ? 'Conflicting' : 'Missing'}</strong></div>{r.callOnly ? <div className="requirement-call">Excluded from CV coverage</div> : <div className={`requirement-bar bar-${r.evidence.status}`} aria-label={`${r.text}: ${r.evidence.status}`}><span style={{width:r.evidence.status === 'found' ? '100%' : r.evidence.status === 'partial' ? '50%' : '0%'}} /></div>}</div>)}</div>
      <div className="snapshot-details"><div className="snapshot-card"><h3>Top strengths</h3>{strengths.length ? strengths.map(r => <div className="snapshot-strength" key={r.id}><strong>{r.text}</strong>{r.evidence.quotes.slice(0,1).map((q,i) => <blockquote key={i}>{q.text}</blockquote>)}</div>) : <p>No fully supported JD requirements.</p>}</div><div className="snapshot-side"><div className="snapshot-card"><h3>Gaps</h3>{gaps.length ? <ul>{gaps.map(r => <li key={r.id}><strong>{r.text}</strong> — {r.evidence.status === 'partial' ? 'Partial CV evidence.' : r.evidence.status === 'conflicting' ? 'Conflicting CV evidence.' : 'No CV evidence.'}</li>)}</ul> : <p>No gaps in CV-checkable requirements.</p>}</div><div className="snapshot-card"><h3>Check on call</h3><ul>{checks.length ? checks.map(r => <li key={r.id}>{r.evidence.question}</li>) : <li>Verify the scope and depth of the quoted experience.</li>}</ul></div></div></div>
      <div className="snapshot-card snapshot-recommendation"><h3>Recommendation</h3><strong>{result.recommendation}</strong><p>{result.reason}</p><small>Based on documented CV claims. The hiring manager makes the decision.</small></div>
    </div>
  </section>;
}
