import {usesGeminiDecisions} from '../../../shared/models';
import {geminiDecisionsRequest,normalizeGeminiDecisions} from './geminiDecisions';
import type {ModelProfile} from '../../../shared/models';
import type {Screening,ScreeningConfig} from '../../../shared/types';
import {providerRequest} from './http';
import {decisionsRequest,normalizeDecisions,outputSchema,evaluationPrompt,normalizeGenerated,refused,invalid} from './protocol';
export function authHeaders(p:ModelProfile,key:string):Record<string,string>{
 if(p.provider==='gemini')return {'x-goog-api-key':key};
 if(p.provider==='anthropic')return {'x-api-key':key,'anthropic-version':p.apiVersion};
 return {Authorization:`Bearer ${key}`,...(p.provider==='openai-decisions'&&p.organization?{'OpenAI-Organization':p.organization}:{}),...(p.provider==='openai-decisions'&&p.project?{'OpenAI-Project':p.project}:{})};
}
export async function analyzeHosted(text:string,config:ScreeningConfig,p:ModelProfile,key:string):Promise<{screening:Screening;latencyMs:number}>{
 const started=performance.now();const headers={'Content-Type':'application/json',...authHeaders(p,key)};
 let raw:any;let result:Screening;
 if(usesGeminiDecisions(p)){
  raw=await providerRequest(`${p.baseUrl}/${p.apiVersion}/decisions`,{method:'POST',headers,body:JSON.stringify(geminiDecisionsRequest(text,config,p))},p.timeoutMs);result=normalizeGeminiDecisions(raw,p,config);
 }else if(p.provider==='openai-decisions'){
  raw=await providerRequest(`${p.baseUrl}/v1/decisions`,{method:'POST',headers,body:JSON.stringify(decisionsRequest(text,config,p))},p.timeoutMs);result=normalizeDecisions(raw,p,config);
 }else{
  const prompt=evaluationPrompt(text,config);const schema=outputSchema(config);let url:string;let body:unknown;
  const temperature=p.temperature===null?{}:{temperature:p.temperature};
  if(p.provider==='gemini'){
   url=`${p.baseUrl}/${p.apiVersion}/models/${encodeURIComponent(p.model)}:generateContent`;
   body={systemInstruction:{parts:[{text:prompt.system}]},contents:[{role:'user',parts:[{text:prompt.user}]}],generationConfig:{maxOutputTokens:p.maxOutputTokens,...temperature,responseMimeType:'application/json',responseJsonSchema:schema}};
  }else if(p.provider==='anthropic'){
   url=`${p.baseUrl}/v1/messages`;body={model:p.model,max_tokens:p.maxOutputTokens,...temperature,system:prompt.system,messages:[{role:'user',content:prompt.user}],output_config:{format:{type:'json_schema',schema}}};
  }else if(p.provider==='groq'){
   url=`${p.baseUrl}/openai/v1/chat/completions`;body={model:p.model,max_completion_tokens:p.maxOutputTokens,...temperature,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],response_format:{type:'json_schema',json_schema:{name:'resume_screening',strict:true,schema}}};
  }else throw invalid();
  raw=await providerRequest(url,{method:'POST',headers,body:JSON.stringify(body)},p.timeoutMs);
  let jsonText:string;let usage:Screening['usage'];
  if(p.provider==='gemini'){
   if(raw.promptFeedback?.blockReason||raw.candidates?.some((c:any)=>['SAFETY','RECITATION','PROHIBITED_CONTENT','BLOCKLIST'].includes(c.finishReason)))throw refused();
   const c=raw.candidates?.[0];if(c?.finishReason!=='STOP')throw invalid();jsonText=c.content?.parts?.filter((x:any)=>typeof x.text==='string'&&!x.thought).map((x:any)=>x.text).join('');
   if(raw.usageMetadata)usage={input_tokens:raw.usageMetadata.promptTokenCount??0,output_tokens:(raw.usageMetadata.candidatesTokenCount??0)+(raw.usageMetadata.thoughtsTokenCount??0)};
  }else if(p.provider==='anthropic'){
   if(raw.stop_reason==='refusal'||raw.content?.some((b:any)=>b.type==='refusal'))throw refused();if(raw.stop_reason!=='end_turn')throw invalid();jsonText=raw.content?.filter((x:any)=>x.type==='text').map((x:any)=>x.text).join('');
   if(raw.usage)usage={input_tokens:(raw.usage.input_tokens??0)+(raw.usage.cache_creation_input_tokens??0)+(raw.usage.cache_read_input_tokens??0),output_tokens:raw.usage.output_tokens??0};
  }else{
   const c=raw.choices?.[0];if(c?.message?.refusal||c?.finish_reason==='content_filter')throw refused();if(c?.finish_reason!=='stop')throw invalid();jsonText=c.message?.content;if(raw.usage)usage={input_tokens:raw.usage.prompt_tokens,output_tokens:raw.usage.completion_tokens};
  }
  let bodyResult:unknown;try{bodyResult=JSON.parse(jsonText!);}catch{throw invalid();}result=normalizeGenerated(bodyResult,raw,p,config,usage);
 }
 return {screening:result,latencyMs:performance.now()-started};
}
