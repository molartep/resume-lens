import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {screeningConfig} from '../config/screening.config';
import {parseDeciderResponse} from '../server/services/deciderService';
import {assess,compare,fixture,percentile,type Case} from '../evaluations/metrics';
const cases=JSON.parse(readFileSync('evaluations/dataset.json','utf8')).cases as Case[];
describe('synthetic evaluation annotations and measurements',()=>{
 it.each(cases)('$id: validates source spans and scorer behavior',test=>{
  for(const expected of Object.values(test.expectedEvidence))for(const quote of expected.quotes)expect(test.resume).toContain(quote);
  const result=parseDeciderResponse(fixture(test,screeningConfig),screeningConfig);const score=assess(test,result);expect(score.passed).toBe(score.total);expect(score.unsupported).toBe(0);
 });
 it('detects unsupported positive answers even when schema-valid',()=>{const test=cases.find(c=>c.id==='missing-experience')!;const result=fixture(test,screeningConfig);for(const id of Object.keys(test.expectedEvidence))result.answers[id]={type:'noul',noul:.99};expect(()=>parseDeciderResponse(result,screeningConfig)).not.toThrow();expect(assess(test,result).unsupported).toBe(3);});
 it('measures repeated probability drift and top-category changes',()=>{const a=fixture(cases[0],screeningConfig),b=structuredClone(a);expect(compare(a,b)).toEqual({topAgreement:1,maxProbabilityDelta:0});b.answers.mentorship_demonstrated={type:'noul',noul:.1};expect(compare(a,b).topAgreement).toBeLessThan(1);expect(compare(a,b).maxProbabilityDelta).toBeCloseTo(.82);});
 it('uses nearest-rank latency percentiles and does not invent missing samples',()=>{expect(percentile([],0.5)).toBeNull();expect(percentile([40,10,20,30],.5)).toBe(20);expect(percentile([40,10,20,30],.95)).toBe(40);});
});
