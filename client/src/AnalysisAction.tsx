export function analysisBlocker({name,evidence,reviewed,busy}:{name:string;evidence:string;reviewed:boolean;busy:string}):string|null {
 if(busy)return busy;
 if(!name.trim())return 'Enter the required candidate display name above to continue.';
 if(name.trim().length>120)return 'Use a candidate display name of 120 characters or fewer.';
 if(evidence.trim().length<20)return 'Add at least 20 characters of professional resume evidence to continue.';
 if(evidence.trim().length>30000)return 'Shorten the professional evidence to 30,000 characters or fewer.';
 if(!reviewed)return 'Confirm that you reviewed the evidence and removed personal and sensitive information.';
 return null;
}

export function AnalysisAction({name,evidence,reviewed,busy,onAnalyze,onNameRequired}:{name:string;evidence:string;reviewed:boolean;busy:string;onAnalyze:()=>void;onNameRequired:()=>void}){
 const blocker=analysisBlocker({name,evidence,reviewed,busy});
 return <div className="analysis-action">
  <button type="button" className="primary" onClick={onAnalyze} disabled={!!blocker} aria-describedby="analysis-readiness" aria-busy={!!busy}>{busy?'Please wait…':'Analyze Candidate →'}</button>
  <div id="analysis-readiness" className={`analysis-readiness ${blocker?'blocked':'ready'}`} role="status">
   {blocker||'Ready to analyze the candidate.'}
   {!busy&&!name.trim()&&<button type="button" className="text-button" onClick={onNameRequired}>Enter display name ↑</button>}
  </div>
 </div>;
}
