import {it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,rm,utimes,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {resumeFileStore} from '../server/services/resumeFileService';
it('retains the original bytes across store instances without keeping a completed draft',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-pdf-'));
 try{const files=resumeFileStore(dir);const bytes=Buffer.from('%PDF-1.7\noriginal bytes');const key=await files.stage(bytes);await files.retain(key);await files.discardDraft(key);expect(await readdir(path.join(dir,'.drafts'))).toEqual([]);const file=await resumeFileStore(dir).storedPath(key);expect(await readFile(file)).toEqual(bytes);expect((await stat(file)).mode&0o777).toBe(0o600);expect(file).not.toContain('candidate');}
 finally{await rm(dir,{recursive:true,force:true});}
});
it('cleans abandoned draft PDFs without deleting completed resumes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-pdf-'));
 try{const files=resumeFileStore(dir);const old=await files.stage(Buffer.from('%PDF-old'));const recent=await files.stage(Buffer.from('%PDF-new'));await files.retain(old);const time=new Date(Date.now()-61*60*1000);await utimes(path.join(dir,'.drafts',old),time,time);await files.cleanupDrafts();expect(await readdir(path.join(dir,'.drafts'))).toEqual([recent]);expect(await files.storedPath(old)).toBe(path.join(dir,old));await files.discardDraft(recent);await files.discardSaved(old);await expect(files.storedPath(old)).rejects.toThrow('unavailable');}
 finally{await rm(dir,{recursive:true,force:true});}
});
it('blocks path traversal and can roll back a retained copy while preserving the retry draft',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'resume-pdf-'));
 try{const files=resumeFileStore(dir);const key=await files.stage(Buffer.from('%PDF-retry'));await files.retain(key);await files.discardSaved(key);await files.retain(key);expect(await readFile(await files.storedPath(key),'utf8')).toBe('%PDF-retry');await expect(files.storedPath('../private.pdf')).rejects.toThrow('not found');await expect(files.storedPath('00000000-0000-4000-8000-000000000000.pdf')).rejects.toThrow('unavailable');}
 finally{await rm(dir,{recursive:true,force:true});}
});
