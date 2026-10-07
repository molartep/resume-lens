import type { PrismaClient } from '@prisma/client';
export function candidateRepository(db:PrismaClient){return {
 list:()=>db.candidate.findMany({orderBy:{updatedAt:'desc'},include:{analyses:{orderBy:{analyzedAt:'desc'},take:1,select:{id:true,analyzedAt:true,screeningResults:true,screeningConfigSnapshot:true}}}}),
 find:(id:string)=>db.candidate.findUnique({where:{id}}),
 health:async()=>{await db.candidate.count();return true;}
};}
