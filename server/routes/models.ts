import {Router,type Request} from 'express';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import type {ModelService} from '../services/modelService';
import {AppError} from '../services/errors';
import {validateModelProfile} from '../services/modelConfig';
export function modelRouter(models:ModelService){
 const router=Router();const sessions=new Map<string,number>();const attempts=new Map<string,{count:number;until:number}>();
 const token=()=>process.env.ADMIN_API_TOKEN||'';const configured=()=>token().length>=32;
 const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
 const authenticated=(req:Request)=>{if(!configured())return false;const bearer=req.get('authorization')?.replace(/^Bearer /,'');if(bearer&&equal(bearer,token()))return true;const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('resumelens_admin='))?.slice(17);return Boolean(cookie&&(sessions.get(cookie)||0)>Date.now());};
 const requireAdmin=(req:Request)=>{if(!authenticated(req))throw new AppError(403,'ADMIN_REQUIRED','Administrator access is required. Configure ADMIN_API_TOKEN (at least 32 characters) on the server, then unlock model settings.');};
 router.get('/models',async(req,res)=>res.json({...await models.repository.list(),adminConfigured:configured(),adminAuthenticated:authenticated(req)}));
 router.post('/admin/session',(req,res)=>{
  if(!configured())throw new AppError(503,'ADMIN_UNCONFIGURED','Set ADMIN_API_TOKEN to at least 32 characters in the server environment.');
  for(const [key,end] of sessions)if(end<Date.now())sessions.delete(key);
  for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);
  const ip=req.ip||'local';const attempt=attempts.get(ip)??{count:0,until:Date.now()+60000};if(attempt.count>=10)throw new AppError(429,'ADMIN_RATE_LIMIT','Too many login attempts. Wait one minute.');attempt.count++;attempts.set(ip,attempt);
  if(typeof req.body?.token!=='string'||!equal(req.body.token,token()))throw new AppError(403,'ADMIN_REQUIRED','Invalid administrator token.');
  if(sessions.size>=100)throw new AppError(429,'ADMIN_RATE_LIMIT','Too many active sessions. Wait for a session to expire.');const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+1800000);res.cookie('resumelens_admin',id,{httpOnly:true,sameSite:'strict',secure:req.secure,path:'/api',maxAge:1800000});res.json({ok:true});
 });
 router.delete('/admin/session',(req,res)=>{const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('resumelens_admin='))?.slice(17);if(cookie)sessions.delete(cookie);res.clearCookie('resumelens_admin',{path:'/api'});res.json({ok:true});});
 router.post('/models/active',async(req,res)=>res.json(await models.repository.select(req.body?.id)));
 router.put('/admin/models/:id',async(req,res)=>{requireAdmin(req);const p=validateModelProfile(req.body?.profile);if(p.id!==req.params.id)throw new AppError(400,'INVALID_MODEL_PROFILE','Profile ID must match the URL.');res.json(await models.repository.save(p,req.body.apiKey));});
 router.delete('/admin/models/:id',async(req,res)=>{requireAdmin(req);await models.repository.remove(String(req.params.id));res.json({ok:true});});
 router.post('/admin/models/:id/test',async(req,res)=>{requireAdmin(req);const p=(await models.repository.list()).profiles.find(p=>p.id===req.params.id);if(!p)throw new AppError(404,'MODEL_NOT_FOUND','Model connection not found.');const {credentialConfigured,credentialSource,...profile}=p;res.json(await models.test(profile));});
 return router;
}
