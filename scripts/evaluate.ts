import 'dotenv/config';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {screeningConfig} from '../config/screening.config';
import {resolveConfig} from '../server/services/configService';
import {parseDeciderResponse} from '../server/services/deciderService';
import {defaultSettings} from '../server/services/settingsService';
import {modelRepository} from '../server/repositories/modelRepository';
import {modelService} from '../server/services/modelService';
import {assess,fixture,type Case} from '../evaluations/metrics';
import {evaluationVersion,runLive,validateBudget} from '../evaluations/runner';
import {calculateExperience} from '../shared/experience';
const args=process.argv.slice(2);
const live=args.includes('--live');
const allowed=new Set(['--live','--max-requests','--max-tokens','--max-seconds','--max-output-tokens','--repeats','--profiles']);
for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw new Error('Unknown evaluation option');if(args[i]!=='--live'){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing option value');i++;}}
const option=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
if(live&&process.env.CI)throw new Error('Live evaluations are disabled in CI.');
const bytes=await readFile('evaluations/dataset.json');const digest=createHash('sha256').update(bytes).digest('hex');
// Pin the reviewed public synthetic corpus. A local file or edited/private corpus
// cannot accidentally be uploaded or snapshotted by this runner.
if(digest!=='f94ae7d225fcde36ff71baf26c7958ef8c36999b5fd8dff926c4df061ee4944c')throw new Error('Synthetic corpus changed: review its privacy and update the pinned digest before evaluation.');
const dataset=JSON.parse(bytes.toString()) as {version:number;synthetic:boolean;asOf:string;cases:Case[]};
if(dataset.synthetic!==true)throw new Error('Only the reviewed synthetic corpus is supported');
const config=resolveConfig(screeningConfig,new Date(`${dataset.asOf}T12:00:00Z`),'America/Bogota');
const repeats=Number(option('--repeats')??3);
if(!Number.isInteger(repeats)||repeats<2||repeats>10)throw new Error('Repeats must be 2–10');
for(const test of dataset.cases)for(const expectation of Object.values(test.expectedEvidence))for(const quote of expectation.quotes)if(!test.resume.includes(quote))throw new Error('Invalid synthetic source span');
const snapshot={evaluationVersion,generatedAt:new Date().toISOString(),rubric:config,evidence:{sha256:digest,...dataset}};
await mkdir(live?'evaluations/results/live':'evaluations/results/fixtures',{recursive:true});
if(!live){
 const checks=dataset.cases.map(test=>{const result=parseDeciderResponse(fixture(test,config),config);const experience=calculateExperience(test.resume,config,dataset.asOf);return {caseId:test.id,assessment:assess(test,result),experience,experiencePass:!test.experience||Object.entries(test.experience).filter(([key])=>key!=='levelIndex'||config.years_of_experience?.type==='score').every(([key,value])=>experience[(key==='months'?'documentedMonths':key) as keyof typeof experience]===value)};});
 const baseline=fixture(dataset.cases[0],config);
 const mutants=[[],{model:'fixture',answers:{}},{...baseline,answers:{...baseline.answers,mentorship_demonstrated:{type:'noul',noul:2}}},{...baseline,answers:{...baseline.answers,years_of_experience:{type:'score',score:8}}},{approved:true,claim:'INJECTION_SUCCEEDED'}];
 const rejections=mutants.map(raw=>{try{parseDeciderResponse(raw,config);return false;}catch{return true;}});
 const report={...snapshot,mode:'fixtures',label:'Authored fixtures and validation probes only; no model quality, consistency or inference latency measured.',checks,rejections};
 await writeFile('evaluations/results/fixtures/latest.json',JSON.stringify(report,null,2)+'\n');
 if(checks.some(c=>c.assessment.passed!==c.assessment.total||!c.experiencePass)||rejections.some(r=>!r))process.exitCode=1;
 console.log(`Fixture checks: ${checks.length}; rejection probes: ${rejections.filter(Boolean).length}/${rejections.length}. No live requests made.`);
}else{
 const budget=validateBudget({maxRequests:Number(option('--max-requests')),maxTokens:Number(option('--max-tokens')),maxSeconds:Number(option('--max-seconds')),maxOutputTokens:Number(option('--max-output-tokens'))});
 if(budget.maxOutputTokens<256)throw new Error('Output token cap must be at least 256');
 const repository=modelRepository();const service=modelService(repository);const catalog=await repository.list();
 const selected=option('--profiles')?.split(',');
 if(selected?.some(id=>!catalog.profiles.some(p=>p.id===id&&p.enabled)))throw new Error('Unknown or disabled evaluation profile');
 const profiles=catalog.profiles.filter(p=>p.enabled&&(!selected||selected.includes(p.id))).map(p=>({...p,maxOutputTokens:Math.min(p.maxOutputTokens,budget.maxOutputTokens)}));
 if(!profiles.length)throw new Error('No enabled evaluation profiles');
 const result=await runLive(dataset.cases,config,profiles,repeats,budget,(test,p)=>service.decide(test.resume,config,{...defaultSettings(),inference:p}));
 const report={...snapshot,mode:'live',...result,limitations:['Synthetic annotations are broad semantic proxies, not calibrated factuality, fairness or hiring suitability.','Missing evidence means unknown, not absent ability.','Token admission uses conservative estimates, not a currency or billed-token guarantee. Local Decider manages its own output limit. No retries are made.','Latency includes adapter parsing and deterministic experience checks. Failure latency is separate.','Native distributions and generated estimates have separate provenance; neither establishes calibration.']};
 const filename=`evaluations/results/live/${Date.now()}`;
 await writeFile(`${filename}.json`,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 const fmt=(n:number|null)=>n===null?'Not measured':`${(n*100).toFixed(1)}%`;
 const md=`# Live synthetic evaluation\n\nEvaluation ${evaluationVersion}; ${result.status}; ${result.attempts} attempts; ${result.skipped} skipped by budget.\n\n| Provider / model | Probability source | Valid structure | Evidence adherence | Unsupported positives | Agreement | Max drift | p50 / p95 ms | Transport failures |\n|---|---|---|---|---|---|---|---|---|\n${result.providers.map(p=>`| ${p.model.provider} / ${p.model.model} | ${p.probabilitySources.join(', ')||'Not measured'} | ${fmt(p.structuredValidityRate)} | ${fmt(p.evidenceAdherence)} | ${fmt(p.unsupportedPositiveRate)} | ${fmt(p.consistency.topAgreement)} | ${p.consistency.maxProbabilityDrift??'Not measured'} | ${p.latencyMs.p50===null?'Not measured':`${p.latencyMs.p50.toFixed(0)} / ${p.latencyMs.p95!.toFixed(0)}`} | ${p.transportFailures} |`).join('\n')}\n\n${report.limitations.map(x=>'- '+x).join('\n')}\n`;
 await writeFile(`${filename}.md`,md,{mode:0o600});console.log(md);
 if(result.skipped)process.exitCode=2;
 if(result.providers.some(p=>p.runs.some(r=>r.kind!=='valid'||r.assessment!.passed!==r.assessment!.total)))process.exitCode=1;
}
