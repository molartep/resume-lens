import {Router} from 'express';
import type {TemplateRepository} from '../repositories/templateRepository';
export function templateRouter(templates:TemplateRepository){const r=Router();
 r.get('/screening-templates',async(_req,res)=>res.json(await templates.list()));
 r.get('/screening-templates/:id',async(req,res)=>res.json(await templates.get(String(req.params.id))));
 r.post('/screening-templates',async(req,res)=>res.status(201).json(await templates.create(req.body)));
 r.patch('/screening-templates/:id',async(req,res)=>res.json(await templates.update(String(req.params.id),req.body)));
 r.post('/screening-templates/:id/duplicate',async(req,res)=>res.status(201).json(await templates.duplicate(String(req.params.id),req.body)));
 r.delete('/screening-templates/:id',async(req,res)=>{await templates.remove(String(req.params.id));res.json({ok:true});});return r;
}
