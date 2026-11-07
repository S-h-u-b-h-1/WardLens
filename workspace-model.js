// WardLens browser-private investigation helpers. No network access, no claims of verification.
export const WORKSPACE_SCHEMA = 'awaazgraph.browser-workspace.v1';
export const MAX_WORKSPACE_REPORTS = 30;
export const MAX_WORKSPACE_AGE_MS = 30 * 86400000;

const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
const isVoice = node => ['gnani-reviewed','gnani-edited'].includes(node.transcription?.provider);
const isDismissed = link => ['rejected-link','stale-rejected-link'].includes(link.status);

export function investigationSummary(nodes = [], links = []) {
  const candidateLinks=links.filter(link=>!isDismissed(link));
  const unresolved=nodes.filter(node=>node.evidence?.status==='needs-clarification'||!(node.evidence?.symptoms||[]).length);
  const voiceCount=nodes.filter(isVoice).length;
  const conflicts=candidateLinks.filter(link=>link.kind==='contradiction').length;
  const unknownTime=nodes.filter(node=>!node.observedAt).length;
  const topics = new Map();
  for (const node of nodes) for (const symptom of new Set(node.evidence?.symptoms||[])) topics.set(symptom,(topics.get(symptom)||0)+1);
  const topTopics=[...topics.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).map(([name,count])=>({name,count}));
  let next={title:'Start with a firsthand report',body:'Speak or type one observation, review it, and place its location on the map.',action:'capture',label:'Add a report'};
  if(nodes.length && unresolved.length) n¶»§q«^