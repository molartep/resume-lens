import {z} from 'zod';
import {providerIds,usesGeminiDecisions,type ModelProfile,type ProviderId} from './models';
import {AppError} from './errors';
const schema=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),name:z.string().trim().min(1).max(120),provider:z.enum(providerIds),model:z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/),enabled:z.boolean(),baseUrl:z.string().url(),timeoutMs:z.number().int().min(1000).max(600000),maxOutputTokens:z.number().int().min(256).max(65536),temperature:z.number().min(0).max(2).nullable(),organization:z.string().trim().max(200).regex(/^[\w-]*$/),project:z.string().trim().max(200).regex(/^[\w-]*$/),apiVersion:z.string().trim().max(40)}).strict();
export function validateModelProfile(value:unknown):ModelProfile{
 const result=schema.safeParse(value);if(!result.success)throw new AppError(400,'INVALID_MODEL_PROFILE','Model profile contains invalid fields or parameter values.');
 const p=result.data;let u:URL;try{u=new URL(p.baseUrl);}catch{throw new AppError(400,'INVALID_MODEL_URL','Invalid provider URL.');}
 const origins:Record<Exclude<ProviderId,'local'>,string[]>={'openai-decisions':['https://api.openai.com','https://eu.api.openai.com'],gemini:['https://generativelanguage.googleapis.com'],anthropic:['https://api.anthropic.com'],groq:['https://api.groq.com']};
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(p.provider==='local'?(u.protocol!=='http:'||u.hostname!=='127.0.0.1'):!origins[p.provider].includes(u.origin)))throw new AppError(400,'INVALID_MODEL_URL','Use the official provider origin, or a loopback HTTP origin for local Decider. Paths, queries and credentials are not allowed.');
 if(p.provider==='anthropic'&&!/^\d{4}-\d{2}-\d{2}$/.test(p.apiVersion))throw new AppError(400,'INVALID_MODEL_PROFILE','Anthropic requires a dated API version.');
 if(p.provider==='gemini'&&!['v1','v1beta'].includes(p.apiVersion))throw new AppError(400,'INVALID_MODEL_PROFILE','Gemini API version must be v1 or v1beta.');
 if(p.provider==='anthropic'&&p.apiVersion>='2026-10-21'&&p.temperature!==null)throw new AppError(400,'UNSUPPORTED_PARAMETER','This Anthropic API version does not accept temperature. Leave it blank.');
 if(p.provider==='gemini'&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p.model))throw new AppError(400,'INVALID_MODEL_PROFILE','Enter a Gemini model ID without the models/ prefix.');
 if(usesGeminiDecisions(p)&&(p.apiVersion!=='v1beta'||p.temperature!==null))throw new AppError(400,'UNSUPPORTED_PARAMETER','Gemini Decision 1 requires API version v1beta and no temperature setting.');
 if(p.provider==='openai-decisions'&&(p.temperature!==null))throw new AppError(400,'UNSUPPORTED_PARAMETER','Decisions does not accept a temperature setting.');
 return {...p,baseUrl:u.origin};
}
