import {useEffect,useState} from 'react';
import {normalized,applyTemplate,type ScreeningConfiguration,type ScreeningTemplate,type TemplateProvenance} from '../../shared/screeningConfiguration';
import {configurationError} from './ScreeningConfigurationEditor';
import {templateApi} from './templateApi';
import {Dropdown} from './Dropdown';
export type WorkingConfiguration={configuration:ScreeningConfiguration;provenance?:TemplateProvenance;sourceConfiguration?:ScreeningConfiguration};
export function workingFromTemplate(t:ScreeningTemplate):WorkingConfiguration{return {...applyTemplate(t),sourceConfiguration:structuredClone(t.configuration)};}
export function workingProvenance(w:WorkingConfiguration){return w.provenance?{...w.provenance,modifiedAfterApplication:normalized(w.configuration)!==normalized(w.sourceConfiguration)}:undefined;}
export function ScreeningTemplateControls({working,onChange,onManage,onValid,disabled=false}:{working:WorkingConfiguration;onChange:(value:WorkingConfiguration)=>void;onManage:()=>void;onValid:(valid:boolean)=>void;disabled?:boolean}){
 const [templates,setTemplates]=useState<ScreeningTemplate[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setTemplates(await templateApi<ScreeningTemplate[]>());setLoaded(true);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('focus',refresh);const timer=setInterval(refresh,15000);return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};},[]);
 const source=templates.find(t=>t.id===working.provenance?.templateId);
 const current=!!source&&source.revision===working.provenance?.templateRevision;
 const validation=working.provenance?configurationError(working.configuration):'';
 useEffect(()=>onValid(loaded&&current&&!validation&&!busy),[loaded,current,validation,busy]);
 async function select(id:string){setBusy(true);setError('');try{const latest=await templateApi(`/${id}`);onChange(workingFromTemplate(latest));setTemplates(list=>[latest,...list.filter(t=>t.id!==latest.id)]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <fieldset disabled={disabled||busy} className="template-workspace"><section className="card"><div className="card-heading"><h2>Screening template</h2><button type="button" className="secondary" onClick={onManage}>Manage templates</button></div>{error&&<div role="alert" className="error">{error}<button type="button" className="secondary" onClick={()=>void load()}>Retry</button></div>}<label className="field">Screening template <span>Required for every analysis</span><Dropdown required value={working.provenance?.templateId||''} disabled={!loaded} onValueChange={id=>void select(id)}><option value="" disabled>Select a screening template…</option>{working.provenance&&!source&&<option value={working.provenance.templateId} disabled>{working.provenance.templateName} (deleted)</option>}{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Dropdown></label>{!loaded&&!error&&<p role="status">Loading screening templates…</p>}{loaded&&!templates.length&&<p>No screening templates yet. Create a template to start an analysis.</p>}{working.provenance&&<p role="status">Based on {working.provenance.templateName} · Revision {working.provenance.templateRevision}{loaded&&!source?' · Template deleted. Select another template.':source&&!current?' · Newer template revision available. Reload before analysis.':''}</p>}{source&&!current&&<button type="button" className="secondary" onClick={()=>void select(source.id)}>Reload latest template</button>}{validation&&<p className="error" role="alert">{validation}</p>}</section></fieldset>;
}
