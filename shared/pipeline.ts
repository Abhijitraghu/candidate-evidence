export const stages = ['Applied', 'Interviewed', 'Shortlisted', 'Selected', 'Offered'] as const;
export type Stage = typeof stages[number];
export function cumulativeCounts(rows: {stage?: Stage}[]) {
  return stages.map((_, index) => rows.filter(row => stages.indexOf(row.stage ?? 'Applied') >= index).length);
}
export function pipelineCSV(rows: {name:string; candidates:{stage?:Stage}[]}[]) {
  const escape = (value:string|number) => `"${String(value).replaceAll('"','""')}"`;
  return [['Opening name',...stages],...rows.map(row=>[row.name,...cumulativeCounts(row.candidates)])].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}
