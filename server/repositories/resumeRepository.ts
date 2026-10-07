import type {PrismaClient,Prisma} from '@prisma/client';
import type {ParsedResume,SavedResume} from '../../shared/types';
const candidateFields={id:true,name:true,resumeFilename:true,createdAt:true,updatedAt:true} as const;
export function resumeRepository(db:PrismaClient){return {
 async list():Promise<SavedResume[]>{
  const documents=await db.resumeDocument.findMany({orderBy:{createdAt:'desc'},select:{id:true,filename:true,createdAt:true,analyses:{orderBy:{analyzedAt:'desc'},take:1,select:{candidate:{select:{id:true,name:true}}}}}});
  return documents.map(({analyses,createdAt,...document})=>({...document,createdAt:createdAt.toISOString(),candidate:analyses[0]?.candidate||null}));
 },
 find:(id:string)=>db.resumeDocument.findUnique({where:{id},include:{analyses:{orderBy:{analyzedAt:'desc'},take:1,select:{screeningResumeText:true,candidate:{select:candidateFields}}}}}),
 create:({filename,pdfKey,parsedResume}:{filename:string;pdfKey:string;parsedResume:ParsedResume})=>db.resumeDocument.create({data:{filename,pdfKey,parsedResumeText:parsedResume.text,parserMetadata:JSON.parse(JSON.stringify(parsedResume.metadata)) as Prisma.InputJsonValue}})
};}
