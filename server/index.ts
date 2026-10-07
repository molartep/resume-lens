import 'dotenv/config';
import {resumeRepository} from './repositories/resumeRepository';
import {resumeFileStore} from './services/resumeFileService';
import { createApp } from './app';
import { settingsRepository } from './repositories/settingsRepository';
import { prisma } from './repositories/db';
import { candidateRepository } from './repositories/candidateRepository';
import { analysisRepository } from './repositories/analysisRepository';
import { parseResume,parserConfigured } from './services/llamaIndexService';
import { analyzeWithDecider,checkDeciderHealth } from './services/deciderService';
const pdfs=resumeFileStore();await pdfs.cleanupDrafts();
const app=createApp({pdfs,resumes:resumeRepository(prisma),settings:settingsRepository(),candidates:candidateRepository(prisma),analyses:analysisRepository(prisma),parse:parseResume,decide:analyzeWithDecider,parserConfigured,health:checkDeciderHealth});
const port=Number(process.env.PORT)||3000;
const server=app.listen(port,'127.0.0.1',()=>console.log(`Resume Lens API: http://127.0.0.1:${port}`));
async function shutdown(){server.close();await prisma.$disconnect();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
