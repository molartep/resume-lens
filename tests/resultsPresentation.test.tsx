import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Results} from '../client/src/Results';
import {Dropdown} from '../client/src/Dropdown';
import {screeningConfig} from '../config/screening.config';
import {withExperience} from '../shared/experience';
import {analysisAlerts} from '../shared/review';
import type {Analysis} from '../shared/types';
const config={years_of_experience:screeningConfig.years_of_experience,mentorship_demonstrated:screeningConfig.mentorship_demonstrated};
const screening=withExperience({model:'Synthetic presentation test',answers:{mentorship_demonstrated:{type:'noul',noul:.2}}},'# Experience\nEngineer, January 2021–August 2025',config,'2026-11-24');
const analysis:Analysis={id:'synthetic',candidateId:'synthetic',parsedResumeText:'Synthetic evidence',screeningResumeText:'Synthetic evidence',screeningResults:screening,screeningConfigSnapshot:config,analyzedAt:'2026-11-24T12:00:00Z',deciderLatencyMs:1,parserMetadata:{}};
it('presents duration as a score with tooltip information and a single counted alert',()=>{
 const html=renderToStaticMarkup(<Results analysis={analysis} config={config}/>);
 expect(html).toContain('4.67 years');expect(html).toContain('How experience is calculated');expect(html).toContain('role="tooltip"');
 expect(html).toContain('1 alert requires manual review');expect(html.indexOf('results-review-summary')).toBeLessThan(html.indexOf('result-grid'));
 expect(html).not.toContain('Current review threshold · Application interpretation');expect(html).toContain('application-interpretation');expect(html).not.toContain('Employment intervals and calculation issues');
});
it('counts incomplete evidence and model conflicts with the same rules as result cards',()=>{
 const incomplete=withExperience(screening,'# Experience\nEngineer, dates unknown',config,'2026-11-24');
 expect(analysisAlerts(incomplete,config,config)).toHaveLength(2);
 const conflict={...screening,experience:{...screening.experience!,modelConflict:true}};
 expect(analysisAlerts(conflict,config,config)).toHaveLength(2);
 const clear={...screening,answers:{...screening.answers,mentorship_demonstrated:{type:'noul' as const,noul:.9}}};
 expect(analysisAlerts(clear,config,config)).toHaveLength(0);
 expect(renderToStaticMarkup(<Results analysis={{...analysis,screeningResults:clear}} config={config}/>)).toContain('aria-live="polite" hidden=""');
});
it('renders a labeled custom combobox and disabled control with no native select',()=>{
 const html=renderToStaticMarkup(<Dropdown aria-label="Review metric" value="years" disabled onValueChange={()=>{}}><option value="years">Documented years</option><option value="confidence" disabled>Confidence</option></Dropdown>);
 expect(html).toContain('role="combobox"');expect(html).toContain('aria-expanded="false"');expect(html).toContain('Documented years');expect(html).toContain('disabled=""');expect(html).not.toContain('<select');expect(html).not.toContain('<option');
});
