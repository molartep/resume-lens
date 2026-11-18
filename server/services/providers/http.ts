import {AppError} from '../errors';
export async function providerRequest(url:string,options:RequestInit,timeoutMs:number):Promise<any>{
 try{
  const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok){
   if(response.status===401||response.status===403)throw new AppError(502,'MODEL_AUTH','Provider authentication failed. Ask an administrator to check the API key, permissions and project.');
   if(response.status===429||response.status===503){const retry=response.headers.get('retry-after');const delay=retry?(/^\d+(\.\d+)?$/.test(retry)?Number(retry)*1000:Date.parse(retry)-Date.now()):60000;throw new AppError(503,'MODEL_RATE_LIMIT','The provider is rate-limited or temporarily unavailable. Wait before retrying.',Number.isFinite(delay)?Math.min(900000,Math.max(60000,delay)):60000);}
   throw new AppError(502,'MODEL_REQUEST',response.status===400||response.status===404||response.status===422?'The provider rejected this model, API version, schema or parameter configuration. Check its official documentation.':'The provider could not complete the review. Retry later.');
  }
  // Bounded response parsing; error bodies are never echoed or persisted.
  if(Number(response.headers.get('content-length')||0)>8*1024*1024)throw new AppError(502,'MODEL_RESPONSE_LIMIT','The provider response exceeds the supported size.');
  const reader=response.body?.getReader();if(!reader)throw new AppError(502,'MODEL_EMPTY','The provider returned an empty response.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw new AppError(502,'MODEL_RESPONSE_LIMIT','The provider response exceeds the supported size.');}chunks.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(502,'MODEL_INVALID_JSON','The provider returned invalid JSON.');}
 }catch(error){if(error instanceof AppError)throw error;if(error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError'))throw new AppError(504,'MODEL_TIMEOUT','The provider request timed out. Processing may continue remotely; wait before retrying.');throw new AppError(503,'MODEL_CONNECTION','The provider could not be reached. Check its connection settings and network availability.');}
}
