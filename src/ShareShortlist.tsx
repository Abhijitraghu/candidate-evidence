import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../convex/_generated/api';
import type { SharedShortlist } from '../shared/share';
import { CandidateSnapshot } from './CandidateSnapshot';
import { verdict, verdictRank } from './lib/verdict';
import { snapshotContent } from './lib/snapshot';
const cleanName = (name:string) => name.replace(/\.(docx|pdf)$/i,'').trim();
export function SendShortlist({payload}:{payload:SharedShortlist}) {
  const create = useMutation(api.shares.create);
  const [email,setEmail] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [draft,setDraft] = useState<{href:string;url:string} | null>(null);
  // Any selection or assessment change invalidates the previous email draft.
  useEffect(()=>setDraft(null),[payload,email]);
  return <form className="share-controls" onSubmit={async e=>{
    e.preventDefault(); if (busy || !payload.candidates.length) return;
    setBusy(true);setError('');
    try {
      const {token} = await create({payload:JSON.stringify(payload)});
      const url = `${location.origin}/share/${token}`;
      const body = payload.candidates.map(c=>`${cleanName(c.name)} — ${verdict(c.result,payload.requirements)} — ${c.result.coverage}%`).join('\n') + `\n\n${url}\n\nReply to me with times for interviews`;
      const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Shortlist: ${payload.role}`)}&body=${encodeURIComponent(body)}`;
      setDraft({href,url}); window.location.href = href;
    } catch {setError('Could not create the share link. Check your connection and try again.');}
    finally {setBusy(false);}
  }}>
    <p>Tick candidates in the Share column. Recommended candidates are ticked by default. The link includes exactly those selected and expires after 14 days. Anyone with the link can view it.</p>
    <label>Hiring manager’s email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <button className="primary" disabled={busy || !payload.candidates.length}>{busy ? 'Creating share link…' : 'Send to hiring manager'}</button>
    <p>Your email app opens for you to review and send. The app sends nothing.</p>
    {error && <p role="alert">{error}</p>}
    {draft && <p><a href={draft.href}>Open email draft again</a> · <a href={draft.url} target="_blank" rel="noreferrer">View shared shortlist</a></p>}
  </form>;
}
export function SharedPage({token}:{token:string}) {
  const share = useQuery(api.shares.get,{token});
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{if (!share) return; const timer=setTimeout(()=>setNow(Date.now()),Math.max(0,share.expiresAt-Date.now()));return()=>clearTimeout(timer);},[share]);
  if (share === undefined) return <main><p>Loading shortlist…</p></main>;
  if (!share || share.expiresAt <= now) return <main><h1>Link expired or not found</h1></main>;
  const data = JSON.parse(share.payload) as SharedShortlist;
  return <main><h1>Shortlist: {data.role}</h1><p>Read-only · Link expires {new Date(share.expiresAt).toLocaleDateString()}</p>
    <div className="table-scroll"><table className="ranked-table"><thead><tr><th>Rank</th><th>Name</th><th>Verdict</th><th>Coverage %</th><th>Must-haves met</th></tr></thead><tbody>{data.candidates.map((c,i)=>{const must=snapshotContent(c.result,data.requirements,data.rules,c.cvText).must;return <tr key={i}><td>{i+1}</td><td>{cleanName(c.name)}</td><td>{verdict(c.result,data.requirements)}</td><td>{c.result.coverage}%</td><td>{must.filter(r=>r.evidence.status==='found').length} of {must.length}</td></tr>;})}</tbody></table></div>
    {data.candidates.map((c,i)=><CandidateSnapshot key={i} {...c} name={cleanName(c.name)} role={data.role} requirements={data.requirements} rules={data.rules}/>)}
  </main>;
}
export const rankShared = (a:SharedShortlist['candidates'][number],b:SharedShortlist['candidates'][number]) => verdictRank(b.result)-verdictRank(a.result) || b.result.coverage-a.result.coverage || a.name.localeCompare(b.name);
