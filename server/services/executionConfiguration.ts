import {z} from 'zod';
import type {Dependencies} from '../routes/api';
import type {RuntimeSettings} from '../../shared/settings';
import {defaultConfiguration,normalized,validateScreeningConfiguration,configurationSchemaVersion,type ExecutionConfiguration} from '../../shared/screeningConfiguration';
import {resolveConfig} from './configService';
import {validateModelProfile} from './modelConfig';
import {AppError} from './errors';
const provenanceSchema=z.object({templateId:z.string().uuid(),templateName:z.string().min(1).max(120),templateRevision:z.number().int().positive(),appliedAt:z.string().datetime(),modifiedAfterApplication:z.boolean()}).strict();
export async function executionConfiguration(deps:Dependencies,saved:RuntimeSettings,raw?:unknown,provenance?:unknown){
 let settings=deps.models&&raw===undefined?await deps.models.snapshot(saved):structuredClone(saved);
 const configuration=raw===undefined?defaultConfiguration(saved.screeningConfig,saved.workflow.timezone,settings.inference):validateScreeningConfiguration(raw);
 if(raw!==undefined&&deps.models){
  const connection=(await deps.models.repository.list()).profiles.find(p=>p.id===configuration.model.profileId&&p.provider===configuration.model.provider);
  if(!connection?.enabled)throw new AppError(409,'TEMPLATE_MODEL_UNAVAILABLE','This configuration’s model connection is unavailable. Select an enabled model before screening.');
  const {profileId,...parameters}=configuration.model;
  const {credentialConfigured,credentialSource,...profile}=connection;
  settings={...settings,inference:validateModelProfile({...profile,...parameters,id:profileId})};
 }
 const config=resolveConfig(configuration.dimensions,new Date(),configuration.timezone);
 settings={...settings,screeningConfig:config,workflow:{...settings.workflow,timezone:configuration.timezone}};
 let source:ExecutionConfiguration['provenance'];
 if(provenance!==undefined){const p=provenanceSchema.safeParse(provenance);if(!p.success)throw new AppError(400,'INVALID_PROVENANCE','Template provenance is malformed. Apply the template again.');source=p.data;
  // Historical provenance remains usable after update/deletion. It never resolves execution settings.
  if(deps.templates){const template=await deps.templates.get(source.templateId).catch((e:unknown)=>{if(e instanceof AppError&&e.status===404)return null;throw e;});if(template?.revision===source.templateRevision)source={...source,templateName:template.name,modifiedAfterApplication:normalized(template.configuration)!==normalized(configuration)};}
 }
 const execution:ExecutionConfiguration={configuration:{...configuration,dimensions:config},configurationSchemaVersion,...(source?{provenance:source}:{})};
 return {settings,config,execution};
}
