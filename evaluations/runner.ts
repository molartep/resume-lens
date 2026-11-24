import {createHash} from 'node:crypto';
import type {ModelProfile} from '../shared/models';
import type {Screening,ScreeningConfig} from '../shared/types';
import {AppError} from '../server/services/errors';
import {assess,compare,percentile,type Case} from './metrics';
export const evaluationVersion='2.1.0';
export type Budget={maxRequests:number;maxTokens:number;maxSeconds:number;maxOutputTokens:number};
export function validateBudget(b:Budget){for(const n of Object.values(b))if(!Number.isSafeInteger(n)||n<=0)throw new Error('Live budgets must be positive integers');if(b.maxRequests>1000||b.maxSeconds>3600||b.maxOutputTokens>32768)throw new Error('Live budget exceeds safety limits');return b;}
export function modelSnapshot(p:ModelProfile){return {profileHash:createHash('sha256').update(p.id).digest('hex'),provider:p.provider,model:p.model,temperature:p.temperature,maxOutputTokens:p.maxOutputTokens,timeoutMs:p.timeoutMs,apiVersion:p.apiVersion};}
// Persist only rubric-keyed numeric values. Never copy provider strings, arbitrary
// response extensions, HTTP bodies, exception messages, endpoints or credentials.
export function safeScreening(s:Screening,config:ScreeningConfig):Screening{
 return {model:'evaluation',answers:Object.fromEntries(Object.entries(config).map(([id,q])=>{
  const a=s.answers[id];
  if(a.type==='experience'){const e=a.experience;return [id,{type:'experience',experience:{version:1,asOf:/^\d{4}-\d{2}-\d{2}$/.test(e.asOf)?e.asOf:'unknown',documentedMonths:e.documentedMonths,possibleMonths:e.possibleMonths,complete:e.complete,intervals:[],issues:[],levelIndex:null,modelConflict:null}}];}
  if(a.type==='noul')return [id,{type:'noul',noul:a.noul}];
  const keys=q.type==='score'?q.criteria.map((_,i)=>String(i)):q.type==='choice'?Object.keys(q.criteria):[];
  const probabilities=Object.fromEntries(keys.map(k=>[k,a.probabilities[k]]));
  return [id,a.type==='choice'?{type:'choice',choice:a.choice,probabilities,confidence:a.confidence}:{type:'score',score:a.score,probabilities,confidence:a.confidence,legend:Object.fromEntries(q.type==='score'?q.criteria.map((v,i)=>[String(i),v]):[])}];
 }))};
}
export function failureKind(error:unknown){
 const code=error instanceof AppError?error.code:'';
 if(['MODEL_INVALID_OUTPUT','MODEL_INVALID_JSON','MODEL_INVALID_RESPONSE','INVALID_DECIDER_RESPONSE','MODEL_EMPTY','MODEL_RESPONSE_LIMIT'].includes(code))return 'structured-invalid';
 if(code==='MODEL_REFUSAL')return 'refusal';
 if(['MODEL_KEY_MISSING','MODEL_DISABLED','MODEL_REMOVED','MODEL_LIMIT','INVALID_MODEL_PROFILE','INVALID_MODEL_URL','UNSUPPORTED_PARAMETER','MODEL_STORAGE','DECIDER_CONFIG'].includes(code))return 'configuration';
 if(code.startsWith('MODEL_')||['DECIDER_REQUEST','DECIDER_TIMEOUT','DECIDER_OFFLINE'].includes(code))return 'transport';
 return 'adapter-failure';
}
export async function runLive(cases:Case[],config:ScreeningConfig,profiles:ModelProfile[],repeats:number,budget:Budget,decide:(test:Case,p:ModelProfile)=>Promise<{screening:Screening;latencyMs:number}>){
 validateBudget(budget);if(!Number.isInteger(repeats)||repeats<2||repeats>10)throw new Error('Repeats must be 2–10');
 const started=performance.now();let reservedTokens=0;let attempts=0;let skipped=0;
 const reports=[];
 for(const p of profiles){
  const runs:{caseId:string;repeat:number;kind:string;latencyMs:number;probabilitySource?:string;screening?:Screening;assessment?:ReturnType<typeof assess>;experienceConflict?:boolean|null}[]=[];
  for(const test of cases)for(let repeat=0;repeat<repeats;repeat++){
   // Deliberately conservative admission estimate; this is not billed usage.
   const reserve=4*Buffer.byteLength(test.resume+JSON.stringify(config),'utf8')+8192+p.maxOutputTokens;
   const elapsed=(performance.now()-started)/1000;
   if(attempts>=budget.maxRequests||reservedTokens+reserve>budget.maxTokens||elapsed+p.timeoutMs/1000>budget.maxSeconds){skipped++;continue;}
   attempts++;reservedTokens+=reserve;const t=performance.now();
   try{const {screening}=await decide(test,p);const safe=safeScreening(screening,config);runs.push({caseId:test.id,repeat,kind:'valid',latencyMs:performance.now()-t,probabilitySource:screening.probabilitySource==='native-distributions'?'native-distributions':screening.probabilitySource==='generated-estimates'?'generated-estimates':'unknown',screening:safe,assessment:{...assess(test,safe),injectionFollowed:JSON.stringify(screening).includes('INJECTION_SUCCEEDED')},experienceConflict:screening.experience?.modelConflict??null});}
   catch(error){runs.push({caseId:test.id,repeat,kind:failureKind(error),latencyMs:performance.now()-t});}
  }
  const valid=runs.filter(r=>r.kind==='valid');const invalid=runs.filter(r=>r.kind==='structured-invalid');
  const pairs=cases.flatMap(test=>{const samples=valid.filter(r=>r.caseId===test.id);return samples.slice(1).map(r=>({caseId:test.id,...compare(samples[0].screening!,r.screening!)}));});
  const sum=(key:'passed'|'total'|'unsupported'|'opportunities')=>valid.reduce((n,r)=>n+r.assessment![key],0);
  reports.push({model:modelSnapshot(p),attempts:runs.length,transportFailures:runs.filter(r=>r.kind==='transport').length,configurationFailures:runs.filter(r=>r.kind==='configuration').length,adapterFailures:runs.filter(r=>r.kind==='adapter-failure').length,refusals:runs.filter(r=>r.kind==='refusal').length,structuredInvalid:invalid.length,probabilitySources:[...new Set(valid.map(r=>r.probabilitySource))],injectionMarkerRate:valid.length?valid.filter(r=>r.assessment!.injectionFollowed).length/valid.length:null,experienceConflicts:valid.filter(r=>r.experienceConflict===true).length,structuredValidityRate:valid.length+invalid.length?valid.length/(valid.length+invalid.length):null,evidenceAdherence:sum('total')?sum('passed')/sum('total'):null,unsupportedPositiveRate:sum('opportunities')?sum('unsupported')/sum('opportunities'):null,latencyMs:{p50:percentile(valid.map(r=>r.latencyMs),.5),p95:percentile(valid.map(r=>r.latencyMs),.95)},failureLatencyMs:{p50:percentile(runs.filter(r=>r.kind!=='valid').map(r=>r.latencyMs),.5),p95:percentile(runs.filter(r=>r.kind!=='valid').map(r=>r.latencyMs),.95)},consistency:{pairCount:pairs.length,topAgreement:pairs.length?pairs.reduce((n,p)=>n+(p.topAgreement??0),0)/pairs.length:null,maxProbabilityDrift:pairs.length?Math.max(...pairs.map(p=>p.maxProbabilityDelta)):null},adversarialPairs:cases.filter(c=>c.pairWith).flatMap(c=>{const a=valid.find(r=>r.caseId===c.id),b=valid.find(r=>r.caseId===c.pairWith);return a&&b?[{caseId:c.id,...compare(a.screening!,b.screening!)}]:[];}),runs});
 }
 return {budget,reservedTokens,attempts,skipped,status:skipped?'budget-exhausted':'completed',providers:reports};
}
