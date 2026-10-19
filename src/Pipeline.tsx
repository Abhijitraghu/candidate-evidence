import {cumulativeCounts,pipelineCSV,stages,type Stage} from '../shared/pipeline';
import {verdict} from './lib/verdict';
import type {CandidateResult} from '../shared/recommendation';
import type {DraftRequirement} from '../shared/assessment';
export type Opening = {key:string;name:string;payload:string;candidates:{name:string;stage:Stage;history:{stage:string;date:string}[]}[]};
export function Pipeline({openings,onOpen,selected,onSelect}:{openings:Opening[]|undefined;onOpen:(o:Opening)=>void;selected:string|null;onSelect:(key:string)=>void}) {
 const opening=openings?.find(o=>o.key===selected);
 function download(){const url=URL.createObjectURL(new Blob([pipelineCSV(openings??[])],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='hiring-pipeline.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="panel" aria-label="Hiring pipeline"><div className="section-heading"><h1>Pipeline</h1><button className="primary" disabled={!openings?.length} onClick={download}>Download CSV</button></div><p>Counts include candidates at each stage and every stage before it.</p>{openings===undefined?<p role="status">Loading openings…</p>:!openings.length?<p>No screened candidates yet. Screen a candidate to start an opening’s pipeline.</p>:<div className="table-scroll"><table className="ranked-table pipeline-table"><thead><tr>{['Opening name',...stages].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{openings.map(o=><tr key={o.key}><td><button className="text-button" onClick={()=>onSelect(o.key)}>{o.name}</button></td>{cumulativeCounts(o.candidates).map((n,i)=><td key={i}>{n}</td>)}</tr>)}</tbody></table></div>}
 {opening&&<section aria-label={`History for ${opening.name}`}><div className="section-heading"><h2>{opening.name} · History</h2><button className="secondary" onClick={()=>onOpen(opening)}>Open shortlist</button></div><div className="table-scroll"><table className="ranked-table"><thead><tr><th>Candidate</th><th>Verdict</th><th>Current stage</th><th>Stage changes</th></tr></thead><tbody>{opening.candidates.map(c=>{
 const saved=JSON.parse(opening.payload) as {candidates:{name:string;result:CandidateResult|null;error?:string}[];requirements:DraftRequirement[]};const row=saved.candidates.find(r=>r.name===c.name);
 return <tr key={c.name}><td>{c.name}</td><td>{row?.result?verdict(row.result,saved.requirements):'Unable to assess'}</td><td>{c.stage}</td><td><ol>{c.history.map((h,i)=><li key={i}>{h.stage} — <time dateTime={h.date}>{h.date}</time></li>)}</ol></td></tr>;
 })}</tbody></table></div></section>}
 </section>;
}
