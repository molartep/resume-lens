import {describe,it,expect,vi,afterEach} from 'vitest';
import {screeningConfig} from '../config/screening.config';
import {validateConfig,buildRequest,resolveConfig,currentDate} from '../server/services/configService';
import {parseDeciderResponse,analyzeWithDecider,deciderUrl} from '../server/services/deciderService';
import {suggestProfessionalEvidence,assertProfessionalEvidence} from '../server/services/resumeService';
import type {ScreeningConfig} from '../shared/types';
export const smallConfig:ScreeningConfig={mentor:{type:'noul',label:'Mentor',order:1,instructions:'Mentored engineers?'},role:{type:'choice',label:'Role',order:2,instructions:'Which work?',criteria:{api:'API',ui:'UI'}},depth:{type:'score',label:'Depth',order:3,instructions:'Depth?',criteria:['None','Feature','System']}};
export const smallResponse={model:'test',answers:{mentor:{type:'noul',noul:.82},role:{type:'choice',choice:'api',probabilities:{api:.7,ui:.3},confidence:.4},depth:{type:'score',score:1.2,legend:{'0':'None','1':'Feature','2':'System'},probabilities:{'0':.1,'1':.6,'2':.3},confidence:.6}},usage:{input_tokens:200,output_tokens:3},latency_ms:123};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('configuration',()=>{
 it('validates supplied configurable dimensions',()=>expect(Object.keys(validateConfig(screeningConfig))).toHaveLength(7));
 it.each([{}, {q:{type:'score',instructions:'x',label:'X',order:0,criteria:['one']}},{q:{type:'noul',instructions:'x',label:'X',order:0,criteria:{maybe:'x'}}},{q:{type:'choice',instructions:'x',label:'X',order:0,criteria:{one:'One'}}}])('rejects malformed config',value=>expect(()=>validateConfig(value)).toThrow());
 it('blocks prohibited criteria',()=>expect(()=>validateConfig({q:{type:'noul',instructions:'Infer nationality',label:'X',order:1}})).toThrow());
 it('resolves date recursively at submission without changing original',()=>{vi.stubEnv('APP_TIMEZONE','America/New_York');const resolved=resolveConfig(screeningConfig,new Date('2026-10-05T01:00:00Z'));expect(resolved.years_of_experience.instructions).toEqual({question:'How many years of professional experience does the candidate have, as of today?',today:'2026-10-04'});expect(JSON.stringify(screeningConfig)).toContain('{{CURRENT_DATE}}');expect(currentDate(new Date('2026-10-05T01:00:00Z'))).toBe('2026-10-04');});
 it('builds a single request dynamically and removes presentation fields',()=>{const req=buildRequest('Built APIs',smallConfig);expect(Object.keys(req.questions)).toEqual(['mentor','role','depth']);expect(req.questions.role).toEqual({type:'choice',instructions:'Which work?',criteria:{api:'API',ui:'UI'}});expect(JSON.stringify(req)).not.toContain('categoryLabels');expect(req.state.professional_resume).toBe('Built APIs');});
 it('supports adding and removing questions and optional noul criteria',()=>{const custom:ScreeningConfig={...smallConfig,custom:{type:'noul' as const,label:'Custom',order:9,instructions:'Custom?',criteria:{true:'Shown'}}};delete custom.role;const req=buildRequest('text',validateConfig(custom));expect(req.questions.custom.criteria).toEqual({true:'Shown'});expect(req.questions.role).toBeUndefined();});
});
describe('Decider results',()=>{
 it('preserves fractional NOUL with no threshold',()=>expect(parseDeciderResponse(smallResponse,smallConfig).answers.mentor).toEqual({type:'noul',noul:.82}));
 it('preserves choice distribution and confidence separately',()=>expect(parseDeciderResponse(smallResponse,smallConfig).answers.role).toEqual(smallResponse.answers.role));
 it('preserves expected score, ordered legend and distribution',()=>expect(parseDeciderResponse(smallResponse,smallConfig).answers.depth).toEqual(smallResponse.answers.depth));
 it('preserves raw extension metadata',()=>expect(parseDeciderResponse({...smallResponse,extra:{x:1}},smallConfig).extra).toEqual({x:1}));
 it.each([null,{...smallResponse,answers:{}},{...smallResponse,answers:{...smallResponse.answers,mentor:{type:'noul',noul:1.5}}},{...smallResponse,answers:{...smallResponse.answers,role:{...smallResponse.answers.role,probabilities:{api:.9,ui:.9}}}},{...smallResponse,answers:{...smallResponse.answers,depth:{...smallResponse.answers.depth,score:9}}}])('rejects invalid response',value=>expect(()=>parseDeciderResponse(value,smallConfig)).toThrow());
 it('rejects incomplete or mismatched legends',()=>expect(()=>parseDeciderResponse({...smallResponse,answers:{...smallResponse.answers,depth:{...smallResponse.answers.depth,legend:{'0':'Wrong'}}}},smallConfig)).toThrow());
 it('shows useful offline error',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('fetch failed')));await expect(analyzeWithDecider('Built APIs',smallConfig)).rejects.toThrow('offline');});
 it('shows timeout error',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('timeout','TimeoutError')));await expect(analyzeWithDecider('Built APIs',smallConfig)).rejects.toThrow('timed out');});
 it('restricts Decider to localhost',()=>{vi.stubEnv('STRANDS_DECIDER_URL','https://remote.example');expect(deciderUrl).toThrow();});
});
describe('evidence boundaries',()=>{
 it('suggests professional sections and excludes personal header',()=>expect(suggestProfessionalEvidence('# Jane Smith\njane@example.com\n# Experience\nBuilt an API\n# Personal details\nNationality: example')).toBe('# Experience\nBuilt an API'));
 it('preserves text without recognized sections',()=>expect(suggestProfessionalEvidence('Built API\nReduced latency')).toBe('Built API\nReduced latency'));
 it('rejects explicit sensitive disclosures',()=>expect(()=>assertProfessionalEvidence('Nationality: example')).toThrow());
});
