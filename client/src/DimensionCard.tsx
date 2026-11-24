import {InfoTooltip} from './InfoTooltip';
import type {Experience} from '../../shared/experience';
import type React from 'react';
import type {Dimension,Answer} from '../../shared/types';
import {reviewPolicy,reviewMessages} from '../../shared/review';
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const pct=(p:number)=>`${(p*100).toFixed(1)}%`;
function Distribution({values,labels,selected}:{values:Record<string,number>;labels:Record<string,string>;selected?:string}){return <div className="distribution">{Object.entries(values).map(([key,p])=><div className={`distribution-row ${key===selected?'selected':''}`} key={key}><div className="distribution-label"><span>{labels[key]||pretty(key)}</span><strong>{pct(p)}</strong></div><div className="track" role="meter" aria-label={labels[key]||key} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p*100}><div style={{width:`${p*100}%`}}/></div></div>)}</div>;}
export function DimensionCard({id,q,a,current,experience}:{id:string;q:Dimension;a:Answer;current?:Dimension;experience?:Experience}){
 if(a.type==='experience')experience=a.experience;
 const policy=reviewPolicy(q,current);
 const warnings=reviewMessages(a,policy.threshold,experience);
 let content:React.ReactNode;
 if(a.type==='experience')content=null;
 else if(a.type==='noul')content=<><div className="value">{pct(a.noul)}<span>Yes probability</span></div><Distribution values={{true:a.noul,false:1-a.noul}} labels={{true:'Yes',false:'No'}}/></>;
 else if(a.type==='choice')content=<><div className="choice-value">{q.categoryLabels?.[a.choice]||pretty(a.choice)}<span>Highest model probability · {pct(a.probabilities[a.choice])}</span></div><Distribution values={a.probabilities} labels={q.categoryLabels||{}} selected={a.choice}/><p className="confidence">Model confidence {pct(a.confidence)}</p></>;
 else {
  const selected=Object.entries(a.probabilities).reduce((best,x)=>x[1]>best[1]?x:best)[0];
  content=<><div className="value">{a.score.toFixed(2)}<span>Expected level index · 0 to {Object.keys(a.legend).length-1}</span></div><p className="confidence">Most probable level: {selected} · Confidence {pct(a.confidence)}</p><Distribution values={a.probabilities} labels={Object.fromEntries(Object.entries(a.legend).map(([k,v])=>[k,`${k} · ${v}`]))} selected={selected}/></>;
 }
 return <section id={`dimension-${id}`} className={`card dimension ${warnings.length?'review-flagged':''}`}>
  <div className="card-heading"><h3>{q.label}</h3><span className="tag">{a.type==='experience'?'DETERMINISTIC':a.type.toUpperCase()}</span></div>
  {warnings.length>0&&<div className="review-warning" role="alert"><strong>⚠ Manual review needed</strong>{warnings.map(message=><span key={message}>{message}</span>)}</div>}
  {experience&&<ExperienceResult experience={experience} legacy={a.type!=='experience'}/>}
  {content}
  {policy.threshold&&<p className="threshold-source">Review threshold: {policy.threshold.metric.replaceAll('_',' ')} {policy.threshold.operator} {['expected_score','documented_years'].includes(policy.threshold.metric)?`${policy.threshold.value}${policy.threshold.metric==='documented_years'?' years':''}`:`${(policy.threshold.value*100).toFixed(1)}%`}</p>}
  <a href="#evidence" className="evidence-link">Review resume evidence ↗</a>
  <details><summary>Screening instructions</summary><pre>{typeof q.instructions==='string'?q.instructions:JSON.stringify(q.instructions,null,2)}</pre></details>
  <span className="internal-id">{id}</span>
 </section>;
}
function ExperienceResult({experience:e,legacy}:{experience:Experience;legacy:boolean}){
 const total=e.complete?`${(e.documentedMonths/12).toFixed(2)} years`:e.possibleMonths?`${(e.documentedMonths/12).toFixed(2)}–${(e.possibleMonths/12).toFixed(2)} years`:'Unknown';
 return <div className="experience-result">
  <div className="experience-total"><div className="value">{total}<span>{e.complete?'Documented professional experience':e.possibleMonths?'Bounded documented duration · total needs review':'Insufficient dated employment evidence'}</span></div>
   <InfoTooltip label="How experience is calculated">Calculated as of {e.asOf} using inclusive calendar months. Overlapping roles count once; gaps do not count. {e.documentedMonths} documented months{e.possibleMonths!==e.documentedMonths?`; up to ${e.possibleMonths} months in bounded intervals`:''}. Missing or ambiguous dates require review. This calculation describes the supplied evidence, not verified employment.{legacy&&` Historical rubric index: ${e.levelIndex??'unmapped / review required'}.`}</InfoTooltip>
  </div>
  <details className="experience-details"><summary>Employment intervals <span className="detail-count">{e.intervals.length}</span></summary>
   {e.intervals.length?<ol className="employment-intervals">{e.intervals.map((interval,i)=><li key={i}><div className="interval-heading"><strong>{interval.source.quote}</strong><span className={`interval-status ${interval.precision==='ambiguous'?'needs-review':''}`}>{interval.precision==='month'?'Month precision':interval.precision==='year'?'Year-only dates':'Dates need review'}</span></div><a className="interval-source" href="#evidence">Evidence line {interval.source.line} ↗</a></li>)}</ol>:<p>No dated employment intervals were identified. Review the resume evidence.</p>}
  </details>
  {e.issues.length>0&&<details className="experience-details calculation-issues" open><summary>Calculation issues <span className="detail-count">{e.issues.length}</span></summary><ul>{e.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
 </div>;
}
