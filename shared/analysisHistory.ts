import type {TemplateProvenance} from './screeningConfiguration';
export type TemplateReference=Pick<TemplateProvenance,'templateId'|'templateName'|'templateRevision'>;
export type AnalysisHistoryItem={
 id:string;candidateId:string;candidateName:string|null;resumeFilename:string|null;
 analyzedAt:string;template:TemplateReference|null;model:string;provider:string|null;
};
export type AnalysisHistoryPage={items:AnalysisHistoryItem[];total:number;page:number;pageSize:number};
export function analysisHref(id:string){return `#analyses/${encodeURIComponent(id)}`;}
export function analysisIdFromHash(hash:string){const match=/^#analyses\/([^/?#]+)$/.exec(hash);if(!match)return null;try{return decodeURIComponent(match[1]);}catch{return null;}}
