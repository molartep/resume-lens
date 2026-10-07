import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,copyFile,unlink,readdir,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {AppError} from './errors';

export function resumeFileStore(root=path.resolve('storage/resumes')){
 const drafts=path.join(root,'.drafts');
 function filename(key:string,draft=false){if(!/^[0-9a-f-]{36}\.pdf$/.test(key))throw new AppError(404,'PDF_NOT_FOUND','Resume PDF not found.');return path.join(draft?drafts:root,key);}
 async function remove(file:string){try{await unlink(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
 return {
  async stage(pdf:Buffer){const key=`${randomUUID()}.pdf`;try{await mkdir(drafts,{recursive:true,mode:0o700});await writeFile(filename(key,true),pdf,{mode:0o600,flag:'wx'});return key;}catch{await remove(filename(key,true)).catch(()=>{});throw new AppError(500,'PDF_STORAGE_ERROR','The uploaded PDF could not be stored locally. Check the storage folder permissions and available disk space.');}},
  async retain(key:string){try{await copyFile(filename(key,true),filename(key),constants.COPYFILE_EXCL);}catch{throw new AppError(500,'PDF_STORAGE_ERROR','The resume PDF could not be saved locally. Check the storage folder permissions and available disk space.');}},
  discardDraft:(key:string)=>remove(filename(key,true)),
  discardSaved:(key:string)=>remove(filename(key)),
  async storedPath(key:string){const file=filename(key);try{await stat(file);}catch{throw new AppError(404,'PDF_NOT_FOUND','The saved resume PDF is unavailable. Upload it again to create a new analysis.');}return file;},
  async cleanupDrafts(){await mkdir(drafts,{recursive:true,mode:0o700});for(const key of await readdir(drafts)){if(!/^[0-9a-f-]{36}\.pdf$/.test(key))continue;const file=filename(key,true);try{const info=await stat(file);if(info.mtimeMs<Date.now()-60*60*1000)await remove(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}}
 };
}
export type ResumeFileStore=ReturnType<typeof resumeFileStore>;
