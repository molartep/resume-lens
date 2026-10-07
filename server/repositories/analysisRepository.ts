import type { PrismaClient, Prisma } from '@prisma/client';
import type { ParsedResume, Screening, ScreeningConfig } from '../../shared/types';
export type SaveAnalysis={candidateId?:string;name?:string;resumeFilename:string;resumePdfKey?:string;resumeDocumentId?:string;parsedResume:ParsedResume;evidence:string;screening:Screening;config:ScreeningConfig;latencyMs:number};
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function analysisRepository(db:PrismaClient){return {
 find:(id:string)=>db.resumeAnalysis.findUnique({where:{id}}),
 list:(candidateId:string)=>db.resumeAnalysis.findMany({where:{candidateId},orderBy:{analyzedAt:'desc'}}),
 save:(input:SaveAnalysis)=>db.$transaction(async tx=>{
  // An explicit candidate id creates history. Never merge people by filename or inferred identity.
  const data={resumeFilename:input.resumeFilename,...(input.name?{name:input.name}:{})};
  const candidate=input.candidateId?await tx.candidate.update({where:{id:input.candidateId},data}):await tx.candidate.create({data});
  const analysis=await tx.resumeAnalysis.create({data:{candidateId:candidate.id,resumeFilename:input.resumeFilename,resumePdfKey:input.resumePdfKey,resumeDocumentId:input.resumeDocumentId,parsedResumeText:input.parsedResume.text,screeningResumeText:input.evidence,screeningResults:json(input.screening),screeningConfigSnapshot:json(input.config),deciderLatencyMs:input.latencyMs,parserMetadata:json(input.parsedResume.metadata)}});
  return {candidate,analysis};
 })
};}
