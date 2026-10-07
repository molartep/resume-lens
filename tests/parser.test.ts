import {it,expect,vi,afterEach} from 'vitest';
import {parseResume} from '../server/services/llamaIndexService';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('reports unconfigured parser',async()=>{vi.stubEnv('LLAMAINDEX_API_KEY','');await expect(parseResume(Buffer.from('%PDF-'))).rejects.toThrow('not configured');});
it('uses documented upload/job/poll shapes and cleans remote artifacts',async()=>{
 vi.stubEnv('LLAMAINDEX_API_KEY','test-secret');vi.stubEnv('LLAMAINDEX_API_URL','https://api.cloud.llamaindex.ai');
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({id:'file-1'})).mockResolvedValueOnce(Response.json({id:'job-1',status:'PENDING'})).mockResolvedValueOnce(Response.json({job:{id:'job-1',status:'COMPLETED'},markdown:{pages:[{success:true,page_number:1,markdown:'# Experience\nBuilt services.'}]}})).mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetch);
 const parsed=await parseResume(Buffer.from('%PDF-'));
 expect(parsed.text).toContain('Built services');expect(fetch).toHaveBeenCalledTimes(5);expect(String(fetch.mock.calls[0][0])).toContain('/api/v1/beta/files');expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({file_id:'file-1',tier:'agentic'});expect(String(fetch.mock.calls[2][0])).toContain('expand=markdown');expect(fetch.mock.calls[4][1].method).toBe('DELETE');
});
it('rejects partial parsing rather than screening incomplete text',async()=>{
 vi.stubEnv('LLAMAINDEX_API_KEY','test');vi.stubEnv('LLAMAINDEX_API_URL','https://api.cloud.llamaindex.ai');vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({id:'file'})).mockResolvedValueOnce(Response.json({id:'job',status:'PENDING'})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'COMPLETED'},markdown:{pages:[{success:false,page_number:1,error:'parse failed'}]}})).mockResolvedValue(new Response(null,{status:204})));
 await expect(parseResume(Buffer.from('%PDF-'))).rejects.toThrow('fully parsed');
});
it('waits through pending and running jobs with null markdown',async()=>{
 vi.stubEnv('LLAMAINDEX_API_KEY','test');vi.stubEnv('LLAMAINDEX_API_URL','https://api.cloud.llamaindex.ai');
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({id:'file'})).mockResolvedValueOnce(Response.json({id:'job',status:'PENDING'})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'PENDING'},markdown:null,text:null,items:null})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'RUNNING'},markdown:null})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'COMPLETED'},markdown:{pages:[{success:true,page_number:1,markdown:'Professional experience: Built API services.'}]}})).mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetch);
 const {defaultSettings}=await import('../server/services/settingsService');const settings=defaultSettings();settings.parser.pollIntervalMs=1;
 const result=await parseResume(Buffer.from('%PDF-'),settings);expect(result.text).toContain('Built API services');expect(fetch).toHaveBeenCalledTimes(7);expect(fetch.mock.calls.slice(0,5).some(([,options])=>options?.method==='DELETE')).toBe(false);
});
it('reports a failed job with null results as a parsing failure',async()=>{
 vi.stubEnv('LLAMAINDEX_API_KEY','test');vi.stubEnv('LLAMAINDEX_API_URL','https://api.cloud.llamaindex.ai');vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({id:'file'})).mockResolvedValueOnce(Response.json({id:'job',status:'PENDING'})).mockResolvedValueOnce(Response.json({job:{id:'job',status:'FAILED'},markdown:null})).mockResolvedValue(new Response(null,{status:204})));
 await expect(parseResume(Buffer.from('%PDF-'))).rejects.toThrow('could not parse this PDF');
});
