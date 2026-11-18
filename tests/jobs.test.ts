import {modelRepository} from '../server/repositories/modelRepository';
import {modelService} from '../server/services/modelService';
import {modelTemplate} from '../shared/models';
import {it,expect,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {PrismaClient} from '@prisma/client';
import {JobQueue} from '../server/repositories/jobQueue';
import {jobService} from '../server/services/jobService';
import {analysisRepository} from '../server/repositories/analysisRepository';
import {candidateRepository} from '../server/repositories/candidateRepository';
import {resumeRepository} from '../server/repositories/resumeRepository';
import {resumeFileStore} from '../server/services/resumeFileService';
import {createApp} from '../server/app';
import type {Dependencies} from '../server/routes/api';

it('persists lifecycle, serializes claims, fences expired workers and bounds retries',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'queue-test-'));const file=path.join(dir,'queue.sqlite');
 let queue=new JobQueue(file);const other=new JobQueue(file);const sql=new DatabaseSync(file);
 try{
  const first=queue.enqueue('parse',{secret:'private'},'one');
  expect(queue.enqueue('parse',{},'one').id).toBe(first.id);
  expect(first.status).toBe('queued');expect(first).not.toHaveProperty('payload');
  const claim=queue.claim()!;queue.enqueue('analyze',{});
  expect(other.claim()).toBeNull();expect(queue.get(claim.id).attempts).toBe(1);
  queue.update(claim.id,claim.owner,75,'Saving',{parsed:'checkpoint'});
  expect(queue.get(claim.id)).toMatchObject({status:'processing',progress:75});
  sql.prepare('UPDATE jobs SET leaseUntil=0 WHERE id=?').run(claim.id);
  other.claim();expect(queue.get(claim.id).status).toBe('failed');
  expect(()=>queue.update(claim.id,claim.owner,90,'Stale')).toThrow();
  expect(()=>queue.retry(claim.id)).toThrow('one minute');
  sql.prepare('UPDATE jobs SET retryAt=0 WHERE id=?').run(claim.id);
  queue.retry(claim.id);
  // Finish the other job before resuming the interrupted job.
  const active=sql.prepare("SELECT id,owner FROM jobs WHERE status='processing'").get() as {id:string;owner:string};
  other.finish(active.id,active.owner,{});
  queue.close();queue=new JobQueue(file);
  const retry=queue.claim()!;expect(retry.checkpoint).toEqual({parsed:'checkpoint'});
  queue.finish(retry.id,retry.owner,{saved:true});
  expect(queue.get(first.id)).toMatchObject({status:'completed',progress:100,attempts:2,result:{saved:true}});
  expect(()=>queue.retry(first.id)).toThrow('Only failed');
  const limit=queue.enqueue('parse',{});const last=queue.claim()!;queue.fail(last.id,last.owner,new Error('sensitive resume content'));
  expect(queue.get(limit.id).error?.message).not.toContain('sensitive');
  sql.prepare('UPDATE jobs SET attempts=3,retryAt=0 WHERE id=?').run(limit.id);
  expect(()=>queue.retry(limit.id)).toThrow('retry limit');
 }finally{sql.close();queue.close();other.close();await rm(dir,{recursive:true,force:true});}
});

it('runs queued upload and reviewed analysis across restart, with idempotent saves and checkpointed retries',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'job-flow-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/data.db`});
 const file=path.join(dir,'queue.sqlite');let queue=new JobQueue(file);const sql=new DatabaseSync(file);
 try{
  for(const migration of ['20261004000000_init','20261004010000_resume_pdf','20261004020000_saved_resumes']){const text=await readFile(`prisma/migrations/${migration}/migration.sql`,'utf8');for(const statement of text.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);}
  const deps:Dependencies={pdfs:resumeFileStore(path.join(dir,'resumes')),resumes:resumeRepository(db),candidates:candidateRepository(db),analyses:analysisRepository(db),parserConfigured:()=>true,health:async()=>({online:true}),parse:vi.fn(async()=>({text:'# Experience\nBuilt and shipped API services.',metadata:{provider:'test',jobId:'provider-job',pageCount:1}})),decide:vi.fn(async()=>({screening:{model:'test',answers:{}},latencyMs:1}))};
  let jobs=jobService(queue,deps);deps.jobs=jobs;let app=createApp(deps);
  const upload=()=>request(app).post('/api/resumes/parse').set('Idempotency-Key','upload-1').attach('resume',Buffer.from('%PDF-1.7\nsynthetic'),{filename:'test.pdf',contentType:'application/pdf'});
  const accepted=await upload();expect(accepted.status).toBe(202);expect(accepted.body.status).toBe('queued');expect(deps.parse).not.toHaveBeenCalled();
  expect((await upload()).body.id).toBe(accepted.body.id);
  // A fresh worker picks up the upload committed by the previous process.
  queue.close();queue=new JobQueue(file);jobs=jobService(queue,deps);deps.jobs=jobs;app=createApp(deps);
  await jobs.runOnce();const parsed=(await request(app).get(`/api/jobs/${accepted.body.id}`)).body;
  expect(parsed.status).toBe('completed');expect(await db.resumeDocument.count()).toBe(1);
  queue.close();queue=new JobQueue(file);jobs=jobService(queue,deps);deps.jobs=jobs;app=createApp(deps);
  const connections=modelRepository(path.join(dir,'connections.json'));const selectedProfile={...modelTemplate('groq'),enabled:true};await connections.save(selectedProfile,'private-job-key');await connections.select('groq');deps.models=modelService(connections);app=createApp(deps);
  const body={token:parsed.result.token,name:'Test',evidence:'Built and shipped API services.',reviewed:true};
  expect((await request(app).post('/api/resumes/analyze').send({...body,reviewed:false})).status).toBe(400);
  const analysis=await request(app).post('/api/resumes/analyze').send(body);expect(analysis.status).toBe(202);
  expect((await request(app).post('/api/resumes/analyze').send(body)).body.id).toBe(analysis.body.id);
  const storedPayload=JSON.parse((sql.prepare('SELECT payload FROM jobs WHERE id=?').get(analysis.body.id) as {payload:string}).payload);expect(storedPayload.settings.inference.model).toBe(selectedProfile.model);expect(JSON.stringify(storedPayload)).not.toContain('private-job-key');await connections.select('local');
  const save=deps.analyses.save;deps.analyses.save=vi.fn().mockRejectedValueOnce(new Error('storage unavailable')).mockImplementation(save);
  await jobs.runOnce();expect(queue.get(analysis.body.id).status).toBe('failed');expect(await db.candidate.count()).toBe(0);
  sql.prepare('UPDATE jobs SET retryAt=0 WHERE id=?').run(analysis.body.id);
  expect((await request(app).post(`/api/jobs/${analysis.body.id}/retry`)).status).toBe(202);
  vi.spyOn(queue,'finish').mockImplementationOnce(()=>{throw new Error('Process interrupted after save');});
  await jobs.runOnce();expect(queue.get(analysis.body.id).status).toBe('failed');expect(await db.resumeAnalysis.count()).toBe(1);
  sql.prepare('UPDATE jobs SET retryAt=0 WHERE id=?').run(analysis.body.id);
  queue.retry(analysis.body.id);await jobs.runOnce();const completed=queue.get(analysis.body.id);
  expect(completed.status).toBe('completed');expect(deps.decide).toHaveBeenCalledTimes(1);expect(vi.mocked(deps.decide).mock.calls[0][2]?.inference).toMatchObject({provider:'groq',model:selectedProfile.model});expect(await db.resumeAnalysis.count()).toBe(1);
  expect(await db.candidate.count()).toBe(1);
  expect((await request(app).post('/api/resumes/analyze').send(body)).body.id).toBe(completed.id);
  expect(await db.resumeAnalysis.count()).toBe(1);expect((await readdir(path.join(dir,'resumes'))).filter(n=>n.endsWith('.pdf'))).toHaveLength(1);
  expect((await request(app).get('/api/jobs/missing')).status).toBe(404);
 }finally{sql.close();queue.close();await db.$disconnect();await rm(dir,{recursive:true,force:true});}
});
