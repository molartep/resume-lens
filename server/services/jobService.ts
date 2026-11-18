import {modelTemplate} from '../../shared/models';
import {deciderUrl} from './deciderService';
import type {Dependencies} from '../routes/api';
import type {RuntimeSettings} from '../../shared/settings';
import type {ParsedResume,ScreeningConfig} from '../../shared/types';
import {JobQueue} from '../repositories/jobQueue';
import {AppError} from './errors';
import {normalizeResume,suggestProfessionalEvidence} from './resumeService';

export type DurableDraft={parsed:ParsedResume;filename:string;pdfKey?:string;resumeId?:string;expires:number};
type AnalysisInput={token:string;evidence:string;name:string;candidateId?:string};
export function jobService(queue:JobQueue,deps:Dependencies){
 let running:Promise<void>|undefined;let stopped=true;let timer:NodeJS.Timeout|undefined;
 async function processNext(){
  const job=queue.claim();if(!job)return;
  const heartbeat=setInterval(()=>{try{queue.heartbeat(job.id,job.owner);}catch{/* The lease will expire if SQLite remains unavailable. */}},20_000);heartbeat.unref();
  const progress=(percent:number,message:string,checkpoint?:unknown)=>queue.update(job.id,job.owner,percent,message,checkpoint);
  try{
   let result:unknown;
   if(job.kind==='parse'){
    const {pdf,filename,settings}=job.payload as {pdf:string;filename:string;settings:RuntimeSettings};
    progress(15,'Extracting resume with LlamaIndex');
    const parsed:ParsedResume=job.checkpoint??await deps.parse(Buffer.from(pdf,'base64'),settings);
    parsed.text=normalizeResume(parsed.text);
    if(!parsed.text)throw new AppError(422,'EMPTY_RESUME','No text was extracted from this PDF.');
    if(parsed.text.length>200000)throw new AppError(413,'RESUME_TOO_LONG','The extracted resume is too large. Use a shorter resume.');
    progress(75,'Saving parsed resume',parsed);
    const pdfKey=`${job.id}.pdf`;
    await deps.pdfs!.persist(pdfKey,Buffer.from(pdf,'base64'));
    const document=await deps.resumes!.create({id:job.id,filename,pdfKey,parsedResume:parsed});
    const expires=Date.now()+settings.workflow.draftExpiryMinutes*60_000;
    queue.saveDraft(job.id,{parsed,filename,pdfKey,resumeId:document.id,expires},expires);
    result={token:job.id,filename,resumeId:document.id,parsedResume:parsed,suggestedEvidence:suggestProfessionalEvidence(parsed.text),expiresInMinutes:settings.workflow.draftExpiryMinutes};
   }else{
    const {input,draft,settings,config}=job.payload as {input:AnalysisInput;draft:DurableDraft;settings:RuntimeSettings;config:ScreeningConfig};
    // Jobs accepted before model profiles existed were always local Decider jobs.
    const executionSettings=deps.models&&!settings.inference?{...settings,inference:{...modelTemplate('local'),baseUrl:deciderUrl(),timeoutMs:settings.decider.timeoutMs}}:settings;
    progress(15,'Checking analysis model availability');
    let decision=job.checkpoint;
    if(!decision){
     if(!(await deps.health(executionSettings)).online)throw new AppError(503,'MODEL_OFFLINE','The selected analysis model is unavailable. Check its connection in Settings.');
     progress(30,'Analyzing screening dimensions');
     decision=await deps.decide(input.evidence,config,executionSettings);
    }
    progress(85,'Saving candidate and analysis',decision);
    const {candidate,analysis}=await deps.analyses.save({id:job.id,candidateId:input.candidateId,name:input.name,resumeFilename:draft.filename,resumePdfKey:draft.pdfKey,resumeDocumentId:draft.resumeId,parsedResume:draft.parsed,evidence:input.evidence,screening:decision.screening,config,latencyMs:decision.latencyMs});
    result={candidate,analysis,parsedResume:draft.parsed,screening:decision.screening,metadata:{analysisId:analysis.id,analyzedAt:analysis.analyzedAt,deciderLatencyMs:decision.latencyMs}};
   }
   progress(95,'Finalizing job');queue.finish(job.id,job.owner,result);
   if(job.kind==='analyze')queue.deleteDraft(job.payload.input.token);
  }catch(error){queue.fail(job.id,job.owner,error);}finally{clearInterval(heartbeat);}
 }
 async function tick(){if(stopped||running)return;running=processNext();try{await running;}catch(error){console.error('Queue worker failure',{name:error instanceof Error?error.name:'unknown'});}finally{running=undefined;}}
 return {
  queue,
  start(){if(!stopped)return;stopped=false;timer=setInterval(()=>void tick(),500);timer.unref();void tick();},
  async stop(){stopped=true;clearInterval(timer);await running;},
  async runOnce(){await processNext();},
  parse(pdf:Buffer,filename:string,settings:RuntimeSettings,key?:string){
   const existing=key?queue.findByKey(`parse:${key}`):undefined;if(existing)return existing;
   if(queue.draftCount()+queue.pendingParses()>=settings.workflow.maxPendingDrafts)throw new AppError(429,'DRAFT_LIMIT','Too many pending drafts. Complete an analysis or wait for drafts to expire.');
   return queue.enqueue('parse',{pdf:pdf.toString('base64'),filename,settings},key?`parse:${key}`:undefined);
  },
  analyze(input:AnalysisInput,settings:RuntimeSettings,config:ScreeningConfig){
   const existing=queue.findByKey(`analyze:${input.token}`);if(existing)return existing;
   const draft=queue.draft<DurableDraft>(input.token);
   if(!draft)throw new AppError(410,'DRAFT_EXPIRED','This resume draft expired. Upload or reuse the PDF again.');
   return queue.enqueue('analyze',{input,draft,settings,config},`analyze:${input.token}`);
  }
 };
}
export type JobService=ReturnType<typeof jobService>;
