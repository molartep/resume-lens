import type {ModelProfile} from '../../shared/models';
import {usesGeminiDecisions} from '../../shared/models';
export type ModelEvaluationParameters=Pick<ModelProfile,'provider'|'model'|'timeoutMs'|'maxOutputTokens'|'temperature'|'apiVersion'>;
/** Shared by connection settings and local screening/template configuration. */
export function ModelEvaluationFields({value:p,onChange}:{value:ModelEvaluationParameters;onChange:(change:Partial<ModelEvaluationParameters>)=>void}){return <>
 <label className="field">Model ID<input required value={p.model} disabled={p.provider==='local'} onChange={e=>onChange({model:e.target.value,...(usesGeminiDecisions({...p,model:e.target.value})?{temperature:null,apiVersion:'v1beta'}:{})})}/></label>
 <label className="field">Request timeout (ms)<input type="number" min={1000} max={600000} step={1000} required value={p.timeoutMs} onChange={e=>onChange({timeoutMs:e.target.valueAsNumber})}/></label>
 {p.provider!=='local'&&p.provider!=='openai-decisions'&&!usesGeminiDecisions(p)&&<><label className="field">Maximum output tokens<input type="number" min={256} max={65536} required value={p.maxOutputTokens} onChange={e=>onChange({maxOutputTokens:e.target.valueAsNumber})}/></label>{!(p.provider==='anthropic'&&p.apiVersion>='2026-10-21')&&<label className="field">Temperature (blank = provider default)<input type="number" min={0} max={2} step={0.1} value={p.temperature??''} onChange={e=>onChange({temperature:e.target.value===''?null:e.target.valueAsNumber})}/></label>}</>}
 {['anthropic','gemini'].includes(p.provider)&&<label className="field">API version<input required value={p.apiVersion} onChange={e=>onChange({apiVersion:e.target.value})}/></label>}
 </>;}
