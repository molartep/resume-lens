import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { apiRouter, type Dependencies } from './routes/api';
import { AppError } from './services/errors';
export function createApp(deps:Dependencies){
 const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':null}}}));
 app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 // Reject cross-origin writes, including simple multipart form submissions from websites.
 app.use('/api',(req,_res,next)=>{
  if(['POST','DELETE','PUT','PATCH'].includes(req.method)){
   const origin=req.get('origin');const host=req.get('host');
   if(req.get('sec-fetch-site')==='cross-site'||(origin&&!([`http://${host}`,'http://127.0.0.1:5173','http://localhost:5173'].includes(origin))))return next(new AppError(403,'ORIGIN','Only local application requests are allowed.'));
  }
  next();
 });
 app.use(express.json({limit:'256kb'}));app.use('/api',apiRouter(deps));
 app.use('/api',(_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'API route not found.'}}));
 if(process.env.NODE_ENV==='production'){
  app.use(express.static(path.resolve('dist/client')));
  app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/client/index.html')));
 }
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(error instanceof multer.MulterError)return res.status(400).json({error:{code:'UPLOAD_ERROR',message:error.code==='LIMIT_FILE_SIZE'?'PDF exceeds the upload limit configured in Settings.':'Upload exactly one PDF without extra fields.'}});
  if(error instanceof AppError)return res.status(error.status).json({error:{code:error.code,message:error.message}});
  if(typeof error==='object'&&error&&'type' in error&&error.type==='entity.too.large')return res.status(413).json({error:{code:'REQUEST_TOO_LARGE',message:'This request is too large. Shorten the reviewed evidence.'}});
  if(error instanceof SyntaxError)return res.status(400).json({error:{code:'INVALID_JSON',message:'Request body contains invalid JSON.'}});
  // Log error categories only: database errors can contain resume arguments.
  console.error('Request failure',{name:error instanceof Error?error.name:'unknown',code:typeof error==='object'&&error&&'code' in error?error.code:undefined});
  res.status(500).json({error:{code:'SERVER_ERROR',message:'The operation could not be saved. Check the database connection and migrations, then try again.'}});
 });
 return app;
}
