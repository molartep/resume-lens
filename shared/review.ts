import type {Answer,Dimension,ReviewThreshold} from './types';
export function reviewMetrics(type:Dimension['type']){
 return type==='noul'?['yes_probability'] as const:type==='score'?['expected_score','confidence'] as const:['top_probability','category_probability','confidence'] as const;
}
export function reviewWarning(answer:Answer,threshold?:ReviewThreshold):string|null {
 if(!threshold)return null;
 let actual:number|undefined;let label='';let percent=true;
 switch(threshold.metric){
  case 'yes_probability':if(answer.type==='noul'){actual=answer.noul;label='Yes probability';}break;
  case 'top_probability':if(answer.type==='choice'){actual=Math.max(...Object.values(answer.probabilities));label='Highest category probability';}break;
  case 'category_probability':if(answer.type==='choice'){actual=answer.probabilities[threshold.category||''];label=`Probability for ${threshold.category}`;}break;
  case 'expected_score':if(answer.type==='score'){actual=answer.score;label='Expected level index';percent=false;}break;
  case 'confidence':if(answer.type!=='noul'){actual=answer.confidence;label='Model confidence';}break;
 }
 if(actual===undefined||!Number.isFinite(actual))return 'The configured threshold cannot be evaluated. Review this result manually.';
 const violated=threshold.operator==='below'?actual<threshold.value:actual>threshold.value;
 const display=(n:number)=>percent?`${(n*100).toFixed(1)}%`:n.toFixed(2);
 return violated?`${label} ${display(actual)} is ${threshold.operator} the configured threshold of ${display(threshold.value)}.`:null;
}
// Compare model-facing definitions, allowing only the dynamic date to differ.
function matches(template:unknown,value:unknown):boolean{
 if(typeof template==='string'&&template.includes('{{CURRENT_DATE}}')){
  const pattern=template.split('{{CURRENT_DATE}}').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\d{4}-\\d{2}-\\d{2}');
  return typeof value==='string'&&new RegExp(`^${pattern}$`).test(value);
 }
 if(Array.isArray(template))return Array.isArray(value)&&template.length===value.length&&template.every((v,i)=>matches(v,value[i]));
 if(template&&typeof template==='object')return !!value&&typeof value==='object'&&Object.keys(template).length===Object.keys(value).length&&Object.entries(template).every(([k,v])=>matches(v,(value as Record<string,unknown>)[k]));
 return template===value;
}
export function reviewPolicy(saved:Dimension,current?:Dimension):{threshold?:ReviewThreshold;source:string}{
 if(current&&current.type===saved.type&&matches(current.instructions,saved.instructions)&&matches(current.criteria,saved.criteria))return {threshold:current.reviewThreshold,source:'Current review threshold'};
 return {threshold:saved.reviewThreshold,source:'Threshold saved with this analysis'};
}
