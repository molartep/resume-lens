import {describe,it,expect} from 'vitest';
import {calculateExperience,withExperience} from '../shared/experience';
import {screeningConfig as currentConfig} from '../config/screening.config';
import type {ScreeningConfig} from '../shared/types';
const screeningConfig:ScreeningConfig={...currentConfig,years_of_experience:{...currentConfig.years_of_experience,type:'score',criteria:['None','2 years','4 years','6 years','8 years','10+ years'],experienceMonths:[0,24,48,72,96,120],reviewThreshold:undefined}};
import {validateConfig} from '../server/services/configService';
const calc=(text:string,asOf='2026-11-17')=>calculateExperience(`# Experience\n${text}`,screeningConfig,asOf);
describe('documented professional experience',()=>{
 it('keeps four years distinct from a zero-based index, flagging the Groq regression',()=>{
  const text='# Experience\nEngineer, January 2021–December 2024';
  const result=withExperience({model:'groq',answers:{years_of_experience:{type:'score',score:4,probabilities:{'4':1},legend:{'4':'8 years'},confidence:1}}},text,screeningConfig,'2026-11-17');
  expect(result.experience).toMatchObject({documentedMonths:48,possibleMonths:48,levelIndex:2,complete:true,modelConflict:true});
  const source=result.experience!.intervals[0].source;expect(text.slice(source.start,source.end)).toBe(source.quote);
 });
 it('unions overlaps and duplicate roles, retaining gaps',()=>{expect(calc('Engineer, Jan 2021–Dec 2022\nConsultant, Jan 2022–Dec 2023\nConsultant, Jan 2022–Dec 2023\nDeveloper, Jan 2025–Dec 2025').documentedMonths).toBe(48);});
 it('resolves present to the fixed as-of month inclusively',()=>{expect(calc('Engineer, Jan 2026–Present').documentedMonths).toBe(11);expect(calc('Engineer, 2026-01 to 2026-11').documentedMonths).toBe(11);});
 it('bounds year-only intervals and declines exact rubric mapping',()=>{expect(calc('Engineer, 2021–2024')).toMatchObject({documentedMonths:26,possibleMonths:48,complete:false,levelIndex:null});});
 it.each(['Engineer, 2023–','Engineer, dates unknown','Engineer, Dec 2024–Jan 2021','Engineer, Jan 2027–Present'])('does not invent dates for %s',text=>{expect(calc(text)).toMatchObject({documentedMonths:0,complete:false,levelIndex:null});expect(calc(text).issues.length).toBeGreaterThan(0);});
 it('excludes education dates and treats no employment history as unknown',()=>{const result=calculateExperience('# Education\nUniversity, 2021–2024',screeningConfig,'2026-11-17');expect(result).toMatchObject({documentedMonths:0,complete:false,levelIndex:null});});
 it('supports role titles above date lines without treating the title as missing history',()=>{expect(calc('Software Engineer\nJan 2021–Dec 2024')).toMatchObject({documentedMonths:48,complete:true});});
 it('requires an explicit valid configured month mapping',()=>{const config=structuredClone(screeningConfig);if(config.years_of_experience.type!=='score')throw new Error();delete config.years_of_experience.experienceMonths;expect(calculateExperience('# Experience\nEngineer, Jan 2021–Dec 2024',config,'2026-11-17').levelIndex).toBeNull();config.years_of_experience.experienceMonths=[0,48,24];expect(()=>validateConfig(config)).toThrow();});
});

it('renders duration, model index and conflict as separate reviewable information',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {DimensionCard}=await import('../client/src/DimensionCard');
 const q=screeningConfig.years_of_experience;const answer={type:'score' as const,score:4,probabilities:{'0':0,'1':0,'2':0,'3':0,'4':1,'5':0},legend:Object.fromEntries(q.type==='score'?q.criteria.map((v,i)=>[String(i),v]):[]),confidence:1};
 const result=withExperience({model:'fixture',answers:{years_of_experience:answer}},'# Experience\nEngineer, Jan 2021–Dec 2024',screeningConfig,'2026-11-17');
 const html=renderToStaticMarkup(React.createElement(DimensionCard,{id:'years_of_experience',q,a:answer,experience:result.experience}));
 expect(html).toContain('4.00 years');expect(html).toContain('48 documented months');expect(html).toContain('Expected level index');expect(html).toContain('conflicts with documented duration');expect(html).toContain('Evidence line 2');
});

it('calculates the dedicated type locally without a rubric or provider',async()=>{
 const {modelService}=await import('../server/services/modelService');const {defaultSettings}=await import('../server/services/settingsService');const {reviewWarning}=await import('../shared/review');
 const config=validateConfig({years_of_experience:currentConfig.years_of_experience});
 const service=modelService({active:async()=>{throw new Error('Must not access a provider');}} as unknown as Parameters<typeof modelService>[0]);
 const settings={...defaultSettings(),screeningConfig:config};
 expect((await service.health(settings)).online).toBe(true);await service.snapshot(settings);
 const result=await service.decide('# Experience\nEngineer, January 2021–December 2024',config,settings);
 const answer=result.screening.answers.years_of_experience;
 expect(answer.type).toBe('experience');if(answer.type!=='experience')throw new Error();
 expect(answer.experience).toMatchObject({documentedMonths:48,complete:true,levelIndex:null,modelConflict:null});expect(answer).not.toHaveProperty('probabilities');
 expect(reviewWarning(answer,config.years_of_experience.reviewThreshold)).toBeNull();
 expect(reviewWarning({...answer,experience:{...answer.experience,documentedMonths:47}},config.years_of_experience.reviewThreshold)).toContain('below');
 expect(reviewWarning({...answer,experience:{...answer.experience,complete:false}})).toContain('incomplete');
});

it('excludes deterministic dimensions from all model question formats',async()=>{
 const {buildRequest}=await import('../server/services/configService');const {outputSchema,decisionsRequest}=await import('../server/services/providers/protocol');const {geminiDecisionsRequest}=await import('../server/services/providers/geminiDecisions');const {modelTemplate}=await import('../shared/models');
 expect(buildRequest('text',currentConfig).questions).not.toHaveProperty('years_of_experience');
 expect(JSON.stringify(outputSchema(currentConfig))).not.toContain('years_of_experience');
 expect(decisionsRequest('text',currentConfig,modelTemplate('openai-decisions')).questions.some(q=>q.name==='years_of_experience')).toBe(false);
 expect(geminiDecisionsRequest('text',currentConfig,modelTemplate('gemini')).questions).not.toHaveProperty('years_of_experience');
});

it('renders deterministic years without a score, probability distribution or index',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {DimensionCard}=await import('../client/src/DimensionCard');
 const {screening}=withExperienceResult();
 const html=renderToStaticMarkup(React.createElement(DimensionCard,{id:'years_of_experience',q:currentConfig.years_of_experience,a:screening.answers.years_of_experience}));
 expect(html).toContain('4.00 years');expect(html).toContain('DETERMINISTIC');expect(html).not.toContain('level index');expect(html).not.toContain('Rubric index');expect(html).not.toContain('Model confidence');
 function withExperienceResult(){return {screening:withExperience({model:'test',answers:{}},'# Experience\nEngineer, Jan 2021–Dec 2024',currentConfig,'2026-11-24')};}
});
