import { z } from 'zod';
import type { Screening, ScreeningConfig } from '../../shared/types';
import { buildRequest } from './configService';
import { AppError } from './errors';
import type { RuntimeSettings } from '../../shared/settings';
import { defaultSettings } from './settingsService';
const probability=z.number().finite().min(0).max(1);
const responseSchema=z.object({model:z.string().min(1),answers:z.record(z.string(),z.discriminatedUnion('type',[
 z.object({type:z.literal('noul'),noul:probability}).passthrough(),
 z.object({type:z.literal('choice'),choice:z.string(),probabilities:z.record(z.string(),probability),confidence:probability}).passthrough(),
 z.object({type:z.literal('score'),score:z.number().finite(),legend:z.record(z.string(),z.string()),probabilities:z.record(z.string(),probability),confidence:probability}).passthrough()
])),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}).optional(),latency_ms:z.number().finite().nonnegative().optional()}).passthrough();
export function parseDeciderResponse(raw:unknown,config:ScreeningConfig):Screening {
 const parsed=responseSchema.safeParse(raw);
 const invalid=()=>new AppError(502,'INVALID_DECIDER_RESPONSE','Decider returned an invalid or incomplete result. No analysis was saved.');
 if(!parsed.success) throw invalid();
 const response=parsed.data;
 if(Object.keys(response.answers).length!==Object.keys(config).length) throw invalid();
 for(const [id,q] of Object.entries(config)){
  const a=response.answers[id]; if(!a||a.type!==q.type) throw invalid();
  if(a.type==='noul') continue;
  const keys=q.type==='score'?q.criteria.map((_,i)=>String(i)):Object.keys(q.criteria!);
  if(Object.keys(a.probabilities).length!==keys.length||keys.some(k=>!(k in a.probabilities))||Math.abs(Object.values(a.probabilities).reduce((x,y)=>x+y,0)-1)>0.01) throw invalid();
  if(a.type==='choice'&&(!keys.includes(a.choice)||a.probabilities[a.choice]<Math.max(...Object.values(a.probabilities))-0.001)) throw invalid();
  if(a.type==='score'){
   if(q.type!=='score'||a.score<0||a.score>keys.length-1||keys.some(k=>a.legend[k]!==q.criteria[Number(k)])) throw invalid();
   const expected=keys.reduce((sum,k)=>sum+Number(k)*a.probabilities[k],0);
   if(Math.abs(a.score-expected)>0.03) throw invalid();
  }
 }
 return raw as Screening;
}
export function deciderUrl(){
 const url=new URL(process.env.STRANDS_DECIDER_URL||'http://127.0.0.1:1209');
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/') throw new AppError(500,'DECIDER_CONFIG','STRANDS_DECIDER_URL must be a local http://127.0.0.1 URL.');
 return url.origin;
}
export async function checkDeciderHealth(settings:RuntimeSettings=defaultSettings()){
 try{const r=await fetch(`${deciderUrl()}/health`,{signal:AbortSignal.timeout(settings.decider.healthTimeoutMs)});const data=await r.json();return {online:r.ok&&data.status==='ok',model:typeof data.model==='string'?data.model:undefined,maxLength:data.max_length};}catch{return {online:false};}
}
export async function analyzeWithDecider(text:string,config:ScreeningConfig,settings:RuntimeSettings=defaultSettings()){
 const started=performance.now();
 try{
  const r=await fetch(`${deciderUrl()}/v1/systemone`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(buildRequest(text,config)),signal:AbortSignal.timeout(settings.decider.timeoutMs)});
  if(!r.ok) throw new AppError(502,'DECIDER_REQUEST',r.status===422?'Decider could not process this request. Check the rubric and shorten the reviewed evidence if necessary.':'Decider could not complete the analysis. Try again.');
  let raw:unknown;try{raw=await r.json();}catch{throw new AppError(502,'INVALID_DECIDER_RESPONSE','Decider returned invalid JSON.');}
  return {screening:parseDeciderResponse(raw,config),latencyMs:performance.now()-started};
 }catch(error){if(error instanceof AppError)throw error;if(error instanceof Error&&error.name==='TimeoutError')throw new AppError(504,'DECIDER_TIMEOUT','Decider timed out. The existing model may still be processing; wait before retrying.');throw new AppError(503,'DECIDER_OFFLINE','Strands Decider is offline. Start your separately managed server at 127.0.0.1:1209.');}
}
