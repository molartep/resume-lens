import {ModelEvaluationFields} from './ModelEvaluationFields';
import type {ModelCatalog} from '../../shared/models';
import {screeningModel,validateScreeningConfiguration,type ScreeningConfiguration} from '../../shared/screeningConfiguration';
import {Dimensions} from './Dimensions';
import {Dropdown} from './Dropdown';
export function ScreeningConfigurationEditor({value,onChange,catalog,onValidity}:{value:ScreeningConfiguration;onChange:(value:ScreeningConfiguration)=>void;catalog:ModelCatalog|null;onValidity:(valid:boolean)=>void}){
 const m=value.model;
 function changeModel(parameters:Partial<typeof m>){change({...value,model:{...m,...parameters}});}
 function change(next:ScreeningConfiguration){onChange(next);}
 return <><section className="card"><h2>Evaluation model</h2><label className="field">Model connection<Dropdown value={m.profileId} onValueChange={id=>{const p=catalog?.profiles.find(p=>p.id===id);if(p)change({...value,model:screeningModel(p)});}}><option value={m.profileId}>{catalog?.profiles.find(p=>p.id===m.profileId)?.name||m.profileId} · {m.model}</option>{catalog?.profiles.filter(p=>p.id!==m.profileId).map(p=><option key={p.id} value={p.id} disabled={!p.enabled}>{p.name}{p.enabled?'':' (disabled)'}</option>)}</Dropdown></label>{catalog&&!catalog.profiles.some(p=>p.id===m.profileId&&p.provider===m.provider&&p.enabled)&&<p role="alert" className="error">This model connection is unavailable. Choose an enabled model before screening.</p>}<div className="settings-grid"><ModelEvaluationFields value={m} onChange={change=>changeModel(change)}/><label className="field">Screening date timezone<input value={value.timezone} onChange={e=>change({...value,timezone:e.target.value})}/></label></div><p>{m.provider==='local'?'Model weights and inference defaults are managed by the local Decider server.':'Model distributions follow the selected provider’s existing evaluation protocol.'} Connection URLs and credentials are managed in Settings.</p></section><Dimensions initialConfig={value.dimensions} onSaved={dimensions=>change({...value,dimensions})} onChange={dimensions=>change({...value,dimensions})} onValidity={onValidity}/></>;
}
export function configurationError(value:ScreeningConfiguration){try{validateScreeningConfiguration(value);return '';}catch(e){return (e as Error).message;}}
