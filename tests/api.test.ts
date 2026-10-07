import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {resumeFileStore} from '../server/services/resumeFileService';
import {createApp} from '../server/app';
import type {Dependencies} from '../server/routes/api';
import {screeningConfig} from '../config/screening.config';
import type {Screening} from '../shared/types';
function setup(){
 const deps:Dependencies={candidates:{list:vi.fn().mockResolvedValue([]),find:vi.fn().mockResolvedValue(null),health:vi.fn().mockResolvedValue(true)},analyses:{list:vi.fn().mockResolvedValue([]),save:vi.fn().mockImplementation(async input=>({candidate:{id:'test'},analysis:{id:'analysis',screeningConfigSnapshot:input.config,analyzedAt:new Date()}}))},parse:vi.fn().mockResolvedValue({text:'# Experience\nBuilt APIs and mentored engineers.',metadata:{provider:'mock',jobId:'test',pageCount:1}}),decide:vi.fn().mockResolvedValue({screening:{model:'mock',answers:{}} as Screening,latencyMs:123}),parserConfigured:()=>true,health:vi.fn().mockResolvedValue({online:true})};return {app:createApp(deps),deps};
}
describe('application workflow with mocked external services',()=>{
 it('parses, reviews, sends one request, saves config and returns results',async()=>{const {app,deps}=setup();const parsed=await request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7\nMock'),{filename:'resume.pdf',contentType:'application/pdf'});expect(parsed.status).toBe(200);expect(deps.decide).not.toHaveBeenCalled();const analyzed=await request(app).post('/api/resumes/analyze').send({token:parsed.body.token,evidence:'Built APIs and mentored engineers.',reviewed:true,name:'Local label'});expect(analyzed.status).toBe(201);expect(deps.decide).toHaveBeenCalledTimes(1);const [text,config]=vi.mocked(deps.decide).mock.calls[0];expect(text).not.toContain('Local label');expect(Object.keys(config)).toEqual(Object.keys(screeningConfig));expect(JSON.stringify(config)).not.toContain('{{CURRENT_DATE}}');expect(deps.analyses.save).toHaveBeenCalledTimes(1);});
 it.each([undefined,'','   '])('requires a non-empty display name (%s)',async name=>{const {app,deps}=setup();const r=await request(app).post('/api/resumes/analyze').send({token:'00000000-0000-4000-8000-000000000000',evidence:'Built APIs and mentored engineers.',reviewed:true,name});expect(r.status).toBe(400);expect(r.body.error.code).toBe('DISPLAY_NAME_REQUIRED');expect(deps.decide).not.toHaveBeenCalled();expect(deps.analyses.save).not.toHaveBeenCalled();});
 it('requires evidence review before Decider',async()=>{const {app,deps}=setup();const r=await request(app).post('/api/resumes/analyze').send({evidence:'Built APIs',reviewed:false});expect(r.status).toBe(400);expect(deps.decide).not.toHaveBeenCalled();});
 it.each([['resume.txt','text/plain','%PDF-fake'],['resume.pdf','application/pdf','not PDF'],['empty.pdf','application/pdf','']])('rejects invalid upload %s',async(filename,contentType,body)=>{const {app,deps}=setup();const r=await request(app).post('/api/resumes/parse').attach('resume',Buffer.from(body),{filename,contentType});expect(r.status).toBe(400);expect(deps.parse).not.toHaveBeenCalled();});
 it('rejects oversized PDFs before parsing',async()=>{const {app,deps}=setup();const r=await request(app).post('/api/resumes/parse').attach('resume',Buffer.alloc(10*1024*1024+1),{filename:'large.pdf',contentType:'application/pdf'});expect(r.status).toBe(400);expect(r.body.error.message).toContain('upload limit');expect(deps.parse).not.toHaveBeenCalled();});
 it('blocks cross-origin uploads',async()=>{const {app,deps}=setup();const r=await request(app).post('/api/resumes/parse').set('Origin','https://example.com');expect(r.status).toBe(403);expect(deps.parse).not.toHaveBeenCalled();});
 it('keeps failed analyses unsaved and permits retry',async()=>{const {app,deps}=setup();vi.mocked(deps.health).mockResolvedValue({online:false});const parsed=await request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7'),{filename:'resume.pdf',contentType:'application/pdf'});const r=await request(app).post('/api/resumes/analyze').send({token:parsed.body.token,evidence:'Built APIs and mentored engineers.',reviewed:true,name:'Test candidate'});expect(r.status).toBe(503);expect(deps.analyses.save).not.toHaveBeenCalled();});
 it('shows all system statuses',async()=>{const {app}=setup();const r=await request(app).get('/api/health');expect(r.body).toMatchObject({llamaIndex:'Configured',decider:'Online',database:'Connected',config:'Valid'});});
});

it('removes retained PDFs after database failure and allows the draft to be retried',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-api-pdf-'));
 try{const {app,deps}=setup();deps.pdfs=resumeFileStore(dir);vi.mocked(deps.analyses.save).mockRejectedValueOnce(new Error('Database failure'));
 const parsed=await request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7\nMock'),{filename:'original.pdf',contentType:'application/pdf'});expect(parsed.status).toBe(200);
 const body={token:parsed.body.token,evidence:'Built APIs and mentored engineers.',reviewed:true,name:'Test'};
 expect((await request(app).post('/api/resumes/analyze').send(body)).status).toBe(500);expect(await readdir(dir)).toEqual(['.drafts']);expect(await readdir(path.join(dir,'.drafts'))).toHaveLength(1);
 expect((await request(app).post('/api/resumes/analyze').send(body)).status).toBe(201);expect((await readdir(dir)).filter(x=>x.endsWith('.pdf'))).toHaveLength(1);expect(await readdir(path.join(dir,'.drafts'))).toEqual([]);
 expect(vi.mocked(deps.analyses.save).mock.calls[1][0].resumeFilename).toBe('original.pdf');expect(vi.mocked(deps.analyses.save).mock.calls[1][0].resumePdfKey).toMatch(/\.pdf$/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
