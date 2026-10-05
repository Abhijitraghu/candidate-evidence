import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";
import { readDocument, type ReadDocument } from "./lib/documents";
import type { VerifiedEvidence, EvidenceStatus } from "../shared/evidence";
import { displayExplanation, experienceWarnings, type DraftRequirement } from "../shared/assessment";

import { draftRule, approvedRequirements, ruleText, parseGroups, labels, type EvidenceRule, type CandidateResult, type Recommendation } from '../shared/recommendation';

const statusLabels: Record<EvidenceStatus, string> = {
  found: 'Evidence found', partial: 'Partial evidence', conflicting: 'Conflicting evidence',
  not_found: 'Not found in CV', needs_checking: 'Needs checking',
};
function message(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data;
  if (error instanceof Error && !error.message.includes('[CONVEX')) return error.message;
  return 'The request could not finish. Check your connection and try again; your files are still here.';
}
function FilePicker({ label, disabled, onFile }: { label: string; disabled: boolean; onFile: (file: File) => void }) {
  return <div className="file-picker">
    <label>{label}<input type="file" accept=".pdf,.docx" disabled={disabled} onChange={event => {
      const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = '';
    }} /></label>
    <p>PDF or Word (.docx), up to 10 MB. One file at a time.</p>
  </div>;
}
function DocumentText({ document, highlight, expanded }: { document: ReadDocument; highlight?: { start: number; end: number } | null; expanded?: boolean }) {
  const highlightRef = useRef<HTMLElement>(null);
  useEffect(() => { if (highlight) highlightRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [highlight]);
  return <details className="document-text" open={expanded || highlight ? true : undefined}>
    <summary>Read extracted text from {document.name}</summary>
    <pre tabIndex={0}>{highlight ? <>{document.text.slice(0, highlight.start)}<mark ref={highlightRef}>{document.text.slice(highlight.start, highlight.end)}</mark>{document.text.slice(highlight.end)}</> : document.text}</pre>
  </details>;
}

function RecommendationBullets({result, requirements}: {result: CandidateResult; requirements: DraftRequirement[]}) {
  const text = (row: VerifiedEvidence) => requirements.find(r => r.id === row.requirementId)?.text ?? row.requirementId;
  const strengths = result.evidence.filter(row => row.status === 'found');
  const weaknesses = result.evidence.filter(row => ['not_found', 'partial', 'conflicting'].includes(row.status));
  const checks = result.evidence.filter(row => row.status !== 'found');
  return <div className="recommendation-bullets">
    <h4>Recommendation</h4><ul><li><strong>{result.recommendation}</strong> — {result.reason} Coverage: {result.coverage}%.</li></ul>
    <h4>Strengths</h4><ul>{strengths.length ? strengths.map(row => <li key={row.requirementId}><strong>{text(row)}</strong>{row.quotes.map((quote,i) => <blockquote key={i}>{quote.text}</blockquote>)}</li>) : <li>No fully supported JD requirements.</li>}</ul>
    <h4>Weaknesses</h4><ul>{weaknesses.length ? weaknesses.map(row => <li key={row.requirementId}><strong>{text(row)}</strong> — {row.status === 'not_found' ? 'No CV evidence for this JD requirement.' : row.status === 'partial' ? 'The full JD requirement is not supported; only partial CV evidence was found.' : 'The CV contains a conflicting claim.'}{row.status !== 'not_found' && row.quotes.map((quote,i) => <blockquote key={i}>{quote.text}</blockquote>)}</li>) : <li>No gaps in CV-checkable requirements.</li>}</ul>
    <h4>Check on call</h4><ul>{checks.length ? checks.map(row => <li key={row.requirementId}>{row.question}</li>) : <li>Verify the scope and depth of the quoted experience.</li>}</ul>
  </div>;
}

export default function App() {
  const extract = useAction(api.assessment.extractRequirements);
  const assess = useAction(api.assessment.recommendCandidate);
  const setup = useAction(api.assessment.setup);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [jdInput, setJDInput] = useState('');
  const [jd, setJD] = useState<ReadDocument | null>(null);
  const [cv, setCV] = useState<ReadDocument | null>(null);
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
  const [rules, setRules] = useState<Record<string, EvidenceRule>>({});
  const [assessmentMonth, setAssessmentMonth] = useState(new Date().toISOString().slice(0,7));
  const [candidates, setCandidates] = useState<{name: string; result: CandidateResult | null; choice: Recommendation | ''; note: string; error?: string}[]>([]);
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [rangesReviewed, setRangesReviewed] = useState(false);
  const [report, setReport] = useState<VerifiedEvidence[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ area: string; text: string } | null>(null);
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const evidenceRef = useRef<HTMLElement>(null);
  const requirementsRef = useRef<HTMLElement>(null);
  const cvRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setup({}).then(result => { if (active) setConfigured(result.configured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, [setup]);

  async function upload(file: File, area: 'jd' | 'cv') {
    setBusy(area === 'jd' ? 'Reading the job description…' : 'Reading the CV…'); setError(null);
    // Clear the previous result immediately, so a failed replacement can never show stale evidence.
    setReport(null); setResult(null); setHighlight(null);
    if (area === 'jd') { setJDInput(''); setCandidates([]); setRules({}); setJD(null); setRequirements([]); setConfirmed(false); setRangesReviewed(false); setCV(null); }
    else setCV(null);
    try {
      const document = await readDocument(file);
      if (area === 'jd') setJD(document); else setCV(document);
    } catch (err) { setError({ area, text: message(err) }); if (area === 'cv') setCandidates(rows => [...rows, {name:file.name,result:null,choice:'',note:'',error:message(err)}]); }
    finally { setBusy(null); }
  }
  function usePastedJD() {
    setError(null);
    if (jdInput.trim().length < 30 || jdInput.length > 80000) {
      setError({area: 'jd', text: 'Paste between 30 and 80,000 characters of job description text.'});
      return;
    }
    setJD({name: 'Pasted job description', text: jdInput, pages: null});
    setRequirements([]); setRules({}); setConfirmed(false); setRangesReviewed(false);
    setCV(null); setCandidates([]); setReport(null); setResult(null); setHighlight(null);
  }
  async function extractRequirements() {
    if (!jd || busy) return;
    setBusy('Finding requirements in the JD…'); setError(null); setReport(null);
    try {
      const draft = approvedRequirements(await extract({ jdText: jd.text }));
      setRequirements(draft); setRules(Object.fromEntries(draft.map(row => [row.id, draftRule(row)]))); setConfirmed(false); setRangesReviewed(false); setConfigured(true);
      requirementsRef.current?.focus();
    } catch (err) { setError({ area: 'jd', text: message(err) }); }
    finally { setBusy(null); }
  }
  function editRequirement(id: string, change: Partial<DraftRequirement>) {
    setRequirements(rows => rows.map(row => row.id === id ? { ...row, ...change } : row));
    setReport(null); setResult(null); setCandidates([]); setRangesReviewed(false); if (change.text !== undefined) setRules(rows => ({...rows, [id]: draftRule({...requirements.find(r => r.id === id)!, ...change})}));
  }
  async function assessCandidate() {
    if (!cv || !confirmed || busy) return;
    setBusy('Reviewing the CV against your confirmed requirements…'); setError(null); setReport(null); setResult(null); setHighlight(null);
    try {
      const result = await assess({ cvText: cv.text, confirmed: true, requirements: requirements.map(row => ({...(rules[row.id] ?? draftRule(row)), ...row, text:row.text.trim(), assessmentMonth})).map(({id,text,mustHave,groups,interviewOnly,assessmentMonth}) => ({id,text,mustHave,groups,interviewOnly,assessmentMonth})) });
      const complete = !result.evidence.some(row => row.verificationIssue);
      setResult(complete ? result : null); setCandidates(rows => [...rows.filter(row => row.name !== cv.name), {name:cv.name,result:complete ? result : null,choice:'',note:'', ...(!complete ? {error:'Incomplete evidence; retry before recommending.'} : {})}]);
      setReport(result.evidence); setConfigured(true);
      requestAnimationFrame(() => evidenceRef.current?.focus());
    } catch (err) { setError({ area: 'cv', text: message(err) }); }
    finally { setBusy(null); }
  }
  const step = confirmed ? 3 : jd ? 2 : 1;
  const rangeWarnings = experienceWarnings(requirements.map(row => row.text));
  const failedRows = report?.filter(row => row.verificationIssue).length ?? 0;
  const valid = requirements.length > 0 && requirements.length <= 40 && requirements.every(row => row.text.trim().length > 0 && row.text.length <= 1000 && ((rules[row.id] ?? draftRule(row)).interviewOnly || (rules[row.id] ?? draftRule(row)).groups.length > 0)) && /^\d{4}-\d{2}$/.test(assessmentMonth);
  const errorFor = (area: string) => error?.area === area ? <div className="error" role="alert">{error.text}</div> : null;

  return <>
    <header className="topbar"><div className="brand">Candidate evidence</div><span>Milestone 2 · One role, candidate recommendations</span></header>
    <main>
      <div className="intro"><h1>Read the evidence.<br />Choose whom to call.</h1><p>Start with the role, confirm what matters, then inspect the candidate’s own words.</p></div>
      <ol className="steps" aria-label="Review progress">
        {['Add a job description', 'Confirm requirements', 'Review one candidate'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step >= index + 1 ? 'active' : ''}><span>{index + 1}</span>{label}</li>)}
      </ol>
      {configured === false && <aside className="setup-note"><strong>AI is not connected yet.</strong> Add <code>OPENAI_API_KEY</code> in this development deployment’s Convex environment settings. You can still read your files and draft requirements here.<button className="text-button" disabled={!!busy} onClick={async () => { try { setConfigured((await setup({})).configured); } catch { setError({ area: 'jd', text: 'Could not reach Convex. Check your connection, then retry.' }); } }}>Check connection again</button></aside>}
      <div className={`workspace ${jd ? 'has-jd' : ''}`}>
        <div className="role-column">
          <section aria-labelledby="jd-heading" className="panel">
            <div className="section-heading"><h2 id="jd-heading">The job description</h2>{jd && <span className="state-label">Readable</span>}</div>
            <p>Upload or paste the JD you’re hiring against. You’ll check its requirements before the CV is assessed.</p>
            <FilePicker label={jd ? 'Replace job description' : 'Choose job description'} disabled={!!busy} onFile={file => void upload(file, 'jd')} />
            <label className="paste-jd">Paste job description<textarea aria-label="Paste job description" value={jdInput} disabled={!!busy} rows={6} placeholder="Paste the full job description here" onChange={event => setJDInput(event.target.value)} /></label>
            <button className="secondary" disabled={!!busy || !jdInput.trim()} onClick={usePastedJD}>Use pasted JD</button>
            {errorFor('jd')}
            {jd && <><div className="file-summary"><strong>{jd.name}</strong><span>{jd.pages ? `${jd.pages} pages · ` : ''}{jd.text.length.toLocaleString()} characters read</span></div><DocumentText document={jd} expanded />
              {!confirmed && <button className="primary" disabled={!!busy} onClick={() => void extractRequirements()}>{requirements.length ? 'Extract requirements again' : 'Extract requirements'}</button>}
            </>}
          </section>
          {jd && <section ref={requirementsRef} tabIndex={-1} aria-labelledby="requirements-heading" className="panel requirements-panel">
            <div className="section-heading"><h2 id="requirements-heading">{confirmed ? 'Confirmed requirements' : 'Check the requirements'}</h2>{confirmed && <span className="state-label">Confirmed</span>}</div>
            <p>{confirmed ? 'This candidate will be assessed against these requirements only.' : 'Check requirements, must-haves and CV evidence phrases. Separate required phrase groups with a semicolon; use / between equivalent phrases. All groups must be present for full evidence. These rules match documented claims, not skill quality.'}</p>
            {rangeWarnings.map(warning => <p className="evidence-note" key={warning}>{warning}</p>)}
            {!confirmed && rangeWarnings.length > 0 && <label className="checkbox"><input type="checkbox" checked={rangesReviewed} disabled={!!busy} onChange={event => setRangesReviewed(event.target.checked)} />I have reviewed the conflicting experience ranges.</label>}
            {!confirmed && <label>Assessment month<input aria-label="Assessment month" type="month" value={assessmentMonth} onChange={event => setAssessmentMonth(event.target.value)} /></label>}
            {rangeWarnings.length > 0 && <p>Remove or edit a conflicting range so one range applies. Acknowledgement alone cannot resolve it.</p>}
            {requirements.length === 0 && <p className="empty-hint">Extract from the JD above, or add requirements yourself.</p>}
            <div className="requirement-list">{requirements.map((row, index) => <div className="requirement" key={row.id}>
              <label className="requirement-label" htmlFor={`requirement-${row.id}`}>Requirement {index + 1}</label>
              {confirmed ? <p className="confirmed-text">{row.text}</p> : <textarea id={`requirement-${row.id}`} value={row.text} maxLength={1000} disabled={!!busy} rows={2} onChange={event => editRequirement(row.id, { text: event.target.value, sourceQuote: null })} />}
              <div className="requirement-controls">{confirmed ? <span>{(rules[row.id] ?? draftRule(row)).interviewOnly ? 'Check on recruiter call' : row.mustHave ? 'Must-have' : 'Additional requirement'}</span> : <label className="checkbox"><input type="checkbox" checked={row.mustHave} disabled={!!busy} onChange={event => editRequirement(row.id, { mustHave: event.target.checked })} />Must-have</label>}
                {!confirmed && <button className="text-button" disabled={!!busy} aria-label={`Remove requirement ${index + 1}`} onClick={() => setRequirements(rows => rows.filter(item => item.id !== row.id))}>Remove</button>}
              </div>
              {row.sourceQuote ? <details className="source-quote"><summary>Supporting JD quote</summary><blockquote>{row.sourceQuote}</blockquote></details> : <small>Added or edited by you, or no exact JD quote verified. Check against the role.</small>}
              <label>CV evidence phrases {index + 1}{confirmed ? <p>{ruleText(rules[row.id] ?? draftRule(row))}</p> : <input aria-label={`CV evidence phrases ${index + 1}`} value={ruleText(rules[row.id] ?? draftRule(row))} onChange={event => setRules(items => ({...items, [row.id]: {...(items[row.id] ?? draftRule(row)), groups:parseGroups(event.target.value)}}))} />}</label>
              {!confirmed && <label className="checkbox"><input type="checkbox" checked={(rules[row.id] ?? draftRule(row)).interviewOnly} onChange={event => setRules(items => ({...items, [row.id]: {...(items[row.id] ?? draftRule(row)), interviewOnly:event.target.checked}}))} />Check in a call; exclude from CV coverage</label>}
              {row.reviewNote && <small>{row.reviewNote}</small>}
            </div>)}</div>
            {!confirmed && <button className="secondary" disabled={!!busy || requirements.length >= 40} onClick={() => setRequirements(rows => [...rows, { id: crypto.randomUUID(), text: '', mustHave: false, sourceQuote: null }])}>Add a requirement</button>}
            <div className="confirmation">
              {confirmed ? <button className="secondary" disabled={!!busy} onClick={() => { setConfirmed(false); setReport(null); setResult(null); setHighlight(null); }}>Edit requirements</button> : <><p>By confirming, you’ve checked that these requirements describe the role.</p><button className="primary" disabled={!!busy || !valid || (rangeWarnings.length > 0)} onClick={() => { setConfirmed(true); setReport(null); setError(null); requestAnimationFrame(() => cvRef.current?.focus()); }}>Confirm requirements</button></>}
            </div>
          </section>}
        </div>
        <div className="candidate-column">
          <section ref={cvRef} tabIndex={-1} aria-labelledby="cv-heading" className={`panel candidate-panel ${!confirmed ? 'waiting' : ''}`}>
            <div className="section-heading"><h2 id="cv-heading">The candidate</h2>{cv && <span className="state-label">Readable</span>}</div>
            {!confirmed ? <div className="empty-state"><h3>Confirm the role first</h3><p>Once the requirements are confirmed, add one CV and see the evidence for each requirement.</p></div> : <>
              <p>Add CVs one at a time. Each assessed candidate stays in the list below. Recommendations support your review; you make the decision.</p>
              <FilePicker label={cv ? 'Replace candidate CV' : 'Choose candidate CV'} disabled={!!busy} onFile={file => void upload(file, 'cv')} />
              {errorFor('cv')}
              {cv && <><div className="file-summary"><strong>{cv.name}</strong><span>{cv.text.length.toLocaleString()} characters read</span></div><DocumentText document={cv} highlight={highlight} /><button className="primary" disabled={!!busy} onClick={() => void assessCandidate()}>{report ? 'Assess this CV again' : 'Assess this CV'}</button></>}
            </>}
          </section>
          {candidates.length > 0 && <section className="panel" aria-label="Candidate recommendations"><h2>Candidate recommendations</h2><p>{labels.map(label => `${label}: ${candidates.filter(c => (c.choice || c.result?.recommendation) === label).length}`).join(' · ')}</p><p>Choices and notes stay in this session. Changing the role clears them for a fresh review.</p>{candidates.map((candidate,index) => <article key={`${candidate.name}-${index}`} className="evidence-row"><h3>{candidate.name}</h3>{candidate.result ? <><RecommendationBullets result={candidate.result} requirements={requirements} /><label>Recruiter recommendation<select aria-label={`Recruiter recommendation for ${candidate.name}`} value={candidate.choice || candidate.result.recommendation} onChange={event => setCandidates(rows => rows.map((c,i) => i === index ? {...c,choice:event.target.value as Recommendation} : c))}>{labels.map(label => <option key={label}>{label}</option>)}</select></label><label>Recruiter note<textarea aria-label={`Recruiter note for ${candidate.name}`} value={candidate.note} onChange={event => setCandidates(rows => rows.map((c,i) => i === index ? {...c,note:event.target.value} : c))} /></label><details><summary>Reasons and exact CV quotes</summary>{candidate.result.evidence.map(row => <div key={row.requirementId}><h4>{requirements.find(r => r.id === row.requirementId)?.text}</h4><p>{statusLabels[row.status]}</p>{row.quotes.map((q,i) => <blockquote key={i}>{q.text}</blockquote>)}<p>{row.explanation}</p></div>)}</details></> : <p>Unable to assess: {candidate.error}</p>}</article>)}</section>}
          {report && cv && <section ref={evidenceRef} tabIndex={-1} aria-labelledby="evidence-heading" className="panel evidence-panel">
            <h2 id="evidence-heading">Evidence for this candidate</h2>{result && <p><strong>{result.recommendation}</strong> · {result.reason}</p>}<p className="evidence-note">Every displayed quote matches the extracted CV text exactly. The interpretation still needs your review. Communication and culture fit need a recruiter call.</p>
            <p className="report-summary">{failedRows === report.length ? 'No verified assessment is available. Retry the assessment; you can still read the CV.' : `${report.filter(row => row.status === 'found').length} of ${requirements.length} requirements have supporting evidence. This is not a match score.`}</p>
            {failedRows > 0 && <p className="evidence-note" role="status">The assessment is incomplete: {failedRows} requirements could not be verified. Each affected row explains why. This does not establish that the candidate lacks those skills.</p>}
            {report.map(row => { const requirement = requirements.find(r => r.id === row.requirementId)!; return <article className="evidence-row" key={row.requirementId}>
              <div className="evidence-title"><h3>{requirement.text}</h3>{requirement.mustHave && !(rules[requirement.id] ?? draftRule(requirement)).interviewOnly && <span className="must-have">Must-have</span>}</div>
              <span className={`evidence-status status-${row.status}`}>{statusLabels[row.status]}</span>
              {row.quotes.map((quote, index) => <div className="cv-quote" key={index}><blockquote>{quote.text}</blockquote><button className="text-button" onClick={() => { setHighlight({ start: quote.start, end: quote.end }); cvRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); }}>See this quote in the CV</button></div>)}
              <p>{displayExplanation(row.explanation)}</p><div className="call-question"><strong>Ask in a recruiter call</strong><p>{displayExplanation(row.question)}</p></div>
            </article>; })}
          </section>}
        </div>
      </div>
      <div className="activity" role="status" aria-live="polite">{busy && <><span className="busy-dot" />{busy} Please keep this page open.</>}</div>
      <footer><p>Files stay in this browser session. Extracting JD requirements sends JD text through Convex to OpenAI. CV recommendations use fixed rules in Convex without an AI call. Refreshing clears this work.</p><p>Recommendations and recruiter notes are available in this session. Saving and export come later.</p></footer>
    </main>
  </>;
}
