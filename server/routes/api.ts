import type {resumeRepository} from '../repositories/resumeRepository';
import type {ResumeFileStore} from '../services/resumeFileService';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { RuntimeSettings } from '../../shared/settings';
import type { SettingsStore } from '../repositories/settingsRepository';
import { defaultSettings,validateSettings,settingsEnvironment } from '../services/settingsService';
import { validateConfig,resolveConfig } from '../services/configService';
import { AppError } from '../services/errors';
import { normalizeResume,suggestProfessionalEvidence,assertProfessionalEvidence } from '../services/resumeService';
import type { ParsedResume, Screening, ScreeningConfig } from '../../shared/types';
import type { candidateRepository } from '../repositories/candidateRepository';
import type { analysisRepository } from '../repositories/analysisRepository';
export type Dependencies={candidates:ReturnType<typeof candidateRepository>;analyses:Pick<ReturnType<typeof analysisRepository>,'list'|'save'> & Partial<Pick<ReturnType<typeof analysisRepository>,'find'>>;pdfs?:ResumeFileStore;resumes?:ReturnType<typeof resumeRepository>;settings?:SettingsStore;parse:(pdf:Buffer,settings?:RuntimeSettings)=>Promise<ParsedResume>;decide:(text:string,config:ScreeningConfig,settings?:RuntimeSettings)=>Promise<{screening:Screening;latencyMs:number}>;parserConfigured:()=>boolean;health:(settings?:RuntimeSettings)=>Promise<{online:boolean;model?:string}>};
export function apiRouter(deps:Dependencies){
 const router=Router();
 let inMemorySettings=defaultSettings();
 const store=deps.settings||{get:async()=>structuredClone(inMemorySettings),save:async(value:RuntimeSettings)=>{inMemorySettings=structuredClone(value);return structuredClone(value);}};
 const pending=new Map<string,{parsed:ParsedResume;filename:string;pdfKey?:string;resumeId?:string;expires:number}>();
 let busy=false; // Limit memory and avoid overlapping calls to the single model.
 const cleanup=()=>{if(busy)return;for(const [id,item] of pending)if(item.expires<Date.now()){pending.delete(id);if(item.pdfKey&&!item.resumeId)void deps.pdfs?.discardDraft(item.pdfKey).catch(()=>console.error('Could not remove expired PDF draft.'));}};
 const timer=setInterval(()=>{cleanup();if(!busy)void deps.pdfs?.cleanupDrafts().catch(()=>console.error('Could not clean PDF drafts.'));},60000);timer.unref();
 const upload=(settings:RuntimeSettings)=>multer({storage:multer.memoryStorage(),limits:{fileSize:settings.workflow.maxPdfMb*1024*1024,files:1,fields:0},fileFilter:(_req,file,cb)=>{
  if(file.mimetype!=='application/pdf'||!file.originalname.toLowerCase().endsWith('.pdf'))return cb(new AppError(400,'INVALID_PDF','Upload a PDF file with a .pdf extension.'));
  cb(null,true);
 }});
 router.get('/health',async(_req,res)=>{
  let config=true;let settings:RuntimeSettings|undefined;try{settings=await store.get();}catch{config=false;}
  const [decider,database]=await Promise.all([deps.health(settings),deps.candidates.health().then(()=>true).catch(()=>false)]);
  res.json({llamaIndex:deps.parserConfigured()?'Configured':'Error',decider:decider.online?'Online':'Offline',database:database?'Connected':'Error',model:decider.model,config:config?'Valid':'Error'});
 });
 router.get('/config',async(_req,res)=>res.json((await store.get()).screeningConfig));
 router.put('/config',async(req,res)=>{if(busy)throw new AppError(409,'BUSY','Wait for the current resume operation before changing dimensions.');busy=true;try{const settings=await store.get();const value=validateSettings({...settings,screeningConfig:req.body});await store.save(value);res.json(value.screeningConfig);}finally{busy=false;}});
 router.get('/settings',async(_req,res)=>res.json({settings:await store.get(),environment:settingsEnvironment()}));
 router.put('/settings',async(req,res)=>{if(busy)throw new AppError(409,'BUSY','Wait for the current resume operation before changing settings.');const value=validateSettings(req.body);busy=true;try{res.json({settings:await store.save(value),environment:settingsEnvironment()});}finally{busy=false;}});
 router.get('/candidates',async(_req,res)=>res.json(await deps.candidates.list()));
 router.get('/candidates/:id',async(req,res)=>{const candidate=await deps.candidates.find(String(req.params.id));if(!candidate)throw new AppError(404,'NOT_FOUND','Candidate not found.');res.json(candidate);});
 router.get('/candidates/:id/analyses',async(req,res)=>{if(!await deps.candidates.find(String(req.params.id)))throw new AppError(404,'NOT_FOUND','Candidate not found.');res.json(await deps.analyses.list(String(req.params.id)));});
 router.get('/analyses/:id/resume',async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)throw new AppError(404,'PDF_NOT_FOUND','Resume PDF not found.');
  const analysis=await deps.analyses.find?.(String(req.params.id));
  if(!analysis?.resumePdfKey||!deps.pdfs)throw new AppError(404,'PDF_NOT_FOUND','The original PDF was not retained for this analysis.');
  const file=await deps.pdfs.storedPath(analysis.resumePdfKey);
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(analysis.resumeFilename||'resume.pdf')}`);
  await new Promise<void>((resolve,reject)=>res.sendFile(file,error=>error?reject(error):resolve()));
 });
 router.get('/resumes',async(_req,res)=>res.json(await deps.resumes?.list()||[]));
 router.post('/resumes/:id/reuse',async(req,res)=>{
  cleanup();if(busy)throw new AppError(409,'BUSY','Another resume is processing. Please wait.');
  if(!z.string().uuid().safeParse(req.params.id).success)throw new AppError(404,'RESUME_NOT_FOUND','Saved resume not found.');
  busy=true;
  try{
   const settings=await store.get();if(pending.size>=settings.workflow.maxPendingDrafts)throw new AppError(429,'DRAFT_LIMIT','Too many pending drafts. Complete an analysis or wait for the drafts to expire.');
   const document=await deps.resumes?.find(String(req.params.id));if(!document||!deps.pdfs)throw new AppError(404,'RESUME_NOT_FOUND','Saved resume not found.');
   await deps.pdfs.storedPath(document.pdfKey);
   const text=normalizeResume(document.parsedResumeText);if(!text)throw new AppError(422,'EMPTY_RESUME','This saved resume has no parsed text. Upload the PDF again.');
   const parsed:ParsedResume={text,metadata:document.parserMetadata as unknown as ParsedResume['metadata']||{provider:'Saved extraction (metadata unavailable)',jobId:'',pageCount:0}};
   const previous=document.analyses[0];const token=randomUUID();pending.set(token,{parsed,filename:document.filename,pdfKey:document.pdfKey,resumeId:document.id,expires:Date.now()+settings.workflow.draftExpiryMinutes*60*1000});
   res.json({token,filename:document.filename,resumeId:document.id,parsedResume:parsed,suggestedEvidence:suggestProfessionalEvidence(text),candidate:previous?.candidate||null,expiresInMinutes:settings.workflow.draftExpiryMinutes});
  }finally{busy=false;}
 });
 router.post('/resumes/parse',async(req,res)=>{
  cleanup();if(busy)throw new AppError(409,'BUSY','Another resume is processing. Please wait.');
  busy=true;
  try{
   const settings=await store.get();
   if(pending.size>=settings.workflow.maxPendingDrafts)throw new AppError(429,'DRAFT_LIMIT','Too many pending drafts. Wait for them to expire or complete an analysis.');
   await new Promise<void>((resolve,reject)=>upload(settings).single('resume')(req,res,error=>error?reject(error):resolve()));
   const file=req.file;
   if(!file?.buffer.length)throw new AppError(400,'EMPTY_PDF','Choose a non-empty PDF.');
   if(file.buffer.subarray(0,5).toString()!=='%PDF-')throw new AppError(400,'INVALID_PDF','This file does not contain a valid PDF header.');
   const parsed=await deps.parse(file.buffer,settings);parsed.text=normalizeResume(parsed.text);
   if(!parsed.text)throw new AppError(422,'EMPTY_RESUME','No text was extracted from this PDF.');
   if(parsed.text.length>200000)throw new AppError(413,'RESUME_TOO_LONG','The extracted resume is too large. Use a shorter resume.');
   const filename=file.originalname.replace(/^.*[\\/]/,'').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,160)||'resume.pdf';
   const pdfKey=await deps.pdfs?.stage(file.buffer);let resumeId:string|undefined;
   if(deps.resumes){
    if(!pdfKey||!deps.pdfs)throw new AppError(500,'PDF_STORAGE_ERROR','Local resume storage is unavailable.');
    try{await deps.pdfs.retain(pdfKey);const document=await deps.resumes.create({filename,pdfKey,parsedResume:parsed});resumeId=document.id;}
    catch(error){await deps.pdfs.discardSaved(pdfKey);throw error;}
    finally{await deps.pdfs.discardDraft(pdfKey).catch(()=>console.error('Could not remove parsed PDF draft.'));}
   }
   const token=randomUUID();pending.set(token,{parsed,filename,pdfKey,resumeId,expires:Date.now()+settings.workflow.draftExpiryMinutes*60*1000});
   res.json({token,filename,resumeId,parsedResume:parsed,suggestedEvidence:suggestProfessionalEvidence(parsed.text),expiresInMinutes:settings.workflow.draftExpiryMinutes});
  }finally{if(req.file)req.file.buffer=Buffer.alloc(0);busy=false;}
 });
 const analysisBody=z.object({token:z.string().uuid(),evidence:z.string().trim().min(20).max(30000),reviewed:z.literal(true),candidateId:z.string().uuid().optional(),name:z.string().trim().min(1).max(120)}).strict();
 router.post('/resumes/analyze',async(req,res)=>{
  if(typeof req.body?.name!=='string'||!req.body.name.trim()||req.body.name.trim().length>120)throw new AppError(400,'DISPLAY_NAME_REQUIRED','Enter a candidate display name between 1 and 120 characters.');
  const body=analysisBody.safeParse(req.body);if(!body.success)throw new AppError(400,'REVIEW_REQUIRED','Review professional evidence (20–30,000 characters) and confirm that personal and sensitive information is removed.');
  cleanup();const draft=pending.get(body.data.token);if(!draft)throw new AppError(410,'DRAFT_EXPIRED','This resume draft expired. Upload the PDF again.');
  if(busy)throw new AppError(409,'BUSY','Another resume is processing. Please wait.');
  try{assertProfessionalEvidence(body.data.evidence);}catch(error){throw new AppError(400,'PERSONAL_INFORMATION',(error as Error).message);}
  busy=true;
  try{
   const settings=await store.get();
   const config=resolveConfig(validateConfig(settings.screeningConfig),new Date(),settings.workflow.timezone);
   if(body.data.candidateId&&!await deps.candidates.find(body.data.candidateId))throw new AppError(404,'NOT_FOUND','Candidate not found.');
   if(!(await deps.health(settings)).online)throw new AppError(503,'DECIDER_OFFLINE','Strands Decider is offline. Start your separately managed local server.');
   const {screening,latencyMs}=await deps.decide(body.data.evidence,config,settings);
   if(draft.pdfKey&&!draft.resumeId)await deps.pdfs!.retain(draft.pdfKey);
   let saved:Awaited<ReturnType<Dependencies['analyses']['save']>>;
   try{saved=await deps.analyses.save({candidateId:body.data.candidateId,name:body.data.name,resumeFilename:draft.filename,resumePdfKey:draft.pdfKey,resumeDocumentId:draft.resumeId,parsedResume:draft.parsed,evidence:body.data.evidence,screening,config,latencyMs});}
   catch(error){if(draft.pdfKey&&!draft.resumeId)await deps.pdfs!.discardSaved(draft.pdfKey);throw error;}
   const {candidate,analysis}=saved;
   if(draft.pdfKey&&!draft.resumeId)await deps.pdfs!.discardDraft(draft.pdfKey).catch(()=>console.error('Could not remove completed PDF draft.'));
   pending.delete(body.data.token);
   res.status(201).json({candidate,parsedResume:draft.parsed,screening,analysis,metadata:{analysisId:analysis.id,analyzedAt:analysis.analyzedAt,deciderLatencyMs:latencyMs}});
  }finally{busy=false;}
 });
 return router;
}
