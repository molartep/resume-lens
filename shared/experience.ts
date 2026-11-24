import type {Screening, ScreeningConfig} from './types';
export type EmploymentInterval={source:{line:number;start:number;end:number;quote:string};startMonth:number|null;endMonth:number|null;precision:'month'|'year'|'ambiguous';issue?:string};
export type Experience={version:1;asOf:string;intervals:EmploymentInterval[];documentedMonths:number;possibleMonths:number;complete:boolean;issues:string[];levelIndex:number|null;modelConflict:boolean|null};
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const date='(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?\\s+\\d{4}|\\d{4}[-/]\\d{1,2}|\\d{4}|present|current|now)';
function parseDate(raw:string,asOf:number):{min:number;max:number;year:boolean}|null{
 if(/^(present|current|now)$/i.test(raw))return {min:asOf,max:asOf,year:false};
 if(/^\d{4}$/.test(raw)){const y=Number(raw)*12;return {min:y,max:y+11,year:true};}
 const numeric=raw.match(/^(\d{4})[-/](\d{1,2})$/);const named=raw.match(/^([a-z]+)\.?\s+(\d{4})$/i);
 const y=Number(numeric?.[1]??named?.[2]);const m=numeric?Number(numeric[2])-1:months.indexOf(named?.[1].slice(0,3).toLowerCase()??'');
 return y>=1900&&m>=0&&m<12?{min:y*12+m,max:y*12+m,year:false}:null;
}
function union(ranges:[number,number][]){const sorted=ranges.filter(([a,b])=>b>=a).sort((a,b)=>a[0]-b[0]);let total=0,end=-1;for(const [a,b] of sorted){total+=Math.max(0,b-Math.max(end,a-1));end=Math.max(end,b);}return total;}
// Only explicit employment sections are accepted. Unsupported formats stay reviewable,
// rather than being converted to invented dates or zero years of experience.
export function calculateExperience(text:string,config:ScreeningConfig,asOf:string):Experience{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf)))throw new Error('Invalid experience as-of date');
 const cutoff=Number(asOf.slice(0,4))*12+Number(asOf.slice(5,7))-1;
 const intervals:EmploymentInterval[]=[];const issues:string[]=[];const lower:[number,number][]=[];const upper:[number,number][]=[];
 let active=false,offset=0,found=false;
 const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const label=line.replace(/^\s*#{1,6}\s*/, '').trim().replace(/:$/,'');
  if(/^(?:(?:professional|work|employment)\s+)?experience$|^employment history$|^work history$/i.test(label)){active=true;found=true;offset+=line.length+1;continue;}
  if(/^\s*#/.test(line)||/^(education|skills|projects|certifications|summary|publications)$/i.test(label))active=false;
  if(active&&line.trim()){
   const matches=[...line.matchAll(new RegExp(`(${date})\\s*(?:to|[–—-])\\s*(${date})(?!\\d)`,'gi'))];
   for(const match of matches){
    const a=parseDate(match[1],cutoff),b=parseDate(match[2],cutoff);let issue:string|undefined;
    if(!a||!b||a.min>b.max||a.min>cutoff)issue='Invalid, reversed or future interval';
    else if(a.year||b.year)issue='Year-only dates: duration is bounded, not exact';
    else if(b.max>cutoff)issue='End date capped at evaluation month';
    const valid=a&&b&&a.min<=b.max&&a.min<=cutoff;
    intervals.push({source:{line:i+1,start:offset+match.index!,end:offset+match.index!+match[0].length,quote:match[0]},startMonth:valid?a.min:null,endMonth:valid?Math.min(b.max,cutoff):null,precision:!valid?'ambiguous':a.year||b.year?'year':'month',...(issue?{issue}:{})});
    if(valid){lower.push([a.max,Math.min(b.min,cutoff)]);upper.push([a.min,Math.min(b.max,cutoff)]);}
   }
   if(!matches.length&&!new RegExp(`(${date})\\s*(?:to|[–—-])\\s*(${date})`,'i').test(lines[i+1]??'')&&(/\b\d{4}\b/.test(line)||/\b(engineer|developer|analyst|manager|consultant|employment dates)\b/i.test(line))){intervals.push({source:{line:i+1,start:offset,end:offset+line.length,quote:line},startMonth:null,endMonth:null,precision:'ambiguous',issue:'Employment dates missing or unsupported; review required'});}
  }
  offset+=line.length+1;
 }
 if(!found)issues.push('No explicit employment section; experience is unknown');
 if(!intervals.length)issues.push('No reviewable employment intervals; experience is unknown');
 for(const interval of intervals)if(interval.issue)issues.push(`Line ${interval.source.line}: ${interval.issue}`);
 const documentedMonths=union(lower),possibleMonths=union(upper);
 const complete=intervals.length>0&&intervals.every(x=>x.precision==='month'&&!x.issue);
 const q=config.years_of_experience;const mapping=q?.type==='score'?q.experienceMonths:undefined;
 const validMapping=mapping&&q?.type==='score'&&mapping.length===q.criteria.length&&mapping[0]===0&&mapping.every((n,i)=>Number.isFinite(n)&&n>=0&&(i===0||n>mapping[i-1]));
 let levelIndex:number|null=null;
 if(complete&&validMapping){let i=0;while(i<mapping.length-1&&documentedMonths>=mapping[i+1])i++;levelIndex=i===mapping.length-1?i:i+(documentedMonths-mapping[i])/(mapping[i+1]-mapping[i]);}
 if(q?.type==='score'&&!validMapping)issues.push('Rubric has no valid explicit month-to-index mapping');
 return {version:1,asOf,intervals,documentedMonths,possibleMonths,complete,issues,levelIndex,modelConflict:null};
}
export function withExperience(screening:Screening,text:string,config:ScreeningConfig,asOf:string):Screening{
 const experience=calculateExperience(text,config,asOf);const answer=screening.answers.years_of_experience;
 experience.modelConflict=experience.levelIndex!==null&&answer?.type==='score'?Math.abs(answer.score-experience.levelIndex)>.25:null;
 const answers={...screening.answers};
 for(const [id,q] of Object.entries(config))if(q.type==='experience')answers[id]={type:'experience',experience};
 return {...screening,answers,experience};
}
export function experienceAsOf(config:ScreeningConfig,fallback:string){const instructions=(Object.values(config).find(q=>q.type==='experience')??config.years_of_experience)?.instructions;const date=typeof instructions==='object'?instructions.today:instructions?.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:fallback.slice(0,10);}
