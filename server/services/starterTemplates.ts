import {defaultConfiguration} from '../../shared/screeningConfiguration';
import type {ScreeningConfig} from '../../shared/types';
import {screeningConfig} from '../../config/screening.config';
const description='Example starting point. Customize the criteria to your specific job requirements; interpret evidence through human review.';
function dimensions(items:[string,string][]):ScreeningConfig{return Object.fromEntries(items.map(([label,instructions],i)=>[`criterion_${i+1}`,{label,instructions:`Evaluate only explicit professional evidence. ${instructions} Missing evidence requires human review.`,order:(i+1)*10,type:'noul' as const}]));}
export function starterTemplates(){return [
 {name:'General Candidate Screening',description,configuration:defaultConfiguration(dimensions([
 ['Relevant professional experience','Does the resume document experience relevant to the explicitly defined responsibilities? Customize the responsibilities before use.'],
 ['Demonstrated skills','Does project or work evidence demonstrate the required skills? Define the skills before use.'],
 ['Responsibilities and accomplishments','Does the resume provide concrete examples of responsibilities and accomplishments?']
 ]))},
 {name:'Software Engineer',description,configuration:defaultConfiguration({...dimensions([
 ['Programming experience','Is there evidence of personally implementing software?'],
 ['Engineering practices','Is there evidence of testing, code review, maintainability and reliability?'],
 ['System design','Is there evidence of system design and architecture tradeoffs?'],
 ['Technical ownership','Is there evidence of owning and supporting production implementations?']
 ]),technical_depth:structuredClone(screeningConfig.technical_depth)})},
 {name:'Data Engineer',description,configuration:defaultConfiguration(dimensions([
 ['Python and SQL','Is there evidence of using Python and SQL in delivered data systems?'],
 ['Pipelines and orchestration','Is there evidence of building and orchestrating data pipelines?'],
 ['Data modeling and storage','Is there evidence of data modeling and storage design?'],
 ['Quality and governance','Is there evidence of data quality checks and governance practices?'],
 ['Distributed processing','Is there evidence of implementing distributed data processing?'],
 ['Production ownership','Is there evidence of production reliability and technical ownership?']
 ]))}
 ];}
