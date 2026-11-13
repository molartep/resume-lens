export type JobStatus='queued'|'processing'|'completed'|'failed';
export type Job={id:string;kind:'parse'|'analyze';status:JobStatus;progress:number;message:string;attempts:number;maxAttempts:number;createdAt:number;updatedAt:number;retryAt:number;error:{code:string;message:string}|null;result:unknown};
