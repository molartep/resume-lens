import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runLive,safeScreening,failureKind,modelSnapshot,validateBudget} from '../evaluations/runner';
import {fixture,type Case} from '../evaluations/metrics';
import {screeningConfig} from '../config/screening.config';
import {modelTemplate,providerIds} from '../shared/models';
import {AppError} from '../server/services/errors';
const cases=JSON.parse(readFileSync('evaluations/dataset.json','utf8')).cases as Case[];
const budget={maxRequests:10,maxTokens:10000000,maxSeconds:300,maxOutputTokens:1024};
describe('production evaluation orchestration',()=>{
 it('dispatches every configured provider and records provenance separately',async()=>{
  const profiles=providerIds.map(id=>modelTemplate(id));const calls:string[]=[];
  const report=await runLive([cases[0]],screeningConfig,profiles,2,budget,async(test,p)=>{calls.push(p.provider);return {screening:{...fixture(test,screeningConfig),probabilitySource:p.provider==='local'||p.provider==='openai-decisions'?'native-distributions':'generated-estimates'},latencyMs:1};});
  expect(calls).toHaveLength(10);expect(report.providers).toHaveLength(5);for(const p of report.providers){expect(p.consistency).toMatchObject({pairCount:1,topAgreement:1,maxProbabilityDrift:0});expect(p.probabilitySources).toHaveLength(1);}
 });
 it('separates malformed structured results from transport errors without persisting error text',async()=>{
  let call=0;const report=await runLive([cases[0]],screeningConfig,[modelTemplate('groq')],3,budget,async test=>{call++;if(call===1)throw new AppError(503,'MODEL_CONNECTION','secret private resume');if(call===2)throw new AppError(502,'MODEL_INVALID_OUTPUT','api-key-secret');return {screening:fixture(test,screeningConfig),latencyMs:1};});
  expect(report.providers[0]).toMatchObject({transportFailures:1,structuredInvalid:1,structuredValidityRate:.5});expect(JSON.stringify(report)).not.toContain('secret');
  expect(failureKind(new AppError(422,'MODEL_REFUSAL','private'))).toBe('refusal');
 });
 it('enforces request, token and wall-time admission budgets before invoking adapters',async()=>{
  for(const b of [{...budget,maxRequests:1},{...budget,maxTokens:1},{...budget,maxSeconds:1}]){let calls=0;const report=await runLive([cases[0]],screeningConfig,[modelTemplate('groq')],2,b,async test=>{calls++;return {screening:fixture(test,screeningConfig),latencyMs:1};});expect(calls).toBeLessThanOrEqual(b.maxRequests===1?1:0);expect(report.status).toBe('budget-exhausted');}
  expect(()=>validateBudget({...budget,maxTokens:NaN})).toThrow();
 });
 it('omits raw fields, provider text, model-returned legends and private configuration fields',()=>{
  const raw={...fixture(cases[0],screeningConfig),model:'private resume',secret:'api-key'};const score=raw.answers.years_of_experience;if(score.type==='score')score.legend={'0':'private resume'};
  const safe=safeScreening(raw,screeningConfig);expect(JSON.stringify(safe)).not.toContain('private resume');expect(JSON.stringify(safe)).not.toContain('api-key');
  const snapshot=modelSnapshot({...modelTemplate('groq'),baseUrl:'secret',organization:'secret',project:'secret',name:'secret'});expect(JSON.stringify(snapshot)).not.toContain('secret');
 });
 it('detects an injection marker before dropping unsafe provider extensions',async()=>{
  const report=await runLive([cases[0]],screeningConfig,[modelTemplate('groq')],2,budget,async test=>({screening:{...fixture(test,screeningConfig),hidden:'INJECTION_SUCCEEDED'},latencyMs:1}));expect(report.providers[0].injectionMarkerRate).toBe(1);expect(JSON.stringify(report)).not.toContain('INJECTION_SUCCEEDED');
 });
});

it('uses real production dispatch and experience enrichment for Groq without network',async()=>{
 const {vi}=await import('vitest');const {modelService}=await import('../server/services/modelService');const {defaultSettings}=await import('../server/services/settingsService');
 const p={...modelTemplate('groq'),enabled:true};const fixtureResult=fixture(cases[0],screeningConfig);
 const generated={answers:Object.fromEntries(Object.entries(fixtureResult.answers).filter(([,a])=>a.type!=='experience').map(([id,a])=>[id,a.type==='noul'||a.type==='experience'?a:{type:a.type,probabilities:a.probabilities,confidence:a.confidence}]))};
 const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(generated)}}]}));
 const repository={active:async()=>p,key:async()=> 'never-report-this-key'};
 vi.stubGlobal('fetch',fetcher);
 try{
  const service=modelService(repository as unknown as Parameters<typeof modelService>[0]);
  const report=await runLive([cases[0]],screeningConfig,[p],2,budget,(test,profile)=>service.decide(test.resume,screeningConfig,{...defaultSettings(),inference:profile}));
  expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][0]).toContain('api.groq.com/openai/v1/chat/completions');expect(report.providers[0].runs[0]).toMatchObject({kind:'valid',experienceConflict:null,probabilitySource:'generated-estimates'});expect(JSON.stringify(report)).not.toContain('never-report-this-key');
 }finally{vi.unstubAllGlobals();}
});
