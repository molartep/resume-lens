import type React from 'react';
import type {Dimension,Answer} from '../../shared/types';
import {reviewPolicy,reviewWarning} from '../../shared/review';
const pretty=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const pct=(p:number)=>`${(p*100).toFixed(1)}%`;
function Distribution({values,labels,selected}:{values:Record<string,number>;labels:Record<string,string>;selected?:string}){return <div className="distribution">{Object.entries(values).map(([key,p])=><div className={`distribution-row ${key===selected?'selected':''}`} key={key}><div className="distribution-label"><span>{labels[key]||pretty(key)}</span><strong>{pct(p)}</strong></div><div className="track" role="meter" aria-label={labels[key]||key} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p*100}><div style={{width:`${p*100}%`}}/></div></div>)}</div>;}
export function DimensionCard({id,q,a,current}:{id:string;q:Dimension;a:Answer;current?:Dimension}){
 const policy=reviewPolicy(q,current);
 const warning=reviewWarning(a,policy.threshold);
 let content:React.ReactNode;
 if(a.type==='noul')content=<><div className="value">{pct(a.noul)}<span>Yes probability</span></div><Distribution values={{true:a.noul,false:1-a.noul}} labels={{true:'Yes',false:'No'}}/></>;
 else if(a.type==='choice')content=<><div className="choice-value">{q.categoryLabels?.[a.choice]||pretty(a.choice)}<span>Highest model probability · {pct(a.probabilities[a.choice])}</span></div><Distribution values={a.probabilities} labels={q.categoryLabels||{}} selected={a.choice}/><p className="confidence">Model confidence {pct(a.confidence)}</p></>;
 else {
  const selected=Object.entries(a.probabilities).reduce((best,x)=>x[1]>best[1]?x:best)[0];
  content=<><div className="value">{a.score.toFixed(2)}<span>Expected level index · 0 to {Object.keys(a.legend).length-1}</span></div><p className="confidence">Most probable level: {selected} · Confidence {pct(a.confidence)}</p><Distribution values={a.probabilities} labels={Object.fromEntries(Object.entries(a.legend).map(([k,v])=>[k,`${k} · ${v}`]))} selected={selected}/></>;
 }
 return <section className={`card dimension ${warning?'review-flagged':''}`}><div className="card-heading"><h3>{q.label}</h3><span className="tag">{a.type.toUpperCase()}</span></div>{warning&&<div className="review-warning" role="alert"><strong>⚠ Manual review needed</strong><span>{warning}</span><small>{policy.source} · Application interpretation</small></div>}{content}{policy.threshold&&<p className="threshold-source">{policy.source}: {policy.threshold.metric.replaceAll('_',' ')} {policy.threshold.operator} {policy.threshold.metric==='expected_score'?policy.threshold.value:`${(policy.threshold.value*100).toFixed(1)}%`}</p>}<a href="#evidence" className="evidence-link">Review resume evidence ↗</a><details><summary>Screening instructions</summary><pre>{typeof q.instructions==='string'?q.instructions:JSON.stringify(q.instructions,null,2)}</pre></details><span className="internal-id">{id}</span></section>;
}
