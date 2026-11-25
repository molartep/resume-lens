import {z} from 'zod';
import type {ScreeningConfig} from './types';
import {modelTemplate,providerIds,type ModelProfile} from './models';
import {validateConfig} from './configValidation';
import {validateModelProfile} from './modelValidation';
import {AppError} from './errors';
export const configurationSchemaVersion=2;
// Connection URLs, credentials, organization and project stay in global settings.
export type ScreeningModel=Pick<ModelProfile,'provider'|'model'|'timeoutMs'|'maxOutputTokens'|'temperature'|'apiVersion'> & {profileId:string};
export type ScreeningConfiguration={dimensions:ScreeningConfig};
export type EvaluationConfiguration=ScreeningConfiguration & {model:ScreeningModel;timezone:string};
export type TemplateProvenance={templateId:string;templateName:string;templateRevision:number;appliedAt:string;modifiedAfterApplication:boolean};
export type ScreeningTemplate={id:string;name:string;description:string;configuration:ScreeningConfiguration;configurationSchemaVersion:number;revision:number;createdAt:string;updatedAt:string};
export type ExecutionConfiguration={configuration:EvaluationConfiguration;configurationSchemaVersion:number;provenance?:TemplateProvenance};
export function screeningModel(p:ModelProfile):ScreeningModel {const {id,provider,model,timeoutMs,maxOutputTokens,temperature,apiVersion}=p;return {profileId:id,provider,model,timeoutMs,maxOutputTokens,temperature,apiVersion};}
export function defaultConfiguration(dimensions:ScreeningConfig,timezone='America/New_York',profile=modelTemplate('local')):EvaluationConfiguration{return structuredClone({dimensions,model:screeningModel(profile),timezone});}
const evaluationSchema=z.object({dimensions:z.unknown(),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Use an IANA timezone.'),model:z.object({profileId:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),provider:z.enum(providerIds),model:z.string(),timeoutMs:z.number(),maxOutputTokens:z.number(),temperature:z.number().nullable(),apiVersion:z.string()}).strict()}).strict();
export function defaultTemplateConfiguration(dimensions:ScreeningConfig):ScreeningConfiguration{return structuredClone({dimensions});}
export function validateScreeningConfiguration(value:unknown,version=configurationSchemaVersion):ScreeningConfiguration {
 if(version!==configurationSchemaVersion)throw new AppError(400,'INCOMPATIBLE_CONFIGURATION','Unsupported template schema version. Run the database migrations before editing this template.');
 const parsed=z.object({dimensions:z.unknown()}).strict().safeParse(value);
 if(!parsed.success)throw new AppError(400,'INVALID_CONFIGURATION','Templates contain screening dimensions only. Model settings belong to the analysis.');
 try{return {dimensions:validateConfig(parsed.data.dimensions)};}catch(error){throw new AppError(400,'INVALID_CONFIGURATION',error instanceof Error?error.message:'Invalid screening configuration.');}
}
export function validateEvaluationConfiguration(value:unknown):EvaluationConfiguration {
 const parsed=evaluationSchema.safeParse(value);if(!parsed.success)throw new AppError(400,'INVALID_CONFIGURATION',parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));
 const c=parsed.data;const {profileId,...parameters}=c.model;
 const profile=validateModelProfile({...modelTemplate(parameters.provider,profileId),...parameters});
 return {...c,dimensions:validateScreeningConfiguration({dimensions:c.dimensions}).dimensions,model:screeningModel(profile)};
}
// Stable comparison does not depend on JSON object key insertion order.
export function normalized(value:unknown):string {function sort(v:unknown):unknown{if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sort(x)]));return v;}return JSON.stringify(sort(value));}
export function applyTemplate(template:ScreeningTemplate){return {configuration:structuredClone(validateScreeningConfiguration(template.configuration,template.configurationSchemaVersion)),provenance:{templateId:template.id,templateName:template.name,templateRevision:template.revision,appliedAt:new Date().toISOString(),modifiedAfterApplication:false} satisfies TemplateProvenance};}
