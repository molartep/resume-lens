import {afterEach,it,expect,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {renderToStaticMarkup} from 'react-dom/server';
import {analysisRepository} from '../server/repositories/analysisRepository';
import {candidateRepository} from '../server/repositories/candidateRepository';
import {templateRepository} from '../server/repositories/templateRepository';
import {createApp} from '../server/app';
import type {Dependencies} from '../server/routes/api';
import {defaultConfiguration,configurationSchemaVersion} from '../shared/screeningConfiguration';
import {analysisHref,analysisIdFromHash,type AnalysisHistoryPage} from '../shared/analysisHistory';
import {AnalysisHistory,AnalysisHistoryTable} from '../client/src/AnalysisHistory';
import {CandidateWorkspace} from '../client/src/CandidateWorkspace';
import type {ScreeningConfig,Candidate,Analysis} from '../shared/types';
const cleanups:(()=>Promise<void>)[]=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
const dimensions:ScreeningConfig={evidence:{type:'noul',label:'Evidence',order:10,instructions:'Is professional delivery documented?'}};
async function setup(){const dir=await mkdtemp(path.join(tmpdir(),'analysis-history-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/db.sqlite`});cleanups.push(async()=>{await db.$disconnect();await rm(dir,{recursive:true,force:true});});
 for(const migration of (await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort())for(const sql of (await readFile(`prisma/migrations/${migration}/migration.sql`,'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(sql);
 const analyses=analysisRepository(db),templates=templateRepository(db);const template=await templates.create({name:'Original screening',description:'Synthetic example',configuration:{dimensions},configurationSchemaVersion});
 const input={name:'Synthetic A',resumeFilename:'original.pdf',parsedResume:{text:'Private extracted resume content',metadata:{provider:'mock',jobId:'mock',pageCount:1}},evidence:'Private reviewed evidence',screening:{model:'Original model',answers:{}},config:dimensions,latencyMs:123};
 const provenance={templateId:template.id,templateName:template.name,templateRevision:1,appliedAt:'2026-11-25T10:00:00Z',modifiedAfterApplication:false};
 const first=await analyses.save({...input,executionConfiguration:{configuration:defaultConfiguration(dimensions),configurationSchemaVersion,provenance}});
 const updated=await templates.update(template.id,{name:'Renamed screening',description:'Synthetic example',configuration:{dimensions},configurationSchemaVersion,expectedRevision:1});
 const second=await analyses.save({...input,candidateId:first.candidate.id,resumeFilename:'revised.pdf',screening:{model:'New model',answers:{}},executionConfiguration:{configuration:defaultConfiguration(dimensions),configurationSchemaVersion,provenance:{...provenance,templateName:updated.name,templateRevision:updated.revision}}});
 const legacy=await analyses.save({...input,name:'Synthetic legacy',resumeFilename:'legacy.pdf'});
 for(const [id,date] of [[legacy.analysis.id,'2026-11-23T10:00:00Z'],[first.analysis.id,'2026-11-24T10:00:00Z'],[second.analysis.id,'2026-11-25T10:00:00Z']])await db.resumeAnalysis.update({where:{id},data:{analyzedAt:new Date(date)}});
 const deps:Dependencies={analyses,templates,candidates:candidateRepository(db),parserConfigured:()=>true,health:vi.fn(async()=>({online:true})),parse:vi.fn(async()=>{throw new Error('Unexpected parsing');}),decide:vi.fn(async()=>{throw new Error('Unexpected inference');})};
 return {app:createApp(deps),deps,db,analyses,templates,template,first,second,legacy};
}
it('lists every saved analysis across candidates in stable newest-first pages with metadata only',async()=>{
 const {app,deps,first,second,legacy}=await setup();const firstPage=await request(app).get('/api/analyses?page=1&pageSize=2');expect(firstPage.status).toBe(200);expect(firstPage.body).toMatchObject({total:3,page:1,pageSize:2});expect(firstPage.body.items.map((a:{id:string})=>a.id)).toEqual([second.analysis.id,first.analysis.id]);expect(firstPage.body.items.map((a:{candidateId:string})=>a.candidateId)).toEqual([first.candidate.id,first.candidate.id]);expect(firstPage.body.items[1]).toMatchObject({candidateName:'Synthetic A',resumeFilename:'original.pdf',model:'Original model',template:{templateName:'Original screening',templateRevision:1}});
 const next=await request(app).get('/api/analyses?page=2&pageSize=2');expect(next.status).toBe(200);expect(next.body.items).toHaveLength(1);expect(next.body.items[0]).toMatchObject({id:legacy.analysis.id,template:null});expect((await request(app).get('/api/analyses?page=3&pageSize=2')).body.items).toEqual([]);
 expect(JSON.stringify(firstPage.body)).not.toContain('Private');expect(firstPage.body.items[0]).not.toHaveProperty('screeningResults');expect(firstPage.body.items[0]).not.toHaveProperty('executionConfigurationSnapshot');expect(deps.decide).not.toHaveBeenCalled();expect(deps.parse).not.toHaveBeenCalled();
});
it('retains original template names/revisions after rename and deletion and exposes latest provenance on candidate rows',async()=>{
 const {app,templates,template,first,second}=await setup();await templates.remove(template.id);const all=(await request(app).get('/api/analyses')).body;expect(all.items.find((a:{id:string})=>a.id===first.analysis.id).template).toMatchObject({templateName:'Original screening',templateRevision:1});expect(all.items.find((a:{id:string})=>a.id===second.analysis.id).template).toMatchObject({templateName:'Renamed screening',templateRevision:2});
 const candidates=(await request(app).get('/api/candidates')).body;expect(candidates.find((c:{id:string})=>c.id===first.candidate.id).analyses[0].executionConfigurationSnapshot.provenance).toMatchObject({templateName:'Renamed screening',templateRevision:2});
});
it('retrieves the exact older analysis directly instead of the latest result for that candidate',async()=>{
 const {app,first,second}=await setup();const older=await request(app).get(`/api/analyses/${first.analysis.id}`);expect(older.status).toBe(200);expect(older.body.analysis.id).toBe(first.analysis.id);expect(older.body.analysis.id).not.toBe(second.analysis.id);expect(older.body.analysis.resumeFilename).toBe('original.pdf');expect(older.body.candidate.id).toBe(first.candidate.id);
 expect((await request(app).get('/api/analyses/not-an-id')).status).toBe(404);expect((await request(app).get(`/api/analyses/${crypto.randomUUID()}`)).status).toBe(404);
});
it.each(['page=0','page=-1','page=1.2','page=bad','pageSize=0','pageSize=101','pageSize=bad','page=1&page=2'])('rejects invalid history pagination: %s',async query=>{const {app}=await setup();const response=await request(app).get(`/api/analyses?${query}`);expect(response.status).toBe(400);expect(response.body.error.code).toBe('INVALID_PAGINATION');});
it('provides an empty page for installations without saved analyses',async()=>{const {app,db}=await setup();await db.resumeAnalysis.deleteMany();const r=await request(app).get('/api/analyses');expect(r.status).toBe(200);expect(r.body).toEqual({items:[],total:0,page:1,pageSize:25});});
it('renders Screening Template in candidate rows and distinguishes legacy records',()=>{
 const analysis={id:'old',analyzedAt:'2026-11-24T10:00:00Z',screeningResults:{model:'Mock',answers:{primary_talent_profile:{type:'choice',choice:'irrelevant_profile'}}},executionConfigurationSnapshot:{provenance:{templateId:'template',templateName:'Saved template',templateRevision:3}}} as unknown as Analysis;
 const candidate:Candidate={id:'candidate',name:'Synthetic A',resumeFilename:'test.pdf',createdAt:'2026-11-24T10:00:00Z',updatedAt:'2026-11-24T10:00:00Z',analyses:[analysis]};
 const html=renderToStaticMarkup(<CandidateWorkspace candidates={[candidate]} busy={false} onNew={()=>{}} onOpen={()=>{}}/>);expect(html).toContain('Screening Template');expect(html).toContain('Saved template');expect(html).toContain('Revision 3');expect(html).not.toContain('Primary talent profile');expect(html).not.toContain('irrelevant_profile');
 const legacy=renderToStaticMarkup(<CandidateWorkspace candidates={[{...candidate,analyses:[{...analysis,executionConfigurationSnapshot:null}]}]} busy={false} onNew={()=>{}} onOpen={()=>{}}/>);expect(legacy).toContain('Template not recorded');
});
it('renders distinct durable links for multiple analyses of one candidate and handles direct-link parsing',()=>{
 const ids=[crypto.randomUUID(),crypto.randomUUID()];const data:AnalysisHistoryPage={page:1,pageSize:25,total:2,items:ids.map((id,i)=>({id,candidateId:'one-candidate',candidateName:'Synthetic A',resumeFilename:`resume-${i}.pdf`,analyzedAt:'2026-11-25T10:00:00Z',template:i===0?{templateId:'template',templateName:'Original screening',templateRevision:1}:null,model:'Mock model',provider:null}))};
 const html=renderToStaticMarkup(<AnalysisHistoryTable data={data} onOpen={()=>{}}/>);expect(html).toContain(`href="${analysisHref(ids[0])}"`);expect(html).toContain(`href="${analysisHref(ids[1])}"`);expect(html).toContain('Template not recorded');expect(html).toContain('Evaluation model');expect(html).toContain('View analysis');for(const id of ids)expect(analysisIdFromHash(analysisHref(id))).toBe(id);expect(analysisIdFromHash('#analysis-history')).toBeNull();expect(analysisIdFromHash('#analyses/%invalid')).toBeNull();
 expect(renderToStaticMarkup(<AnalysisHistory onOpen={()=>{}}/>)).toContain('Loading analysis history');
});
