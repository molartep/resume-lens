import type {Dimension,ScreeningConfig} from './types';

// Older configurations may have structured instructions. Preserve their values
// when presenting and saving the simplified plain-text editor.
export function instructionsText(instructions:Dimension['instructions']):string {
 if(typeof instructions==='string')return instructions;
 function lines(value:unknown,prefix=''):string[] {
  if(value!==null&&typeof value==='object')return Object.entries(value).flatMap(([key,item])=>lines(item,[prefix,key==='question'?'':key.replace(/_/g,' ')].filter(Boolean).join(' / ')));
  return [`${prefix?prefix+': ':''}${value===null?'':String(value)}`];
 }
 return lines(instructions).join('\n');
}

export function dimensionId(label:string):string {
 return label.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'_').slice(0,128);
}

// IDs and display order are derived together from the visible list.
export function configFromList(dimensions:Dimension[]):ScreeningConfig {
 const entries: [string,Dimension][]=[];
 const used=new Set<string>();
 for(const [index,q] of dimensions.entries()){
  const base=dimensionId(q.label);
  if(!base||!/[a-z0-9]/.test(base))throw new Error('Each display label must contain a letter or number.');
  let id=base;let suffix=2;
  while(used.has(id)){const tail=`_${suffix++}`;id=`${base.slice(0,128-tail.length)}${tail}`;}
  used.add(id);entries.push([id,{...q,instructions:instructionsText(q.instructions),order:(index+1)*10}]);
 }
 return Object.fromEntries(entries);
}

export function reorder<T>(items:T[],from:number,to:number):T[] {
 if(from<0||to<0||from>=items.length||to>=items.length||from===to)return items;
 const next=[...items];const [item]=next.splice(from,1);next.splice(to,0,item);return next;
}

export function dimensionJson(q:Dimension):string {
 const {order,...editable}=q;
 return JSON.stringify({...editable,instructions:instructionsText(q.instructions)},null,2);
}

export function parseDimensionJson(text:string,order:number):Dimension {
 let value;try{value=JSON.parse(text);}catch{throw new Error('Enter valid JSON. Check commas, quotes and braces.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.label!=='string'||!['noul','choice','score'].includes(value.type))throw new Error('Use a dimension JSON object with a display label and valid question type.');
 if(typeof value.instructions!=='string'&&(!value.instructions||typeof value.instructions!=='object'||Array.isArray(value.instructions)))throw new Error('Instructions must be text or a JSON object.');
 if(value.type==='score'&&(!Array.isArray(value.criteria)||!value.criteria.every((v:unknown)=>typeof v==='string')))throw new Error('Score criteria must be an array of text levels.');
 if((value.type==='choice'||value.type==='noul'&&value.criteria!==undefined)&&(!value.criteria||typeof value.criteria!=='object'||Array.isArray(value.criteria)||!Object.values(value.criteria).every(v=>typeof v==='string')))throw new Error('Category criteria must be a JSON object with text descriptions.');
 if(value.categoryLabels!==undefined&&(!value.categoryLabels||typeof value.categoryLabels!=='object'||Array.isArray(value.categoryLabels)||!Object.values(value.categoryLabels).every(v=>typeof v==='string')))throw new Error('Category labels must be a JSON object with text labels.');
 const threshold=value.reviewThreshold;
 if(threshold!==undefined&&(!threshold||typeof threshold!=='object'||Array.isArray(threshold)||!['yes_probability','top_probability','category_probability','expected_score','confidence'].includes(threshold.metric)||!['below','above'].includes(threshold.operator)||typeof threshold.value!=='number'||!Number.isFinite(threshold.value)||threshold.category!==undefined&&typeof threshold.category!=='string'))throw new Error('Review threshold needs a valid metric, below/above operator and numeric value.');
 return {...value,instructions:instructionsText(value.instructions),order} as Dimension;
}
