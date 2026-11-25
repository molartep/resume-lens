import type {TemplateReference as Reference} from '../../shared/analysisHistory';
export function TemplateReference({template}:{template?:Reference|null}){
 return <span className="template-reference">{template?<><span>{template.templateName}</span><small>Revision {template.templateRevision}</small></>:<span className="unrecorded-template">Template not recorded</span>}</span>;
}
