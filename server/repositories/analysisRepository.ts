import type {AnalysisHistoryPage} from '../../shared/analysisHistory';
import type {ExecutionConfiguration} from '../../shared/screeningConfiguration';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { ParsedResume, Screening, ScreeningConfig } from '../../shared/types';
export type SaveAnalysis={executionConfiguration?:ExecutionConfiguration;id?:string;candidateId?:string;name?:string;resumeFilename:string;resumePdfKey?:string;resumeDocumentId?:string;parsedResume:ParsedResume;evidence:string;screening:Screening;config:ScreeningConfig;latencyMs:number};
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function analysisRepository(db:PrismaClient){return {
 find:(id:string)=>db.resumeAnalysis.findUnique({where:{id}}),
 list:(candidateId:string)=>db.resumeAnalysis.findMany({where:{candidateId},orderBy:{analyzedAt:'desc'}}),
 async history(page=1,pageSize=25):Promise<AnalysisHistoryPage>{
  const [rows,total]=await db.$transaction([
   db.resumeAnalysis.findMany({orderBy:[{analyzedAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize,select:{id:true,candidateId:true,candidate:{select:{name:true}},resumeFilename:true,analyzedAt:true,executionConfigurationSnapshot:true,screeningResults:true}}),
   db.resumeAnalysis.count()
  ]);
  const items=rows.map(row=>{
   const execution=row.executionConfigurationSnapshot as unknown as ExecutionConfiguration|null;
   const screening=row.screeningResults as unknown as Screening;
   const provenance=execution?.provenance;
   return {id:row.id,candidateId:row.candidateId,candidateName:row.candidate.name,resumeFilename:row.resumeFilename,analyzedAt:row.analyzedAt.toISOString(),template:provenance?{templateId:provenance.templateId,templateName:provenance.templateName,templateRevision:provenance.templateRevision}:null,model:typeof screening.model==='string'?screening.model:execution?.configuration.model.model||'Model not recorded',provider:typeof screening.provider==='string'?screening.provider:execution?.configuration.model.provider||null};
  });
  return {items,total,page,pageSize};
 },
 save:(input:SaveAnalysis)=>db.$transaction(async tx=>{
  if(input.id){const existing=await tx.resumeAnalysis.findUnique({where:{id:input.id},include:{candidate:true}});if(existing){const {candidate,...analysis}=existing;return {candidate,analysis};}}
  // An explicit candidate id creates history. Never merge people by filename or inferred identity.
  const data={resumeFilename:input.resumeFilename,...(input.name?{name:input.name}:{})};
  const candidate=input.candidateId?await tx.candidate.update({where:{id:input.candidateId},data}):await tx.candidate.create({data});
  const analysis=await tx.resumeAnalysis.create({data:{id:input.id,candidateId:candidate.id,resumeFilename:input.resumeFilename,resumePdfKey:input.resumePdfKey,resumeDocumentId:input.resumeDocumentId,parsedResumeText:input.parsedResume.text,screeningResumeText:input.evidence,screeningResults:json(input.screening),screeningConfigSnapshot:json(input.config),...(input.executionConfiguration?{executionConfigurationSnapshot:json(input.executionConfiguration)}:{}),deciderLatencyMs:input.latencyMs,parserMetadata:json(input.parsedResume.metadata)}});
  return {candidate,analysis};
 })
};}
