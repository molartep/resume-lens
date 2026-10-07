import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFDocumentLoadingTask,RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export function ResumePdf({analysisId,filename}:{analysisId:string;filename:string}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
 const [pageNumber,setPageNumber]=useState(1);
 const [loading,setLoading]=useState(true);
 const [rendering,setRendering]=useState(false);
 const [error,setError]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const controller=new AbortController();let task:PDFDocumentLoadingTask|undefined;let stopped=false;
  setPdf(null);setPageNumber(1);setLoading(true);setError('');
  void (async()=>{
   try{
    const library=await import('pdfjs-dist');if(stopped)return;
    library.GlobalWorkerOptions.workerSrc=workerUrl;
    const response=await fetch(`/api/analyses/${analysisId}/resume`,{signal:controller.signal});
    if(!response.ok)throw new Error('The saved PDF could not be loaded.');
    const data=new Uint8Array(await response.arrayBuffer());if(stopped)return;
    task=library.getDocument({data,useSystemFonts:true});
    const document=await task.promise;if(!stopped)setPdf(document);
   }catch(problem){if(!stopped)setError((problem as Error).name==='PasswordException'?'This PDF requires a password. Use Open PDF or Download PDF to view it.':'This PDF could not be previewed. Try Open PDF or Download PDF.');}
   finally{if(!stopped)setLoading(false);}
  })();
  return ()=>{stopped=true;controller.abort();void task?.destroy().catch(()=>{});};
 },[analysisId]);
 useEffect(()=>{
  if(!pdf)return;let stopped=false;let task:RenderTask|undefined;setRendering(true);setError('');
  void (async()=>{
   try{
    const page=await pdf.getPage(pageNumber);if(stopped||!canvas.current)return;
    const natural=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(1.5,1600/natural.width,2400/natural.height)});
    const element=canvas.current;element.width=Math.ceil(viewport.width);element.height=Math.ceil(viewport.height);
    task=page.render({canvas:element,viewport});await task.promise;
   }catch{if(!stopped)setError('This page could not be previewed. Try Open PDF or Download PDF.');}
   finally{if(!stopped)setRendering(false);}
  })();
  return ()=>{stopped=true;task?.cancel();};
 },[pdf,pageNumber]);
 return <div className="pdf-preview">
  {pdf&&<div className="pdf-controls"><button type="button" aria-label="Previous PDF page" disabled={pageNumber===1||rendering} onClick={()=>setPageNumber(p=>p-1)}>← Previous</button><span>Page {pageNumber} of {pdf.numPages}</span><button type="button" aria-label="Next PDF page" disabled={pageNumber===pdf.numPages||rendering} onClick={()=>setPageNumber(p=>p+1)}>Next →</button></div>}
  {error&&<p className="pdf-preview-error" role="alert">{error}</p>}
  {(loading||rendering)&&<p role="status" className="pdf-loading">{loading?'Loading PDF…':'Rendering page…'}</p>}
  <div className="pdf-page"><canvas ref={canvas} hidden={!pdf||!!error} role="img" aria-label={`${filename}, page ${pageNumber}${pdf?` of ${pdf.numPages}`:''}`}/></div>
 </div>;
}
