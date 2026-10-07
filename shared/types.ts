export type Content = string | Record<string, unknown>;
export type ReviewThreshold = {metric:'yes_probability'|'top_probability'|'category_probability'|'expected_score'|'confidence';operator:'below'|'above';value:number;category?:string};
type Base = { label: string; order: number; instructions: Content; reviewThreshold?:ReviewThreshold; categoryLabels?: Record<string,string> };
export type Dimension = Base & (
  { type:'noul'; criteria?: {true?:string; false?:string} } |
  { type:'choice'; criteria: Record<string,string> } |
  { type:'score'; criteria:string[] }
);
export type ScreeningConfig = Record<string, Dimension>;
export type Answer = {type:'noul'; noul:number} | {type:'choice'; choice:string; probabilities:Record<string,number>; confidence:number} | {type:'score'; score:number; legend:Record<string,string>; probabilities:Record<string,number>; confidence:number};
export type Screening = {model:string; answers:Record<string,Answer>; usage?:{input_tokens:number;output_tokens:number}; latency_ms?:number; [key:string]:unknown};
export type Analysis = {id:string; candidateId:string; resumeDocumentId?:string|null; resumeFilename?:string|null; resumePdfKey?:string|null; parsedResumeText:string; screeningResumeText:string; screeningResults:Screening; screeningConfigSnapshot:ScreeningConfig; analyzedAt:string; deciderLatencyMs:number|null; parserMetadata:unknown};
export type Candidate = {id:string;name:string|null;resumeFilename:string;createdAt:string;updatedAt:string;analyses?:Analysis[]};
export type ParsedResume = {text:string;metadata:{jobId:string;pageCount:number;provider:string;settings?:unknown}};

export type SavedResume={id:string;filename:string;createdAt:string;candidate:{id:string;name:string|null}|null};
