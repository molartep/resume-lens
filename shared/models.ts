export const providerIds=['local','openai-decisions','gemini','anthropic','groq'] as const;
export type ProviderId=typeof providerIds[number];
export type ModelProfile={
 id:string;name:string;provider:ProviderId;model:string;enabled:boolean;baseUrl:string;
 timeoutMs:number;maxOutputTokens:number;temperature:number|null;
 organization:string;project:string;apiVersion:string;
};
export type ModelConnection=ModelProfile & {credentialConfigured:boolean;credentialSource:'stored'|'environment'|'none'};
export type ModelCatalog={activeProfileId:string;profiles:ModelConnection[];adminConfigured:boolean;adminAuthenticated:boolean};
export const providerNames:Record<ProviderId,string>={local:'Local Strands Decider','openai-decisions':'OpenAI Decisions',gemini:'Google Gemini',anthropic:'Anthropic Claude',groq:'Groq'};
export const providerOrigins:Record<ProviderId,string>={local:'http://127.0.0.1:1209','openai-decisions':'https://api.openai.com',gemini:'https://generativelanguage.googleapis.com',anthropic:'https://api.anthropic.com',groq:'https://api.groq.com'};
export function modelTemplate(provider:ProviderId,id:string=provider):ModelProfile{
 return {id,name:providerNames[provider],provider,enabled:provider==='local',model:{local:'server-managed','openai-decisions':'gpt-6-luna',gemini:'gemini-3.8-flash',anthropic:'claude-sonnet-4-6',groq:'openai/gpt-oss-20b'}[provider],baseUrl:providerOrigins[provider],timeoutMs:120000,maxOutputTokens:8192,temperature:null,organization:'',project:'',apiVersion:provider==='anthropic'?'2026-10-21':provider==='gemini'?'v1beta':'v1'};
}
