import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";
import { readDocument, type ReadDocument } from "./lib/documents";
import type { VerifiedEvidence, EvidenceStatus } from "../shared/evidence";
import { displayExplanation, experienceWarnings, type DraftRequirement } from "../shared/assessment";

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
function DocumentText({ document, highlight }: { document: ReadDocument; highlight?: { start: number; end: number } | null }) {
  const highlightRef = useRef<HTMLElement>(null);
  useEffect(() => { if (highlight) highlightRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [highlight]);
  return <details className="document-text" open={highlight ? true : undefined}>
    <summary>Read extracted text from {document.name}</summary>
    <pre tabIndex={0}>{highlight ? <>{document.text.slice(0, highlight.start)}<mark ref={highlightRef}>{document.text.slice(highlight.start, highlight.end)}</mark>{document.text.slice(highlight.end)}</> : document.text}</pre>
  </details>;
}

export default function App() {
  const extract = useAction(api.assessment.extractRequirements);
  const assess = useAction(api.assessment.assessCandidate);
  const setup = useAction(api.assessment.setup);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [jd, setJD] = useState<ReadDocument | null>(null);
  const [cv, setCV] = useState<ReadDocument | null>(null);
  const [requirements, setRequirements] = useState<DraftRequirement[]>([]);
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
    setReport(null); setHighlight(null);
    if (area === 'jd') { setJD(null); setRequirements([]); setConfirmed(false); setRangesReviewed(false); setCV(null); }
    else setCV(null);
    try {
      const document = await readDocument(file);
      if (area === 'jd') setJD(document); else setCV(document);
    } catch (err) { setError({ area, text: message(err) }); }
    finally { setBusy(null); }
  }
  async function extractRequirements() {
    if (!jd || busy) return;
    setBusy('Finding requirements in the JD…'); setError(null); setReport(null);
    try {
      const draft = await extract({ jdText: jd.text });
      setRequirements(draft); setConfirmed(false); setRangesReviewed(false); setConfigured(true);
      requirementsRef.current?.focus();
    } catch (err) { setError({ area: 'jd', text: message(err) }); }
    finally { setBusy(null); }
  }
  function editRequirement(id: string, change: Partial<DraftRequirement>) {
    setRequirements(rows => rows.map(row => row.id === id ? { ...row, ...change } : row));
    setReport(null); setRangesReviewed(false);
  }
  async function assessCandidate() {
    if (!cv || !confirmed || busy) return;
    setBusy('Reviewing the CV against your confirmed requirements…'); setError(null); setReport(null); setHighlight(null);
    try {
      const result = await assess({ cvText: cv.text, confirmed: true, requirements: requirements.map(({ id, text, mustHave }) => ({ id, text: text.trim(), mustHave })) });
      setReport(result.evidence); setConfigured(true);
      requestAnimationFrame(() => evidenceRef.current?.focus());
    } catch (err) { setError({ area: 'cv', text: message(err) }); }
    finally { setBusy(null); }
  }
  const step = confirmed ? 3 : jd ? 2 : 1;
  const rangeWarnings = jd ? experienceWarnings([jd.text]) : [];
  const failedRows = report?.filter(row => row.verificationIssue).length ?? 0;
  const valid = requirements.length > 0 && requirements.length <= 40 && requirements.every(row => row.text.trim().length > 0 && row.text.length <= 1000);
  const errorFor = (area: string) => error?.area === area ? <div className="error" role="alert">{error.text}</div> : null;

  return <>
    <header className="topbar"><div className="brand">Candidate evidence</div><span>Milestone 1 · One role, one CV</span></header>
    <main>
      <div className="intro"><h1>Read the evidence.<br />Choose whom to call.</h1><p>Start with the role, confirm what matters, then inspect the candidate’s own words.</p></div>
      <ol className="steps" aria-label="Review progress">
        {['Add a job description', 'Confirm requirements', 'Review one candidate'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step >= index + 1 ? 'active' : ''}><span>{index + 1}</span>{label}</li>)}
      </ol>
      {configured === false && <aside className="setup-note"><strong>AI is not connected yet.</strong> Add <code>OPENAI_API_KEY</code> in this development deployment’s Convex environment settings. You can still read your files and draft requirements here.<button className="text-button" disabled={!!busy} onClick={async () => { try { setConfigured((await setup({})).configured); } catch { setError({ area: 'jd', text: 'Could not reach Convex. Check your connection, then retry.' }); } }}>Check connection again</button></aside>}
      <div className="workspace">
        <div className="role-column">
          <section aria-labelledby="jd-heading" className="panel">
            <div className="section-heading"><h2 id="jd-heading">The job description</h2>{jd && <span className="state-label">Readable</span>}</div>
            <p>Upload the JD you’re hiring against. You’ll check its requirements before the CV is assessed.</p>
            <FilePicker label={jd ? 'Replace job description' : 'Choose job description'} disabled={!!busy} onFile={file => void upload(file, 'jd')} />
            {errorFor('jd')}
            {jd && <><div className="file-summary"><strong>{jd.name}</strong><span>{jd.pages ? `${jd.pages} pages · ` : ''}{jd.text.length.toLocaleString()} characters read</span></div><DocumentText document={jd} />
              {!confirmed && <button className="primary" disabled={!!busy} onClick={() => void extractRequirements()}>{requirements.length ? 'Extract requirements again' : 'Extract requirements'}</button>}
            </>}
          </section>
          {jd && <section ref={requirementsRef} tabIndex={-1} aria-labelledby="requirements-heading" className="panel requirements-panel">
            <div className="section-heading"><h2 id="requirements-heading">{confirmed ? 'Confirmed requirements' : 'Check the requirements'}</h2>{confirmed && <span className="state-label">Confirmed</span>}</div>
            <p>{confirmed ? 'This candidate will be assessed against these requirements only.' : 'Correct anything the AI missed. Add specific requirements, remove irrelevant ones, and mark the must-haves.'}</p>
            {rangeWarnings.map(warning => <p className="evidence-note" key={warning}>{warning}</p>)}
            {!confirmed && rangeWarnings.length > 0 && <label className="checkbox"><input type="checkbox" checked={rangesReviewed} disabled={!!busy} onChange={event => setRangesReviewed(event.target.checked)} />I have reviewed the conflicting experience ranges.</label>}
            {requirements.length === 0 && <p className="empty-hint">Extract from the JD above, or add requirements yourself.</p>}
            <div className="requirement-list">{requirements.map((row, index) => <div className="requirement" key={row.id}>
              <label className="requirement-label" htmlFor={`requirement-${row.id}`}>Requirement {index + 1}</label>
              {confirmed ? <p className="confirmed-text">{row.text}</p> : <textarea id={`requirement-${row.id}`} value={row.text} maxLength={1000} disabled={!!busy} rows={2} onChange={event => editRequirement(row.id, { text: event.target.value, sourceQuote: null })} />}
              <div className="requirement-controls">{confirmed ? <span>{row.mustHave ? 'Must-have' : 'Additional requirement'}</span> : <label className="checkbox"><input type="checkbox" checked={row.mustHave} disabled={!!busy} onChange={event => editRequirement(row.id, { mustHave: event.target.checked })} />Must-have</label>}
                {!confirmed && <button className="text-button" disabled={!!busy} aria-label={`Remove requirement ${index + 1}`} onClick={() => setRequirements(rows => rows.filter(item => item.id !== row.id))}>Remove</button>}
              </div>
              {row.sourceQuote ? <details className="source-quote"><summary>Supporting JD quote</summary><blockquote>{row.sourceQuote}</blockquote></details> : <small>Added or edited by you, or no exact JD quote verified. Check against the role.</small>}
              {row.reviewNote && <small>{row.reviewNote}</small>}
            </div>)}</div>
            {!confirmed && <button className="secondary" disabled={!!busy || requirements.length >= 40} onClick={() => setRequirements(rows => [...rows, { id: crypto.randomUUID(), text: '', mustHave: false, sourceQuote: null }])}>Add a requirement</button>}
            <div className="confirmation">
              {confirmed ? <button className="secondary" disabled={!!busy} onClick={() => { setConfirmed(false); setReport(null); setHighlight(null); }}>Edit requirements</button> : <><p>By confirming, you’ve checked that these requirements describe the role.</p><button className="primary" disabled={!!busy || !valid || (rangeWarnings.length > 0 && !rangesReviewed)} onClick={() => { setConfirmed(true); setReport(null); setError(null); requestAnimationFrame(() => cvRef.current?.focus()); }}>Confirm requirements</button></>}
            </div>
          </section>}
        </div>
        <div className="candidate-column">
          <section ref={cvRef} tabIndex={-1} aria-labelledby="cv-heading" className={`panel candidate-panel ${!confirmed ? 'waiting' : ''}`}>
            <div className="section-heading"><h2 id="cv-heading">The candidate</h2>{cv && <span className="state-label">Readable</span>}</div>
            {!confirmed ? <div className="empty-state"><h3>Confirm the role first</h3><p>Once the requirements are confirmed, add one CV and see the evidence for each requirement.</p></div> : <>
              <p>Upload one CV. Evidence means a documented claim, not a verified skill or a hiring recommendation.</p>
              <FilePicker label={cv ? 'Replace candidate CV' : 'Choose candidate CV'} disabled={!!busy} onFile={file => void upload(file, 'cv')} />
              {errorFor('cv')}
              {cv && <><div className="file-summary"><strong>{cv.name}</strong><span>{cv.text.length.toLocaleString()} characters read</span></div><DocumentText document={cv} highlight={highlight} /><button className="primary" disabled={!!busy} onClick={() => void assessCandidate()}>{report ? 'Assess this CV again' : 'Assess this CV'}</button></>}
            </>}
          </section>
          {report && cv && <section ref={evidenceRef} tabIndex={-1} aria-labelledby="evidence-heading" className="panel evidence-panel">
            <h2 id="evidence-heading">Evidence for this candidate</h2><p className="evidence-note">Every displayed quote matches the extracted CV text exactly. The interpretation still needs your review. Communication and culture fit need a recruiter call.</p>
            <p className="report-summary">{failedRows === report.length ? 'No verified assessment is available. Retry the assessment; you can still read the CV.' : `${report.filter(row => row.status === 'found').length} of ${requirements.length} requirements have supporting evidence. This is not a match score.`}</p>
            {failedRows > 0 && <p className="evidence-note" role="status">The assessment is incomplete: {failedRows} requirements could not be verified. Each affected row explains why. This does not establish that the candidate lacks those skills.</p>}
            {report.map(row => { const requirement = requirements.find(r => r.id === row.requirementId)!; return <article className="evidence-row" key={row.requirementId}>
              <div className="evidence-title"><h3>{requirement.text}</h3>{requirement.mustHave && <span className="must-have">Must-have</span>}</div>
              <span className={`evidence-status status-${row.status}`}>{statusLabels[row.status]}</span>
              {row.quotes.map((quote, index) => <div className="cv-quote" key={index}><blockquote>{quote.text}</blockquote><button className="text-button" onClick={() => { setHighlight({ start: quote.start, end: quote.end }); cvRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); }}>See this quote in the CV</button></div>)}
              <p>{displayExplanation(row.explanation)}</p><div className="call-question"><strong>Ask in a recruiter call</strong><p>{displayExplanation(row.question)}</p></div>
            </article>; })}
          </section>}
        </div>
      </div>
      <div className="activity" role="status" aria-live="polite">{busy && <><span className="busy-dot" />{busy} Please keep this page open.</>}</div>
      <footer><p>Files stay in this browser session. Extracting requirements or assessing a CV sends its text through Convex to OpenAI. Refreshing clears this work.</p><p>Milestone 1 does not rank, shortlist, export, or save candidates.</p></footer>
    </main>
  </>;
}
