import {useState} from 'react';
import type {SettingsTarget} from './Settings';
const providerNames:Record<string,string>={local:'Strands Decider','openai-decisions':'OpenAI',gemini:'Gemini',anthropic:'Claude',groq:'Groq'};
function Pencil(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>;}
function Refresh(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7a9 9 0 1 0 1 9"/><path d="M20 3v5h-5"/></svg>;}
export function SystemStatus({status,busy,onEdit,onRefresh}:{status:Record<string,string>;busy:boolean;onEdit:(id:SettingsTarget['id'])=>void;onRefresh:()=>Promise<void>}){
 const [refreshing,setRefreshing]=useState(false);const provider=providerNames[status.analysisProvider];
 async function refresh(){setRefreshing(true);try{await onRefresh();}finally{setRefreshing(false);}}
 const services:{label:string;key:string;good:string;target?:SettingsTarget['id']}[]=[{label:'Document Processing (LlamaIndex)',key:'llamaIndex',good:'Configured',target:'document-processing'},{label:`Analysis Model${provider?` (${provider})`:''}`,key:'decider',good:'Online',target:'analysis-models'},{label:'Database',key:'database',good:'Connected'}];
 return <section className="system" aria-labelledby="system-status-title">
  <div className="system-heading"><h2 id="system-status-title">System Status</h2><button type="button" className={`status-refresh${refreshing?' refreshing':''}`} aria-label="Refresh system status" title="Refresh system status" disabled={busy||refreshing} aria-busy={refreshing} onClick={()=>void refresh()}><Refresh/></button></div>
  <ul className="system-services" aria-live="polite" aria-busy={refreshing}>{services.map(service=><li className="service-status" key={service.key}>
   <div className="service-copy"><span className="service-label">{service.label}</span><span className="service-state"><i className={status[service.key]===service.good||status[service.key]==='Ready'?'online':'offline'} aria-hidden="true"/>{status[service.key]||'Checking'}</span></div>
   {service.target&&<button type="button" className="status-edit" aria-label={`Edit ${service.target==='analysis-models'?'Analysis Model':'Document Processing'} settings`} title="Edit settings" disabled={busy} onClick={()=>onEdit(service.target!)}><Pencil/></button>}
  </li>)}</ul>
 </section>;
}
