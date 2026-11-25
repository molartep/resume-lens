import {it,expect} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {starterTemplates,exampleReviewProbability,businessExampleNames} from '../server/services/starterTemplates';
import {templateRepository} from '../server/repositories/templateRepository';
import {validateScreeningConfiguration,configurationSchemaVersion} from '../shared/screeningConfiguration';
import {reviewWarning} from '../shared/review';
import type {Dimension} from '../shared/types';

it('provides five validated, model-independent examples with clear evidence categories',()=>{
 const templates=starterTemplates();expect(templates.map(t=>t.name)).toEqual(['General Candidate Screening','Software Engineer','Data Engineer','Customer Success Manager','Operations Manager']);
 for(const t of templates){expect(validateScreeningConfiguration(t.configuration)).toEqual(t.configuration);const rows=Object.values(t.configuration.dimensions);expect(rows.length).toBeGreaterThanOrEqual(5);expect(rows.map(q=>q.order)).toEqual(rows.map((_,i)=>(i+1)*10));
  for(const q of rows){expect(q.type).toBe('choice');expect(q.categoryLabels).toEqual({clear_evidence:'Clear evidence',partial_evidence:'Partial evidence',not_documented:'Not documented'});expect(q.instructions).toContain('Qualitative outcomes are valid');}
 }
});
it('flags incomplete and uncertain evidence for human follow-up without changing model outputs',()=>{
 const q=starterTemplates()[0].configuration.dimensions.responsibility_and_ownership;
 const answer=(clear:number)=>({type:'choice' as const,choice:clear>.5?'clear_evidence':'not_documented',probabilities:{clear_evidence:clear,partial_evidence:(1-clear)/2,not_documented:(1-clear)/2},confidence:.7});
 expect(q.reviewThreshold).toEqual({metric:'category_probability',category:'clear_evidence',operator:'below',value:exampleReviewProbability});
 expect(reviewWarning(answer(.64),q.reviewThreshold)).toContain('below');expect(reviewWarning(answer(.1),q.reviewThreshold)).toContain('below');expect(reviewWarning(answer(.34),q.reviewThreshold)).toContain('below');expect(reviewWarning(answer(.65),q.reviewThreshold)).toBeNull();expect(reviewWarning(answer(.9),q.reviewThreshold)).toBeNull();
 const evidence=answer(.1);reviewWarning(evidence,q.reviewThreshold);expect(evidence.probabilities.clear_evidence).toBe(.1);
});
it('does not automatically flag contextual specialisms or impose universal tenure, tools or leadership requirements',()=>{
 const templates=starterTemplates();const optional:Record<string,string>={'General Candidate Screening':'learning_and_adaptation','Software Engineer':'design_reasoning','Data Engineer':'scale_and_processing','Customer Success Manager':'commercial_expansion'};
 for(const [name,id] of Object.entries(optional)){const q=templates.find(t=>t.name===name)!.configuration.dimensions[id];expect(q.reviewThreshold).toBeUndefined();expect(reviewWarning({type:'choice',choice:'not_documented',probabilities:{clear_evidence:.01,partial_evidence:.04,not_documented:.95},confidence:.8},q.reviewThreshold)).toBeNull();}
 expect(templates.flatMap(t=>Object.values(t.configuration.dimensions)).some((q:Dimension)=>q.reviewThreshold?.metric==='documented_years')).toBe(false);
});
it('adds business examples to an existing installation once without changing original templates or restoring deleted examples',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'business-starters-'));const db=new PrismaClient({datasourceUrl:`file:${dir}/app.db`});
 try{
  for(const migration of (await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort())for(const statement of (await readFile(`prisma/migrations/${migration}/migration.sql`,'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
  const repo=templateRepository(db);const original=await repo.create({...starterTemplates()[0],description:'Locally customized original',configurationSchemaVersion});await db.applicationInitialization.create({data:{key:'screening-templates-v1'}});
  await repo.initialize();expect(await repo.list()).toHaveLength(3);expect(await repo.get(original.id)).toEqual(original);
  const customer=(await repo.list()).find(t=>t.name===businessExampleNames[0])!;const changed=await repo.update(customer.id,{name:customer.name,configuration:customer.configuration,configurationSchemaVersion,description:'Customized business example',expectedRevision:customer.revision});
  expect(changed.description).toBe('Customized business example');
  const operations=(await repo.list()).find(t=>t.name===businessExampleNames[1])!;await repo.remove(operations.id);await repo.initialize();await repo.initialize();expect(await repo.get(customer.id)).toEqual(changed);await expect(repo.get(operations.id)).rejects.toMatchObject({status:404});expect(await repo.list()).toHaveLength(2);
 }finally{await db.$disconnect();await rm(dir,{recursive:true,force:true});}
});
