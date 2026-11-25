import {Prisma,type PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {AppError} from '../services/errors';
import {starterTemplates} from '../services/starterTemplates';
import {configurationSchemaVersion,normalized,validateScreeningConfiguration,type ScreeningTemplate} from '../../shared/screeningConfiguration';
const metadata=z.object({name:z.string().trim().min(1,'Enter a template name.').max(120),description:z.string().trim().max(2000).default(''),configuration:z.unknown(),configurationSchemaVersion:z.number().int()}).strict();
function input(value:unknown){const p=metadata.safeParse(value);if(!p.success)throw new AppError(400,'INVALID_TEMPLATE',p.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return {...p.data,nameKey:p.data.name.normalize('NFKC').toLowerCase(),configuration:validateScreeningConfiguration(p.data.configuration,p.data.configurationSchemaVersion)};}
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function output(row:{id:string;name:string;description:string;configuration:unknown;configurationSchemaVersion:number;revision:number;createdAt:Date;updatedAt:Date}):ScreeningTemplate{return {...row,configuration:row.configuration as ScreeningTemplate['configuration'],createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()};}
async function unique<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')throw new AppError(409,'DUPLICATE_TEMPLATE','A template with this name already exists. Choose a different name.');throw e;}}
export function templateRepository(db:PrismaClient){
 const get=async(id:string)=>{const row=await db.screeningTemplate.findUnique({where:{id}});if(!row)throw new AppError(404,'TEMPLATE_NOT_FOUND','This template was deleted or does not exist. Your working configuration can still be saved as a new template.');return output(row);};
 return {
  async initialize(){
   // The marker and starter rows commit together. Deletion never resets the marker.
   await db.$transaction(async tx=>{
    const key='screening-templates-v1';if(await tx.applicationInitialization.findUnique({where:{key}}))return;
    for(const starter of starterTemplates()){const data=input({...starter,configurationSchemaVersion});if(!await tx.screeningTemplate.findUnique({where:{nameKey:data.nameKey}}))await tx.screeningTemplate.create({data:{...data,configuration:json(data.configuration)}});}
    await tx.applicationInitialization.create({data:{key}});
   });
  },
  get,
  async list(){return (await db.screeningTemplate.findMany({orderBy:[{updatedAt:'desc'},{id:'asc'}]})).map(output);},
  async create(value:unknown){const data=input(value);return unique(async()=>output(await db.screeningTemplate.create({data:{...data,configuration:json(data.configuration)}})));},
  async update(id:string,value:unknown){
   const body=z.object({expectedRevision:z.number().int().positive(),name:z.unknown(),description:z.unknown().optional(),configuration:z.unknown(),configurationSchemaVersion:z.unknown()}).strict().safeParse(value);
   if(!body.success)throw new AppError(400,'INVALID_TEMPLATE','Supply complete template metadata, configuration, schema version and expectedRevision.');
   const {expectedRevision,...raw}=body.data;const data=input(raw);
   return unique(()=>db.$transaction(async tx=>{
    const current=await tx.screeningTemplate.findUnique({where:{id}});if(!current)throw new AppError(404,'TEMPLATE_NOT_FOUND','This template has been deleted. Save your configuration as a new template.');
    if(current.revision!==expectedRevision)throw new AppError(409,'TEMPLATE_CONFLICT','This template has been updated since you opened it. Reload the latest version or save your current configuration as a new template.');
    if(normalized({...data,configuration:json(data.configuration)})===normalized({name:current.name,nameKey:current.nameKey,description:current.description,configuration:current.configuration,configurationSchemaVersion:current.configurationSchemaVersion}))return output(current);
    const changed=await tx.screeningTemplate.updateMany({where:{id,revision:expectedRevision},data:{...data,configuration:json(data.configuration),revision:{increment:1}}});
    if(!changed.count)throw new AppError(409,'TEMPLATE_CONFLICT','This template was updated. Reload it or save as a new template.');
    return output((await tx.screeningTemplate.findUniqueOrThrow({where:{id}})));
   }));
  },
  async duplicate(id:string,value:unknown){const body=z.object({name:z.string(),description:z.string().optional()}).strict().safeParse(value);if(!body.success)throw new AppError(400,'INVALID_TEMPLATE','Enter a name for the duplicate.');const original=await get(id);return this.create({name:body.data.name,description:body.data.description??original.description,configuration:original.configuration,configurationSchemaVersion:original.configurationSchemaVersion});},
  async remove(id:string){const result=await db.screeningTemplate.deleteMany({where:{id}});if(!result.count)throw new AppError(404,'TEMPLATE_NOT_FOUND','This template has already been deleted.');}
 };
}
export type TemplateRepository=ReturnType<typeof templateRepository>;
