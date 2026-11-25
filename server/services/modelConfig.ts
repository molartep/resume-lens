import {modelTemplate,providerIds,type ProviderId} from '../../shared/models';
export const keyEnvironment:Record<ProviderId,string>={local:'','openai-decisions':'OPENAI_API_KEY',gemini:'GEMINI_API_KEY',anthropic:'ANTHROPIC_API_KEY',groq:'GROQ_API_KEY'};
import {validateModelProfile} from '../../shared/modelValidation';
export {validateModelProfile} from '../../shared/modelValidation';
export function initialModels(){const local=modelTemplate('local');local.baseUrl=process.env.STRANDS_DECIDER_URL||local.baseUrl;return {activeProfileId:local.id,entries:providerIds.map(provider=>({profile:validateModelProfile(provider==='local'?local:modelTemplate(provider)),apiKey:undefined as string|undefined}))};}
