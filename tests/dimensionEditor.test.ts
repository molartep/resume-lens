import {describe,it,expect} from 'vitest';
import {configFromList,dimensionId,dimensionJson,instructionsText,parseDimensionJson,reorder} from '../shared/dimensionEditor';
import {validateConfig,buildRequest,resolveConfig} from '../server/services/configService';
import type {Dimension} from '../shared/types';
const question=(label:string):Dimension=>({label,type:'noul',order:999,instructions:'Does the resume demonstrate mentoring?'});
describe('dimension editor',()=>{
 it('derives lowercase IDs from labels without special characters',()=>{
  expect(dimensionId('  LLM & AI Experience!  ')).toBe('llm_ai_experience');
  expect(dimensionId('LLM_Experience')).toBe('llmexperience');
  expect(dimensionId('Hands-on (Engineering)')).toBe('handson_engineering');
  expect(dimensionId('2 Years Experience')).toBe('2_years_experience');
 });
 it('derives order from the list and handles colliding labels automatically',()=>{
  const config=configFromList([question('AI!'),question('AI'),question('AI 2'),question('AI')]);
  expect(Object.keys(config)).toEqual(['ai','ai_2','ai_2_2','ai_3']);
  expect(Object.values(config).map(q=>q.order)).toEqual([10,20,30,40]);
  expect(validateConfig(config)).toEqual(config);
  expect(Object.keys(buildRequest('Professional evidence',config).questions)).toEqual(Object.keys(config));
 });
 it('refuses unusable labels and keeps generated IDs within the supported length',()=>{
  expect(()=>configFromList([question('!!!')])).toThrow('letter or number');
  const config=configFromList([question('A'.repeat(200)),question('A'.repeat(200))]);
  expect(Object.keys(config).every(id=>id.length<=128)).toBe(true);
  expect(validateConfig(config)).toEqual(config);
 });
 it('reorders dimensions without changing questions or thresholds',()=>{
  const a=question('Mentoring');a.reviewThreshold={metric:'yes_probability',operator:'below',value:.6};
  const original=[a,question('LLM'),question('Projects')];
  const moved=reorder(original,0,2);
  expect(moved.map(q=>q.label)).toEqual(['LLM','Projects','Mentoring']);
  expect(original[0]).toBe(a);
  expect(configFromList(moved).mentoring.reviewThreshold).toEqual(a.reviewThreshold);
  expect(configFromList(moved).mentoring.order).toBe(30);
  expect(reorder(moved,-1,0)).toBe(moved);
  expect(reorder(moved,0,3)).toBe(moved);
 });
 it('preserves exact score level text when moving levels',()=>{
  const q:Dimension={label:'Depth',type:'score',order:10,instructions:'Evaluate engineering evidence.',criteria:['None','Features','Systems']};
  const config=configFromList([{...q,criteria:reorder(q.criteria,2,0)}]);
  expect(buildRequest('Evidence',config).questions.depth.criteria).toEqual(['Systems','None','Features']);
  expect(q.criteria).toEqual(['None','Features','Systems']);
 });
 it('supports JSON editing for all types and keeps display order automatic',()=>{
  const questions:Dimension[]=[question('Mentoring'),{...question('Profile'),type:'choice',criteria:{backend:'Builds APIs',frontend:'Builds interfaces'}},{...question('Depth'),type:'score',criteria:['None','Features']}];
  for(const q of questions){
   expect(dimensionJson(q)).not.toContain('"order"');
   expect(parseDimensionJson(dimensionJson(q),20)).toEqual({...q,order:20});
   expect(parseDimensionJson(JSON.stringify({...q,order:123}),20).order).toBe(20);
  }
  expect(()=>parseDimensionJson('{',10)).toThrow();
  expect(()=>parseDimensionJson('[]',10)).toThrow();
  expect(()=>parseDimensionJson(JSON.stringify({...questions[1],categoryLabels:{backend:{bad:true}}}),10)).toThrow('text labels');
  expect(()=>parseDimensionJson(JSON.stringify({...questions[0],reviewThreshold:{metric:'yes_probability',operator:'below',value:'bad'}}),10)).toThrow('numeric');
  expect(()=>parseDimensionJson(JSON.stringify({...questions[2],criteria:{bad:'object'}}),10)).toThrow('array');
 });
});

it('converts existing structured instructions to editable text while preserving date placeholders',()=>{
 const legacy={question:'How much experience as of today?',today:'{{CURRENT_DATE}}',guidance:{note:'Count professional roles.'}};
 expect(instructionsText(legacy)).toBe('How much experience as of today?\ntoday: {{CURRENT_DATE}}\nguidance / note: Count professional roles.');
 const config=configFromList([{...question('Experience'),instructions:legacy}]);
 expect(typeof config.experience.instructions).toBe('string');
 expect(dimensionJson({...question('Experience'),instructions:legacy})).not.toContain('"question":');
 expect(parseDimensionJson(JSON.stringify({...question('Experience'),instructions:legacy}),10).instructions).toBe(config.experience.instructions);
 const resolved=resolveConfig(config,new Date('2026-10-06T12:00:00Z'));
 expect(resolved.experience.instructions).toContain('2026-10-06');
 expect(resolved.experience.instructions).not.toContain('{{CURRENT_DATE}}');
 expect(config.experience.instructions).toContain('{{CURRENT_DATE}}');
 expect(instructionsText('As of {{CURRENT_DATE}}, review projects.')).toBe('As of {{CURRENT_DATE}}, review projects.');
});
