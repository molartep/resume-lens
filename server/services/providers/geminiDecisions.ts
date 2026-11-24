import {modelEntries} from '../../../shared/types';
import type {ModelProfile} from '../../../shared/models';
import type {ScreeningConfig,Screening} from '../../../shared/types';
import {parseDeciderResponse} from '../deciderService';
import {AppError} from '../errors';
import {reviewPolicy,invalid} from './protocol';
// https://aistudio.google.com/docs/decisions-api — v1beta REST contract.
export function geminiDecisionsRequest(text:string,config:ScreeningConfig,p:ModelProfile){
 const questions=modelEntries(config);
 const limit=()=>new AppError(400,'MODEL_LIMIT','Gemini Decisions requires 1–1,000 questions, keys of 1–64 ASCII letters/digits/underscores/hyphens, and 2–255 options or rubric levels.');
 if(questions.length<1||questions.length>1000)throw limit();
 return {model:p.model,input:text,questions:Object.fromEntries(questions.map(([id,q])=>{
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw limit();
  // Decisions has no system-message parameter; repeat the trusted policy in each independent question.
  const instructions=`${reviewPolicy} Missing evidence is not proof of absent ability.\n${typeof q.instructions==='string'?q.instructions:JSON.stringify(q.instructions)}`;
  if(q.type==='noul')return [id,{type:q.type,instructions,...(q.criteria?{criteria:{...(q.criteria.true!==undefined?{true_description:q.criteria.true}:{}),...(q.criteria.false!==undefined?{false_description:q.criteria.false}:{})}}:{})}];
  const criteria=q.criteria;const keys=Object.keys(criteria);
  if(keys.length<2||keys.length>255)throw limit();
  if(q.type==='choice'&&keys.some(k=>k.length>128||Buffer.byteLength(k,'utf8')>512||k.trim()!==k||/[\u0000-\u001f\u007f]|[^\S ]/u.test(k)))throw limit();
  if(q.type==='score'&&q.criteria.some(s=>!s.trim()))throw limit();
  return [id,{type:q.type,instructions,criteria}];
 }))};
}
export function normalizeGeminiDecisions(raw:any,p:ModelProfile,config:ScreeningConfig):Screening{
 if(!raw?.answers||typeof raw.answers!=='object'||Array.isArray(raw.answers))throw invalid();
 for(const [id,q] of modelEntries(config)){
  const a=raw.answers[id];if(!a||a.type!==q.type)throw invalid();
  if(q.type==='noul'&&(typeof a.noul!=='number'||a.noul<.01||a.noul>.99||!Number.isFinite(a.noul)||typeof a.confidence!=='number'||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1))throw invalid();
 }
 const result={model:p.model,provider:p.provider,profileId:p.id,probabilitySource:'native-distributions',answers:raw.answers,usage:raw.usage?{input_tokens:raw.usage.total_input_tokens,output_tokens:raw.usage.total_output_tokens}:undefined,providerResponse:raw};
 if(raw.usage?.total_output_tokens!==undefined&&raw.usage.total_output_tokens!==0)throw invalid();
 try{return parseDeciderResponse(result,config);}catch{throw invalid();}
}
