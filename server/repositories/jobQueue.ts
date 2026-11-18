import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import type {Job} from '../../shared/jobs';
import {AppError} from '../services/errors';

type Row=Job & {payload:string;checkpoint:string|null;owner:string|null;leaseUntil:number;dedupeKey:string|null};
const leaseMs=120_000;
// Each mutation is a single SQLite statement or an IMMEDIATE transaction. Multiple
// workers can share this file, but only one provider operation runs at a time.
export class JobQueue {
 private db:DatabaseSync;
 constructor(filename:string){
  this.db=new DatabaseSync(filename);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','processing','completed','failed')),
    progress INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    maxAttempts INTEGER NOT NULL DEFAULT 3, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
    retryAt INTEGER NOT NULL DEFAULT 0, error TEXT, result TEXT, payload TEXT NOT NULL,
    checkpoint TEXT, owner TEXT, leaseUntil INTEGER NOT NULL DEFAULT 0, dedupeKey TEXT UNIQUE);
   CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status,createdAt);
   CREATE TABLE IF NOT EXISTS review_drafts (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);`);
 }
 private row(id:string){return this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as unknown as Row|undefined;}
 get(id:string):Job{
  const row=this.row(id);if(!row)throw new AppError(404,'JOB_NOT_FOUND','Job not found.');
  const {payload,checkpoint,owner,leaseUntil,dedupeKey,...job}=row;
  return {...job,error:row.error?JSON.parse(String(row.error)):null,result:row.result?JSON.parse(String(row.result)):null};
 }
 findByKey(key:string){const row=this.db.prepare('SELECT id FROM jobs WHERE dedupeKey=?').get(key) as {id:string}|undefined;return row?this.get(row.id):undefined;}
 pendingParses(){return Number((this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind='parse' AND status IN ('queued','processing')").get() as {count:number}).count);}
 deleteDraft(id:string){this.db.prepare('DELETE FROM review_drafts WHERE id=?').run(id);}
 list(){return (this.db.prepare('SELECT id FROM jobs ORDER BY createdAt DESC LIMIT 50').all() as {id:string}[]).map(({id})=>this.get(id));}
 enqueue(kind:Job['kind'],payload:unknown,dedupeKey?:string){
  const id=randomUUID(),now=Date.now();
  this.db.prepare(`INSERT INTO jobs(id,kind,status,message,createdAt,updatedAt,payload,dedupeKey)
   VALUES(?,?,'queued','Waiting for worker',?,?,?,?) ON CONFLICT(dedupeKey) DO NOTHING`).run(id,kind,now,now,JSON.stringify(payload),dedupeKey??null);
  const actual=dedupeKey?(this.db.prepare('SELECT id FROM jobs WHERE dedupeKey=?').get(dedupeKey) as {id:string}).id:id;
  return this.get(actual);
 }
 claim(){
  const now=Date.now();this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare(`UPDATE jobs SET status='failed',message='Worker interrupted',error=?,retryAt=?,owner=NULL,updatedAt=? WHERE status='processing' AND leaseUntil<?`).run(JSON.stringify({code:'WORKER_INTERRUPTED',message:'Processing was interrupted. Retry this job to resume.'}),now+60_000,now,now);
   const active=this.db.prepare("SELECT id FROM jobs WHERE status='processing' LIMIT 1").get();
   const next=active?undefined:this.db.prepare("SELECT id FROM jobs WHERE status='queued' ORDER BY createdAt,id LIMIT 1").get() as {id:string}|undefined;
   if(!next){this.db.exec('COMMIT');return null;}
   const owner=randomUUID();
   this.db.prepare("UPDATE jobs SET status='processing',progress=5,message='Starting',attempts=attempts+1,owner=?,leaseUntil=?,updatedAt=? WHERE id=?").run(owner,now+leaseMs,now,next.id);
   const row=this.row(next.id)!;this.db.exec('COMMIT');
   return {id:row.id,kind:row.kind,owner,payload:JSON.parse(row.payload),checkpoint:row.checkpoint?JSON.parse(row.checkpoint):null};
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 heartbeat(id:string,owner:string){return this.db.prepare("UPDATE jobs SET leaseUntil=? WHERE id=? AND owner=? AND status='processing' AND leaseUntil>?").run(Date.now()+leaseMs,id,owner,Date.now()).changes===1;}
 update(id:string,owner:string,progress:number,message:string,checkpoint?:unknown){
  const changed=this.db.prepare(`UPDATE jobs SET progress=?,message=?,checkpoint=COALESCE(?,checkpoint),updatedAt=? WHERE id=? AND owner=? AND status='processing' AND leaseUntil>?`).run(progress,message,checkpoint===undefined?null:JSON.stringify(checkpoint),Date.now(),id,owner,Date.now()).changes;
  if(!changed)throw new Error('Job lease lost');
 }
 finish(id:string,owner:string,result:unknown){
  const changed=this.db.prepare("UPDATE jobs SET status='completed',progress=100,message='Completed',result=?,error=NULL,payload='{}',checkpoint=NULL,owner=NULL,updatedAt=? WHERE id=? AND owner=? AND status='processing' AND leaseUntil>?").run(JSON.stringify(result),Date.now(),id,owner,Date.now()).changes;
  if(!changed)throw new Error('Job lease lost');
 }
 fail(id:string,owner:string,error:unknown){
  const safe=error instanceof AppError?{code:error.code,message:error.message}:{code:'JOB_FAILED',message:'The operation could not be saved. Check storage and database availability, then retry.'};
  this.db.prepare("UPDATE jobs SET status='failed',message='Failed',error=?,retryAt=?,owner=NULL,updatedAt=? WHERE id=? AND owner=? AND status='processing'").run(JSON.stringify(safe),Date.now()+Math.max(60_000,error instanceof AppError?error.retryAfterMs??0:0),Date.now(),id,owner);
 }
 retry(id:string){
  const job=this.get(id);
  if(job.status!=='failed')throw new AppError(409,'JOB_NOT_FAILED','Only failed jobs can be retried.');
  if(job.attempts>=job.maxAttempts)throw new AppError(409,'RETRY_LIMIT','This job has reached its retry limit.');
  if(Date.now()<job.retryAt)throw new AppError(409,'RETRY_WAIT','Wait at least one minute and until this job’s retry cooldown has elapsed.');
  this.db.prepare("UPDATE jobs SET status='queued',progress=0,message='Waiting to retry',error=NULL,updatedAt=? WHERE id=? AND status='failed' AND attempts<maxAttempts AND retryAt<=?").run(Date.now(),id,Date.now());
  return this.get(id);
 }
 saveDraft(id:string,data:unknown,expires:number){this.db.prepare('INSERT OR REPLACE INTO review_drafts VALUES(?,?,?)').run(id,JSON.stringify(data),expires);}
 draft<T>(id:string):T|undefined{const row=this.db.prepare('SELECT data FROM review_drafts WHERE id=? AND expires>?').get(id,Date.now()) as {data:string}|undefined;return row?JSON.parse(row.data) as T:undefined;}
 draftCount(){this.db.prepare('DELETE FROM review_drafts WHERE expires<?').run(Date.now());return Number((this.db.prepare('SELECT COUNT(*) AS count FROM review_drafts').get() as {count:number}).count);}
 close(){this.db.close();}
}
