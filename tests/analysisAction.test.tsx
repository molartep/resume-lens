import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AnalysisAction,analysisBlocker} from '../client/src/AnalysisAction';
const ready={name:'Demo candidate',evidence:'Built and shipped API services.',reviewed:true,busy:''};
it('unblocks analysis after parsing, required name and evidence review',()=>{
 expect(analysisBlocker(ready)).toBeNull();
 expect(analysisBlocker({...ready,reviewed:false})).toContain('Confirm');
 expect(analysisBlocker({...ready,busy:'Parsing resume…'})).toBe('Parsing resume…');
 expect(analysisBlocker({...ready,busy:'Analyzing dimensions…'})).toBe('Analyzing dimensions…');
});
it('explains why checking review alone does not satisfy the required display name',()=>{
 expect(analysisBlocker({...ready,name:'  '})).toContain('display name');
 const html=renderToStaticMarkup(<AnalysisAction {...ready} name="" onAnalyze={()=>{}} onNameRequired={()=>{}}/>);
 expect(html).toContain('disabled=""');expect(html).toContain('aria-busy="false"');expect(html).toContain('Enter display name');expect(html).not.toContain('Please wait');
});
it('shows an enabled ready action and waiting text only during an active operation',()=>{
 const html=renderToStaticMarkup(<AnalysisAction {...ready} onAnalyze={()=>{}} onNameRequired={()=>{}}/>);
 expect(html).not.toContain('disabled=');expect(html).toContain('Ready to analyze');
 const waiting=renderToStaticMarkup(<AnalysisAction {...ready} busy="Analyzing dimensions…" onAnalyze={()=>{}} onNameRequired={()=>{}}/>);
 expect(waiting).toContain('aria-busy="true"');expect(waiting).toContain('Please wait');
});
it('validates evidence and name bounds consistently with the backend',()=>{
 expect(analysisBlocker({...ready,evidence:' '.repeat(20)})).toContain('at least 20');
 expect(analysisBlocker({...ready,evidence:'x'.repeat(20)})).toBeNull();
 expect(analysisBlocker({...ready,evidence:'x'.repeat(30000)})).toBeNull();
 expect(analysisBlocker({...ready,evidence:'x'.repeat(30001)})).toContain('30,000');
 expect(analysisBlocker({...ready,name:'x'.repeat(121)})).toContain('120');
});
