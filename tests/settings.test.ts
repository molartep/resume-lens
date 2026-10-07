import {it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {defaultSettings,validateSettings,settingsEnvironment} from '../server/services/settingsService';
import {settingsRepository} from '../server/repositories/settingsRepository';
import {createApp} from '../server/app';
import type {Dependencies} from '../server/routes/api';
import {parseResume} from '../server/services/llamaIndexService';
import {resolveConfig} from '../server/services/configService';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('validates tiers, limits, timezone and screening boundaries',()=>{
 const defaults=defaultSettings();expect(validateSettings({...defaults,parser:{...defaults.parser,tier:'cost_effective'}}).parser.tier).toBe('cost_effective');
 for(const value of [{...defaults,parser:{...defaults.parser,tier:'cost-effective'}},{...defaults,workflow:{...defaults.workflow,maxPdfMb:0}},{...defaults,workflow:{...defaults.workflow,timezone:'not-a-timezone'}},{...defaults,screeningConfig:{}}])expect(()=>validateSettings(value)).toThrow();
});
it('persists settings atomically and reloads them without storing secrets',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-settings-'));try{const file=path.join(dir,'settings.json');const store=settingsRepository(file);const settings=await store.get();settings.parser.tier='cost_effective';await store.save(settings);expect((await settingsRepository(file).get()).parser.tier).toBe('cost_effective');await expect(store.save({...settings,parser:{...settings.parser,timeoutMs:-1}})).rejects.toThrow();expect((await store.get()).parser.timeoutMs).toBe(settings.parser.timeoutMs);}finally{await rm(dir,{recursive:true,force:true});}
});
it('does not expose API credentials or credential-bearing URLs',()=>{vi.stubEnv('LLAMAINDEX_API_KEY','private-secret');vi.stubEnv('LLAMAINDEX_API_URL','https://username:password@example.com/?key=secret');const env=settingsEnvironment();expect(env.llamaIndexKeyConfigured).toBe(true);expect(JSON.stringify(env)).not.toMatch(/private-secret|password|key=secret/);});
it('uses configured timezone for date resolution',()=>{const settings=defaultSettings();settings.workflow.timezone='Asia/Tokyo';const config=resolveConfig(settings.screeningConfig,new Date('2026-10-04T23:00:00Z'),settings.workflow.timezone);expect(JSON.stringify(config.years_of_experience)).toContain('2026-10-05');});
it.each(['cost_effective','fast'] as const)('sends configured %s tier, version and cache policy to LlamaIndex',async tier=>{
 vi.stubEnv('LLAMAINDEX_API_KEY','test-key');vi.stubEnv('LLAMAINDEX_API_URL','https://api.cloud.llamaindex.ai');const settings=defaultSettings();settings.parser={...settings.parser,tier,version:'2026-08-19',disableCache:true};
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({id:'file'})).mockResolvedValueOnce(Response.json({id:'job',status:'PENDING'})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'COMPLETED'},markdown:{pages:[{success:true,page_number:1,markdown:'Built APIs'}]}})).mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetch);
 const parsed=await parseResume(Buffer.from('%PDF-'),settings);const body=JSON.parse(fetch.mock.calls[1][1].body);expect(body).toMatchObject({tier,version:'2026-08-19',disable_cache:true});if(tier==='fast')expect(body.agentic_options).toBeUndefined();else expect(body.agentic_options.custom_prompt).toContain(settings.parser.customPrompt);expect(parsed.metadata.settings).toEqual(settings.parser);
});
it('settings API changes future requests and validates updates',async()=>{
 const settings=defaultSettings();const parse=vi.fn().mockResolvedValue({text:'# Experience\nBuilt and shipped APIs.',metadata:{provider:'mock',jobId:'job',pageCount:1}});
 const deps:Dependencies={candidates:{health:async()=>true,list:vi.fn(),find:vi.fn()},analyses:{save:vi.fn(),list:vi.fn()},parse,decide:vi.fn(),health:async()=>({online:true}),parserConfigured:()=>true};const app=createApp(deps);
 settings.parser.tier='cost_effective';settings.workflow.maxPdfMb=1;settings.workflow.draftExpiryMinutes=5;
 const update=await request(app).put('/api/settings').send(settings);expect(update.status).toBe(200);expect((await request(app).get('/api/settings')).body.settings.parser.tier).toBe('cost_effective');
 const uploaded=await request(app).post('/api/resumes/parse').attach('resume',Buffer.from('%PDF-1.7'),{filename:'resume.pdf',contentType:'application/pdf'});expect(uploaded.status).toBe(200);expect(uploaded.body.expiresInMinutes).toBe(5);expect(parse.mock.calls[0][1].parser.tier).toBe('cost_effective');
 const oversized=await request(app).post('/api/resumes/parse').attach('resume',Buffer.alloc(1024*1024+1),{filename:'big.pdf',contentType:'application/pdf'});expect(oversized.status).toBe(400);
 expect((await request(app).put('/api/settings').send({...settings,apiKey:'secret'})).status).toBe(400);expect((await request(app).get('/api/settings')).body.settings.parser.tier).toBe('cost_effective');
 expect((await request(app).put('/api/settings').set('Origin','https://example.com').send(settings)).status).toBe(403);
});
