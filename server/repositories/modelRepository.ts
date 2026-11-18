import {readFile,writeFile,rename,unlink,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {ModelProfile,ModelConnection,ProviderId} from '../../shared/models';
import {keyEnvironment,initialModels,validateModelProfile} from '../services/modelConfig';
import {AppError} from '../services/errors';
type Document={activeProfileId:string;entries:{profile:ModelProfile;apiKey?:string}[]};
export function modelRepository(filename=path.resolve('config/model-connections.json')){
 let writes:Promise<unknown>=Promise.resolve();
 async function read():Promise<Document>{
  try{const raw=JSON.parse(await readFile(filename,'utf8'));if(!Array.isArray(raw.entries)||typeof raw.activeProfileId!=='string')throw new Error();
   const entries=raw.entries.map((entry:any)=>{if(entry.apiKey!==undefined&&(typeof entry.apiKey!=='string'||/[\r\n]/.test(entry.apiKey)))throw new Error();return {profile:validateModelProfile(entry.profile),apiKey:entry.apiKey};});
   if(new Set(entries.map((e:any)=>e.profile.id)).size!==entries.length||!entries.some((e:any)=>e.profile.id===raw.activeProfileId))throw new Error();return {activeProfileId:raw.activeProfileId,entries};
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return initialModels();throw new AppError(500,'MODEL_STORAGE','Model configuration could not be read. Check the server configuration file.');}
 }
 async function write(doc:Document){const temporary=`${filename}.${randomUUID()}.tmp`;try{await mkdir(path.dirname(filename),{recursive:true,mode:0o700});await writeFile(temporary,JSON.stringify(doc,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,filename);}catch{throw new AppError(500,'MODEL_STORAGE','Model configuration could not be saved. Check server storage permissions.');}finally{await unlink(temporary).catch(()=>{});}}
 function mutate<T>(fn:(doc:Document)=>Promise<T>){const next=writes.then(async()=>fn(await read()));writes=next.catch(()=>{});return next;}
 function credential(entry:Document['entries'][number]){return entry.apiKey||process.env[keyEnvironment[entry.profile.provider]]||undefined;}
 function publicEntry(entry:Document['entries'][number]):ModelConnection{return {...entry.profile,credentialConfigured:entry.profile.provider==='local'||Boolean(credential(entry)),credentialSource:entry.apiKey?'stored':process.env[keyEnvironment[entry.profile.provider]]?'environment':'none'};}
 return {
  async list(){const doc=await read();return {activeProfileId:doc.activeProfileId,profiles:doc.entries.map(publicEntry)};},
  async active(){const doc=await read();const e=doc.entries.find(e=>e.profile.id===doc.activeProfileId);if(!e?.profile.enabled)throw new AppError(409,'MODEL_DISABLED','Select an enabled analysis model in Settings.');return structuredClone(e.profile);},
  async key(profile:ModelProfile){const e=(await read()).entries.find(e=>e.profile.id===profile.id&&e.profile.provider===profile.provider);if(!e)throw new AppError(409,'MODEL_REMOVED','The queued model connection was removed. Restore it before retrying.');const key=credential(e);if(!key)throw new AppError(409,'MODEL_KEY_MISSING','An administrator must configure this model’s API key in Settings.');return key;},
  save(profile:ModelProfile,key?:string|null){return mutate(async doc=>{
   const p=validateModelProfile(profile);const old=doc.entries.find(e=>e.profile.id===p.id);
   if(old&&old.profile.provider!==p.provider)throw new AppError(409,'PROVIDER_IMMUTABLE','Create a new connection to change providers.');
   if(key!==undefined&&key!==null&&(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key)))throw new AppError(400,'INVALID_API_KEY','Enter a non-empty, single-line API key.');
   const next={profile:p,apiKey:key===null?undefined:key?.trim()??old?.apiKey};
   if(old)doc.entries[doc.entries.indexOf(old)]=next;else{if(doc.entries.length>=30)throw new AppError(409,'MODEL_LIMIT','At most 30 model connections are supported.');doc.entries.push(next);}
   await write(doc);return publicEntry(next);
  });},
  select(id:string){return mutate(async doc=>{const e=doc.entries.find(e=>e.profile.id===id);if(!e?.profile.enabled)throw new AppError(400,'MODEL_UNAVAILABLE','Choose an enabled model connection.');if(e.profile.provider!=='local'&&!credential(e))throw new AppError(409,'MODEL_KEY_MISSING','Configure credentials before selecting this model.');doc.activeProfileId=id;await write(doc);return publicEntry(e);});},
  remove(id:string){return mutate(async doc=>{if(id===doc.activeProfileId)throw new AppError(409,'MODEL_ACTIVE','Select another model before removing this connection.');doc.entries=doc.entries.filter(e=>e.profile.id!==id);await write(doc);});}
 };
}
export type ModelRepository=ReturnType<typeof modelRepository>;
