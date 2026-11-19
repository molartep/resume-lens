import {ModelSettings} from './ModelSettings';
import {SaveConfirmation} from './SaveConfirmation';
import {useEffect,useState} from 'react';
import type {RuntimeSettings,SettingsResponse} from '../../shared/settings';
export type SettingsTarget={id:'analysis-models'|'document-processing';request:number};
type Props={onSaved:(settings:RuntimeSettings)=>void;target?:SettingsTarget};
const formId='workspace-settings';
async function request(init?:RequestInit):Promise<SettingsResponse>{const response=await fetch('/api/settings',init);const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Settings could not be loaded.');return data;}
export function Settings({onSaved,target}:Props){
 const [data,setData]=useState<SettingsResponse|null>(null),[draft,setDraft]=useState<RuntimeSettings|null>(null),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{const result=await request();setData(result);setDraft(result.settings);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!draft||!target)return;const section=document.getElementById(target.id);section?.focus({preventScroll:true});section?.scrollIntoView({behavior:'smooth',block:'start'});},[!!draft,target]);
 function update(section:'parser'|'decider'|'workflow',key:string,value:string|number|boolean){setDraft(previous=>previous?{...previous,[section]:{...previous[section],[key]:value}}:previous);}
 async function save(event:React.FormEvent){event.preventDefault();if(!draft)return;setBusy(true);setError('');try{const current=await request();const result=await request({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,screeningConfig:current.settings.screeningConfig})});setData(result);setDraft(result.settings);onSaved(result.settings);setConfirmation('Your changes are saved and will apply to new operations.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function finishConfirmation(){setConfirmation('');requestAnimationFrame(()=>{document.getElementById('settings-page-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}
 const numberField=(section:'parser'|'decider'|'workflow',key:string,label:string,value:number,min:number,max:number,help:string,step=1)=><label className="field" key={key}>{label}<span>{help}</span><input form={formId} type="number" value={Number.isNaN(value)?'':value} min={min} max={max} step={step} required onChange={e=>update(section,key,e.target.valueAsNumber)}/></label>;
 if(!draft||!data)return <div role="status">{error?<div className="error" role="alert">{error}<button onClick={()=>void load()}>Retry</button></div>:'Loading settings…'}</div>;
 return <div className="settings-workspace">
  <form id={formId} onSubmit={save}/>
  <ModelSettings onChanged={()=>onSaved(draft)} onSaved={setConfirmation}>
   <fieldset disabled={busy} className="settings-grid">{numberField('decider','timeoutMs','Legacy analysis timeout (ms)',draft.decider.timeoutMs,10000,600000,'Fallback for jobs accepted before model connections existed.',1000)}{numberField('decider','healthTimeoutMs','Health-check timeout (ms)',draft.decider.healthTimeoutMs,1000,10000,'Maximum wait for the local Decider health check.',1000)}</fieldset>
  </ModelSettings>
  {error&&<div className="error" role="alert">{error}</div>}
  <section id="document-processing" className="card document-processing" tabIndex={-1} aria-labelledby="document-processing-title">
   <div className="card-heading"><h2 id="document-processing-title">Document Processing</h2><span className="tag">LLAMAINDEX</span></div><p>Configure PDF extraction, upload limits and evidence review.</p>
   <fieldset disabled={busy}>
    <section className="settings-subsection"><h3>LlamaIndex parsing</h3><div className="settings-grid">
     <label className="field">Parse tier<span>Choose the parsing speed and capability for future uploads.</span><select form={formId} value={draft.parser.tier} onChange={e=>update('parser','tier',e.target.value)}><option value="fast">Fast · rule-based</option><option value="cost_effective">Cost effective · balanced</option><option value="agentic">Agentic · AI parsing</option><option value="agentic_plus">Agentic plus · premium</option></select></label>
     <label className="field">Parser version<span>Use “latest” or a supported dated version for the selected tier.</span><input form={formId} value={draft.parser.version} onChange={e=>update('parser','version',e.target.value)} required pattern="latest|[0-9]{4}-[0-9]{2}-[0-9]{2}"/></label>
     {numberField('parser','timeoutMs','Parsing timeout (ms)',draft.parser.timeoutMs,10000,600000,'Total time for upload, job creation and polling.',1000)}{numberField('parser','pollIntervalMs','Polling interval (ms)',draft.parser.pollIntervalMs,500,10000,'Wait between checks of a pending parse job.',100)}
    </div><label className="field">Extraction instructions<span>{draft.parser.tier==='fast'?'Fast is rule-based; these instructions are preserved but not sent.':'Guide faithful extraction; preserve professional details and avoid personal-attribute inference.'}</span><textarea form={formId} rows={5} value={draft.parser.customPrompt} disabled={draft.parser.tier==='fast'} maxLength={5000} onChange={e=>update('parser','customPrompt',e.target.value)}/></label>
    <label className="check"><input form={formId} type="checkbox" checked={draft.parser.disableCache} onChange={e=>update('parser','disableCache',e.target.checked)}/>Bypass the LlamaIndex parse cache for new uploads</label><p>Tier and version availability depend on your LlamaCloud account. <a href="https://developers.llamaindex.ai/reference/resources/parsing/methods/create/" target="_blank" rel="noreferrer">Official parser options ↗</a></p></section>
    <section className="settings-subsection"><h3>Upload and review</h3><div className="settings-grid">{numberField('workflow','maxPdfMb','Maximum PDF size (MB)',draft.workflow.maxPdfMb,1,20,'Uploads stay in bounded memory; PDF only.')}{numberField('workflow','draftExpiryMinutes','Draft expiry (minutes)',draft.workflow.draftExpiryMinutes,1,60,'Applied when a new parsed draft is created.')}{numberField('workflow','maxPendingDrafts','Maximum pending drafts',draft.workflow.maxPendingDrafts,1,20,'Limits parsed resumes held in memory.')}</div></section>
   </fieldset>
   <details className="settings-subsection"><summary>LlamaCloud environment configuration</summary><p>These values are configured server-side in .env. Restart the API after changing them.</p><dl className="environment-list"><dt>LlamaIndex API URL</dt><dd>{data.environment.llamaIndexApiUrl||'Not configured'}</dd><dt>LlamaIndex API key</dt><dd>{data.environment.llamaIndexKeyConfigured?'Configured · secret hidden':'Not configured'}</dd><dt>Project ID</dt><dd>{data.environment.projectId||'Default project'}</dd><dt>Organization ID</dt><dd>{data.environment.organizationId||'Default organization'}</dd></dl></details>
  </section>
  <details className="card workspace-environment"><summary>Workspace environment</summary><dl className="environment-list"><dt>Database</dt><dd>{data.environment.databaseConfigured?'DATABASE_URL configured':'DATABASE_URL not configured'}</dd><dt>Backend port</dt><dd>{data.environment.port}</dd></dl></details>
  <div className="settings-actions"><button type="button" disabled={busy} className="secondary" onClick={()=>void load()}>Discard changes</button><button form={formId} disabled={busy} className="primary" type="submit">{busy?'Saving…':'Save settings'}</button></div>
  {confirmation&&<SaveConfirmation message={confirmation} onClose={finishConfirmation}/>}
 </div>;
}
