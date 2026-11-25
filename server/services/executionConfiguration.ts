import {z} from 'zod';
import type {Dependencies} from '../routes/api';
import type {RuntimeSettings} from '../../shared/settings';
import {defaultConfiguration,normalized,validateEvaluationConfiguration,configurationSchemaVersion,type ExecutionConfiguration} from '../../shared/screeningConfiguration';
import {resolveConfig} from './configService';
import {validateModelProfile} from './modelConfig';
import {AppError} from './errors';
const provenanceSchema=z.object({templateId:z.string().uuid(),templateName:z.string().min(1).max(120),templateRevision:z.number().int().positive(),appliedAt:z.string().datetime(),modifiedAfterApplication:z.boolean()}).strict();
export async function executionConfiguration(deps:Dependencies,saved:RuntimeSettings,raw?:unknown,provenance?:unknown){
 let source:ExecutionConfiguration['provenance'];
 if(provenance!==undefined){const p=provenanceSchema.safeParse(provenance);if(!p.success)throw new AppError(400,'INVALID_PROVENANCE','Template provenance is malformed. Select a screening template again.');source=p.data;}
 if(deps.templates&&!source)throw new AppError(400,'TEMPLATE_REQUIRED','Select a screening template before starting an analysis.');
 let settings=deps.models&&raw===undefined?await deps.models.snapshot(saved):structuredClone(saved);
 const configuration=raw===undefined?defaultConfiguration(saved.screeningConfig,saved.workflow.timezone,settings.inference):validateEvaluationConfiguration(raw);
 if(deps.templates&&source){
  const template=await deps.templates.get(source.templateId);
  if(template.revision!==source.templateRevision)throw new AppError(409,'TEMPLATE_CONFLICT','This template has changed. Reload the latest template before starting the analysis.');
  if(normalized(template.configuration.dimensions)!==normalized(configuration.dimensions))throw new AppError(400,'TEMPLATE_CONFIGURATION_MISMATCH','Save dimension changes in Screening Templates, then select that template for analysis.');
  source={...source,templateName:template.name,modifiedAfterApplication:false};
 }
 if(raw!==undefined&&deps.models){
  const connection=(await deps.models.repository.list()).profiles.find(p=>p.id===configuration.model.profileId&&p.provider===configuration.model.provider);
  if(!connection?.enabled)throw new AppError(409,'MODEL_UNAVAILABLE','This analysis model connection is unavailable. Select an enabled model before screening.');
  const {profileId,...parameters}=configuration.model;
  const {credentialConfigured,credentialSource,...profile}=connection;
  settings={...settings,inference:validateModelProfile({...profile,...parameters,id:profileId})};
 }
 // Timezone is an application setting, never a template or per-analysis override.
 const timezone=saved.workflow.timezone;
 const config=resolveConfig(configuration.dimensions,new Date(),timezone);
 settings={...settings,screeningConfig:config};
 const execution:ExecutionConfiguration={configuration:{...configuration,timezone,dimensions:config},configurationSchemaVersion,...(source?{provenance:source}:{})};
 return {settings,config,execution};
}
