// Remove recognizable personal sections, preserving all other text. Human review is required.
const personalHeading=/^(?:personal(?:\s+(?:information|details|data|profile))?|contact(?:\s+(?:information|details))?|contact me|demographics?|biographical(?:\s+(?:information|details))?|bio(?:\s*data)|private information|sensitive information|date of birth|nationality|citizenship|marital status|religion|ethnicity|political beliefs|medical history|health information|disability|home address|sexual orientation|gender identity)$/i;
// These are boundaries for plain-text sections, not an inclusion list.
const professionalHeading=/^(?:professional\s+|work\s+|employment\s+)?(?:experience|projects|technical skills|skills|education|certifications|open[ -]source(?: contributions)?|publications|summary|profile|objective|achievements|awards|references)$/i;
function heading(line:string):{label:string;depth:number}|null {
 const markdown=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
 const label=(markdown?.[2]??line.trim()).replace(/\s*:\s*$/,'').trim();
 if(markdown)return {label,depth:markdown[1].length};
 if(personalHeading.test(label)||professionalHeading.test(label)||(/^[\p{Lu}\d][\p{Lu}\d &/–—-]{2,}$/u.test(label)&&/\p{Lu}/u.test(label)))return {label,depth:1};
 return null;
}
const contactMarker=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|mailto:|(?:https?:\/\/)?(?:www\.)?linkedin\.com\/|\[linkedin\/|(?:^|\s)\+\d[\d ()-]{7,})/i;
export function normalizeResume(text:string){return text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/[\t ]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();}
export function suggestProfessionalEvidence(text:string){
 const lines=normalizeResume(text).split('\n');
 let start=0;
 // A leading name/contact block ends at the next section heading. Do not treat a
 // recognized professional heading as a name, even when its content has a link.
 const first=heading(lines[0]??'');
 const nameLike=first&&!personalHeading.test(first.label)&&!professionalHeading.test(first.label)&&/^[\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){1,5}$/u.test(first.label);
 if(!first||nameLike){
  const next=lines.findIndex((line,index)=>index>0&&heading(line)!==null);
  const end=next<0?lines.length:next;
  if(next>=0&&contactMarker.test(lines.slice(0,end).join('\n')))start=end;
 }
 const kept:string[]=[];
 let excludedDepth:number|null=null;
 for(const line of lines.slice(start)){
  const section=heading(line);
  if(section&&excludedDepth!==null&&section.depth<=excludedDepth)excludedDepth=null;
  if(section&&excludedDepth===null&&personalHeading.test(section.label))excludedDepth=section.depth;
  if(excludedDepth===null)kept.push(line);
 }
 return normalizeResume(kept.join('\n'));
}
export function assertProfessionalEvidence(text:string){
 // Catch explicit sensitive disclosures; this is a backstop, not automatic de-identification.
 const forbidden=/\b(date of birth|born on|nationality|citizenship|marital status|sexual orientation|religion|ethnicity|political beliefs|disability|medical history|home address|gender identity|race\s*:|pregnan\w*|age\s*:\s*\d|sex\s*:)\b/i;
 if(forbidden.test(text)||/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))throw new Error('Remove contact details and sensitive personal information from the professional evidence.');
}
