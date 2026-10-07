import {it,expect,vi} from 'vitest';
import request from 'supertest';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app';
import type {Dependencies} from '../server/routes/api';
import {candidateRepository} from '../server/repositories/candidateRepository';
import {analysisRepository} from '../server/repositories/analysisRepository';
import {resumeRepository} from '../server/repositories/resumeRepository';
import {resumeFileStore} from '../server/services/resumeFileService';
const migrations=['20261004000000_init','20261004010000_resume_pdf','20261004020000_saved_resumes'];
async function migrate(db:PrismaClient,names=migrations){for(const name of names){const sql=await readFile(`prisma/migrations/${name}/migration.sql`,'utf8');for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);}}
async function fixture(run:(ctx:{dir:string;db:PrismaClient;deps:Dependencies;app:ReturnType<typeof createApp>})=>Promise<void>){
 const dir=await mkdtemp(path.join(tmpdir(),'saved-resumes-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/test.db`});
 try{await migrate(db);const deps:Dependencies={pdfs:resumeFileStore(path.join(dir,'resumes')),resumes:resumeRepository(db),candidates:candidateRepository(db),analyses:analysisRepository(db),parserConfigured:()=>true,health:async()=>({online:true}),parse:vi.fn().mockResolvedValue({text:'# Experience\nBuilt and shipped API services.',metadata:{provider:'mock',jobId:'saved-test',pageCount:1}}),decide:vi.fn().mockImplementation(async(_text,config)=>({screening:{model:'mock',answers:Object.fromEntries(Object.keys(config).map(id=>[id,{type:'noul',noul:.7}]))},latencyMs:10}))};await run({dir,db,deps,app:createApp(deps)});}
 finally{await db.$disconnect();await rm(dir,{recursive:true,force:true});}
}
const upload=(app:ReturnType<typeof createApp>)=>request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7\nSaved fixture'),{filename:'saved.pdf',contentType:'application/pdf'});
const analyze=(app:ReturnType<typeof createApp>,token:string,candidateId?:string)=>request(app).post('/api/resumes/analyze').send({token,candidateId,name:'Saved candidate',evidence:'Built and shipped API services.',reviewed:true});
it('saves PDFs and extraction before analysis and reopens them without parsing again',async()=>fixture(async({dir,db,deps,app})=>{
 const parsed=await upload(app);expect(parsed.status).toBe(200);expect(parsed.body.resumeId).toBeTruthy();expect(await db.candidate.count()).toBe(0);expect(await db.resumeAnalysis.count()).toBe(0);
 const list=await request(app).get('/api/resumes');expect(list.body).toHaveLength(1);expect(list.body[0]).toMatchObject({id:parsed.body.resumeId,filename:'saved.pdf',candidate:null});expect(list.body[0].parsedResumeText).toBeUndefined();
 const reopened=createApp({...deps,pdfs:resumeFileStore(path.join(dir,'resumes')),resumes:resumeRepository(db)});
 const reused=await request(reopened).post(`/api/resumes/${parsed.body.resumeId}/reuse`);expect(reused.status).toBe(200);expect(reused.body.parsedResume).toEqual(parsed.body.parsedResume);expect(reused.body.token).not.toBe(parsed.body.token);expect(deps.parse).toHaveBeenCalledTimes(1);
 expect((await request(reopened).post('/api/resumes/analyze').send({token:reused.body.token,name:'Test',evidence:'Built and shipped API services.',reviewed:false})).status).toBe(400);
 expect((await analyze(reopened,reused.body.token)).status).toBe(201);expect(deps.parse).toHaveBeenCalledTimes(1);expect(await db.resumeDocument.count()).toBe(1);expect((await readdir(path.join(dir,'resumes'))).filter(f=>f.endsWith('.pdf'))).toHaveLength(1);
}));
it('reuses the candidate history and original PDF while applying current screening configuration',async()=>fixture(async({db,deps,app})=>{
 const original={mentoring:{label:'Mentoring',type:'noul',order:10,instructions:'Does the resume show mentoring?'}};
 await request(app).put('/api/config').send(original);const parsed=await upload(app);const first=await analyze(app,parsed.body.token);expect(first.status).toBe(201);
 const edited={engineering:{label:'Engineering',type:'noul',order:10,instructions:'Does the resume show shipped engineering work?'}};expect((await request(app).put('/api/config').send(edited)).status).toBe(200);
 const reused=await request(app).post(`/api/resumes/${parsed.body.resumeId}/reuse`);expect(reused.body.candidate.id).toBe(first.body.candidate.id);expect(reused.body.suggestedEvidence).toBe(parsed.body.parsedResume.text);expect(reused.body.suggestedEvidence).not.toBe(first.body.analysis.screeningResumeText);
 const second=await analyze(app,reused.body.token,reused.body.candidate.id);expect(second.status).toBe(201);expect(second.body.analysis.screeningConfigSnapshot).toEqual(edited);expect(second.body.analysis.resumePdfKey).toBe(first.body.analysis.resumePdfKey);expect(second.body.analysis.resumeDocumentId).toBe(first.body.analysis.resumeDocumentId);
 const list=await request(app).get('/api/resumes');expect(list.body).toHaveLength(1);expect(list.body[0].candidate.name).toBe('Saved candidate');expect(await db.candidate.count()).toBe(1);expect(await db.resumeAnalysis.count()).toBe(2);expect((await deps.analyses.find!(first.body.analysis.id))?.screeningConfigSnapshot).toEqual(original);expect(deps.parse).toHaveBeenCalledTimes(1);
}));
it('keeps a saved PDF and reusable extraction after an analysis database failure',async()=>fixture(async({dir,deps,app})=>{
 const parsed=await upload(app);const save=deps.analyses.save;deps.analyses.save=vi.fn().mockRejectedValueOnce(new Error('Database failure')).mockImplementation(save);
 expect((await analyze(app,parsed.body.token)).status).toBe(500);expect((await request(app).get('/api/resumes')).body).toHaveLength(1);expect((await readdir(path.join(dir,'resumes'))).filter(f=>f.endsWith('.pdf'))).toHaveLength(1);
 expect((await analyze(app,parsed.body.token)).status).toBe(201);
}));
it('rejects missing PDFs and unknown documents without calling external services',async()=>fixture(async({deps,app})=>{
 const parsed=await upload(app);const document=await deps.resumes!.find(parsed.body.resumeId);await deps.pdfs!.discardSaved(document!.pdfKey);
 expect((await request(app).post(`/api/resumes/${parsed.body.resumeId}/reuse`)).status).toBe(404);expect((await request(app).post(`/api/resumes/${randomUUID()}/reuse`)).status).toBe(404);expect((await request(app).post('/api/resumes/not-an-id/reuse')).status).toBe(404);expect(deps.parse).toHaveBeenCalledTimes(1);expect(deps.decide).not.toHaveBeenCalled();
}));
it('expired review tokens do not delete persisted PDFs or their extraction',async()=>fixture(async({dir,app})=>{
 const parsed=await upload(app);const now=Date.now();const clock=vi.spyOn(Date,'now').mockReturnValue(now+21*60*1000);
 try{expect((await analyze(app,parsed.body.token)).status).toBe(410);expect((await request(app).post(`/api/resumes/${parsed.body.resumeId}/reuse`)).status).toBe(200);expect((await readdir(path.join(dir,'resumes'))).filter(f=>f.endsWith('.pdf'))).toHaveLength(1);}finally{clock.mockRestore();}
}));
it('rolls back PDF retention when saving its parsed document fails',async()=>fixture(async({dir,deps,app})=>{
 deps.resumes!.create=vi.fn().mockRejectedValue(new Error('Document database failure'));expect((await upload(app)).status).toBe(500);expect((await readdir(path.join(dir,'resumes'))).filter(f=>f.endsWith('.pdf'))).toHaveLength(0);expect(await readdir(path.join(dir,'resumes','.drafts'))).toEqual([]);expect((await request(app).get('/api/resumes')).body).toEqual([]);
}));
it('migrates older saved PDFs into the picker without duplicating shared files',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-migration-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/test.db`});
 try{await migrate(db,migrations.slice(0,2));const candidate=randomUUID();const key=`${randomUUID()}.pdf`;const now=Date.now();
 await db.$executeRaw`INSERT INTO Candidate (id,name,resumeFilename,createdAt,updatedAt) VALUES (${candidate},'Migration candidate','old.pdf',${now},${now})`;
 for(let i=0;i<2;i++){const id=randomUUID();const text=`Parsed engineering evidence version ${i}`;await db.$executeRaw`INSERT INTO ResumeAnalysis (id,candidateId,resumeFilename,resumePdfKey,parsedResumeText,screeningResumeText,screeningResults,screeningConfigSnapshot,analyzedAt,parserMetadata) VALUES (${id},${candidate},'old.pdf',${key},${text},'Reviewed evidence','{}','{}',${now+i},'{"provider":"mock","jobId":"old","pageCount":1}')`;}
 await migrate(db,[migrations[2]]);const list=await resumeRepository(db).list();expect(list).toHaveLength(1);expect(list[0]).toMatchObject({filename:'old.pdf',candidate:{id:candidate,name:'Migration candidate'}});expect((await resumeRepository(db).find(list[0].id))?.parsedResumeText).toBe('Parsed engineering evidence version 1');expect(await db.resumeAnalysis.count({where:{resumeDocumentId:list[0].id}})).toBe(2);
 }finally{await db.$disconnect();await rm(dir,{recursive:true,force:true});}
});
