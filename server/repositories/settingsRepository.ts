import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RuntimeSettings } from '../../shared/settings';
import { defaultSettings,validateSettings } from '../services/settingsService';
import { AppError } from '../services/errors';
export type SettingsStore={get:()=>Promise<RuntimeSettings>;save:(settings:RuntimeSettings)=>Promise<RuntimeSettings>};
export function settingsRepository(filename=path.resolve('config/runtime.settings.json')):SettingsStore {
 return {
  async get(){
   try{return validateSettings(JSON.parse(await readFile(filename,'utf8')));}
   catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return defaultSettings();throw new AppError(500,'SETTINGS_READ','Local settings could not be read. Check config/runtime.settings.json.');}
  },
  async save(value){
   const validated=validateSettings(value);const temp=`${filename}.${randomUUID()}.tmp`;
   try{await mkdir(path.dirname(filename),{recursive:true});await writeFile(temp,JSON.stringify(validated,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,filename);return validated;}
   catch{throw new AppError(500,'SETTINGS_WRITE','Settings could not be saved locally. Check workspace write permissions.');}
   finally{await unlink(temp).catch(()=>{});}
  }
 };
}
