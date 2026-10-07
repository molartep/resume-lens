import {it,expect} from 'vitest';
import request from 'supertest';
import {PrismaClient} from '@prisma/client';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {resumeFileStore} from '../server/services/resumeFileService';
import {createApp} from '../server/app';
import {candidateRepository} from '../server/repositories/candidateRepository';
import {analysisRepository} from '../server/repositories/analysisRepository';
import {screeningConfig} from '../config/screening.config';
import type {Dependencies} from '../server/routes/api';
import type {Answer,ScreeningConfig} from '../shared/types';
function mockAnswers(config:ScreeningConfig){return Object.fromEntries(Object.entries(config).map(([id,q]):[string,Answer]=>{
 if(q.type==='noul')return [id,{type:'noul',noul:.5}];
 const keys=q.type==='choice'?Object.keys(q.criteria):q.criteria.map((_,i)=>String(i));const probabilities=Object.fromEntries(keys.map(k=>[k,1/keys.length]));
 return q.type==='choice'?[id,{type:'choice',choice:keys[0],probabilities,confidence:0}]:[id,{type:'score',score:(keys.length-1)/2,probabilities,legend:Object.fromEntries(q.criteria.map((v,i)=>[String(i),v])),confidence:0}];
 }));}
it('completes upload -> reviewed analysis -> SQLite -> reopened history with mocked services',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-workflow-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/test.db`});
 try{
  for(const migration of ['20261004000000_init','20261004010000_resume_pdf','20261004020000_saved_resumes']){const sql=await readFile(`prisma/migrations/${migration}/migration.sql`,'utf8');for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);}
  const pdfs=resumeFileStore(path.join(dir,'resumes'));
  const dependencies:Dependencies={pdfs,candidates:candidateRepository(db),analyses:analysisRepository(db),parserConfigured:()=>true,health:async()=>({online:true}),parse:async()=>({text:'# Experience\nBuilt and shipped API services.',metadata:{provider:'mock',jobId:'mock',pageCount:1}}),decide:async(_evidence,config)=>({screening:{model:'mock',answers:mockAnswers(config)},latencyMs:10})};
  const app=createApp(dependencies);
  const upload=(filename='synthetic.pdf')=>request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7\nsynthetic'),{filename,contentType:'application/pdf'});
  const parsed=await upload();expect(parsed.status).toBe(200);
  const result=await request(app).post('/api/resumes/analyze').send({token:parsed.body.token,evidence:'Built and shipped API services.',reviewed:true,name:'Synthetic test'});expect(result.status).toBe(201);
  const pdfUrl=`/api/analyses/${result.body.analysis.id}/resume`;
  expect(result.body.analysis.resumeFilename).toBe('synthetic.pdf');expect(result.body.analysis.resumePdfKey).toMatch(/^[a-f0-9-]+\.pdf$/);
  const pdf=await request(app).get(pdfUrl);expect(pdf.status).toBe(200);expect(pdf.headers['content-type']).toContain('application/pdf');expect(pdf.body.toString()).toBe('%PDF-1.7\nsynthetic');expect(pdf.headers['content-disposition']).toContain('inline');expect((await request(app).get(`${pdfUrl}?download=1`)).headers['content-disposition']).toContain('attachment');
  const id=result.body.candidate.id;const list=await request(app).get('/api/candidates');expect(list.body[0].analyses[0].id).toBe(result.body.metadata.analysisId);
  const next=await upload('updated-resume.pdf');expect((await request(app).post('/api/resumes/analyze').send({token:next.body.token,evidence:'Built and shipped API services.',reviewed:true,name:'Synthetic test',candidateId:id})).status).toBe(201);
  const history=await request(app).get(`/api/candidates/${id}/analyses`);expect(history.body).toHaveLength(2);expect(history.body[0].screeningConfigSnapshot.primary_talent_profile.criteria).toEqual(screeningConfig.primary_talent_profile.criteria);
  expect((await request(app).get('/api/candidates')).body).toHaveLength(1);
  expect((await request(createApp({...dependencies,pdfs:resumeFileStore(path.join(dir,'resumes'))})).get(pdfUrl)).status).toBe(200);
  expect(history.body.map((a:{resumeFilename:string})=>a.resumeFilename)).toContain('synthetic.pdf');expect(history.body.map((a:{resumeFilename:string})=>a.resumeFilename)).toContain('updated-resume.pdf');
  const legacy=await analysisRepository(db).save({resumeFilename:'legacy.pdf',parsedResume:{text:'Built API services.',metadata:{provider:'mock',jobId:'legacy',pageCount:1}},evidence:'Built API services.',screening:{model:'mock',answers:{}},config:screeningConfig,latencyMs:1});expect((await request(app).get(`/api/analyses/${legacy.analysis.id}/resume`)).status).toBe(404);
  expect((await request(app).get('/api/analyses/not-an-id/resume')).status).toBe(404);
 }finally{await db.$disconnect();await rm(dir,{recursive:true,force:true});}
});
