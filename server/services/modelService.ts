import type {ModelRepository} from '../repositories/modelRepository';
import type {RuntimeSettings} from '../../shared/settings';
import type {ScreeningConfig,Screening} from '../../shared/types';
import type {ModelProfile} from '../../shared/models';
import {validateModelProfile} from './modelConfig';
import {defaultSettings} from './settingsService';
import {analyzeWithDecider,checkDeciderHealth} from './deciderService';
import {analyzeHosted,authHeaders} from './providers/adapters';
import {providerRequest} from './providers/http';
import {AppError} from './errors';
export function modelService(repository:ModelRepository){
 async function profile(settings?:RuntimeSettings){return validateModelProfile(settings?.inference??await repository.active());}
 return {repository,
  async snapshot(settings:RuntimeSettings){return {...settings,inference:await profile()};},
  async health(settings?:RuntimeSettings){let p:ModelProfile|undefined;try{p=await profile(settings);if(!p.enabled)return {online:false,model:p.model,provider:p.provider};if(p.provider==='local')return {...await checkDeciderHealth(settings,p.baseUrl),provider:p.provider};await repository.key(p);return {online:true,model:p.model,provider:p.provider,status:'ready' as const};}catch{return {online:false,model:p?.model,provider:p?.provider};}},
  async decide(text:string,config:ScreeningConfig,settings:RuntimeSettings=defaultSettings()):Promise<{screening:Screening;latencyMs:number}>{
   const p=await profile(settings);if(!p.enabled)throw new AppError(409,'MODEL_DISABLED','This job’s model connection is disabled.');
   if(p.provider==='local'){const result=await analyzeWithDecider(text,config,{...settings,decider:{...settings.decider,timeoutMs:p.timeoutMs}},p.baseUrl);return {...result,screening:{...result.screening,provider:p.provider,profileId:p.id,probabilitySource:'native-distributions'}};}
   return analyzeHosted(text,config,p,await repository.key(p));
  },
  async test(p:ModelProfile){p=validateModelProfile(p);if(p.provider==='local'){const result=await checkDeciderHealth(defaultSettings(),p.baseUrl);if(!result.online)throw new AppError(503,'MODEL_OFFLINE','Local Decider did not pass its health check.');return {ok:true,model:result.model};}
   const prefix=p.provider==='gemini'?`/${p.apiVersion}/models/`:p.provider==='groq'?'/openai/v1/models/':'/v1/models/';
   await providerRequest(`${p.baseUrl}${prefix}${encodeURIComponent(p.model)}`,{headers:authHeaders(p,await repository.key(p))},Math.min(p.timeoutMs,15000));return {ok:true,model:p.model};
  }
 };
}
export type ModelService=ReturnType<typeof modelService>;
