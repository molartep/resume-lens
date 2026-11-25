import {defaultTemplateConfiguration} from '../../shared/screeningConfiguration';
import type {Dimension,ScreeningConfig} from '../../shared/types';

// Editable evidence-triage default, not an empirically validated qualification cutoff.
export const exampleReviewProbability=.65;
export const exampleReviewLevel=2;
export const starterDescriptions={
 'General Candidate Screening':'Review demonstrated responsibilities, problem solving, outcomes, collaboration and learning across professional contexts. Adapt these general criteria to the role. Includes documented employment duration.',
 'Software Engineer':'Review software implementation, design reasoning, testing, production reliability, requirements and collaboration. Architecture scope is contextual, not a universal seniority requirement. Includes documented employment duration.',
 'Data Engineer':'Review SQL and transformations, dependable pipelines, data modeling, data quality, governance and operational ownership. Distributed processing is contextual rather than mandatory. Includes documented employment duration.',
 'Customer Success Manager':'Review customer onboarding, adoption, issue resolution, account planning, retention and stakeholder coordination. Commercial expansion is optional and depends on the role. Includes documented employment duration.',
 'Operations Manager':'Review operational execution, process improvement, capacity planning, quality controls, team coordination and performance monitoring across service or business operations. Includes documented employment duration.'
};
const evidencePolicy='Classify the documented evidence, not the person’s ability. Use concrete actions and context rather than titles, employer or school reputation, writing style, or tenure. Accept relevant employment, project, volunteer and transferable examples. Qualitative outcomes are valid: numerical metrics are not required. Missing detail calls for structured follow-up, not a negative conclusion about ability.';
function dimension(label:string,focus:string,clear:string,partial:string,review=true):Dimension {
 return {
  type:'choice',label,order:0,
  instructions:`${focus} ${evidencePolicy}`,
  criteria:{
   clear_evidence:clear,
   partial_evidence:partial,
   not_documented:'No relevant example is documented. Do not infer that the person lacks this capability. Clarify with job-related interview questions or a work sample.'
  },
  categoryLabels:{clear_evidence:'Clear evidence',partial_evidence:'Partial evidence',not_documented:'Not documented'},
  ...(review?{reviewThreshold:{metric:'category_probability' as const,category:'clear_evidence',operator:'below' as const,value:exampleReviewProbability}}:{})
 };
}
function yesNo(label:string,focus:string,clear:string,partial:string):Dimension {
 return {
  type:'noul',label,order:0,
  instructions:`Is there concrete documented evidence of ${label.toLowerCase()}? ${focus} ${evidencePolicy}`,
  criteria:{true:clear,false:`${partial} Or no relevant example is documented. This describes missing evidence, not inability.`},
  reviewThreshold:{metric:'yes_probability',operator:'below',value:exampleReviewProbability}
 };
}
function scored(label:string,focus:string,concrete:string,partial:string,advanced:string):Dimension {
 return {
  type:'score',label,order:0,
  instructions:`Assess the depth of documented ${label.toLowerCase()} using the ordered evidence rubric. ${focus} ${evidencePolicy} Use level 2 for a concrete example. Level 3 requires the additional evidence specified in the rubric, not a more senior title. This index describes this dimension only, not overall suitability or employment duration.`,
  criteria:[
   'No relevant example is documented. Follow up with job-related questions or a work sample rather than inferring inability.',
   partial,
   concrete,
   advanced
  ],
  reviewThreshold:{metric:'expected_score',operator:'below',value:exampleReviewLevel}
 };
}
function experienceDimension():Dimension {
 return {
  type:'experience',label:'Years of Experience',order:0,
  instructions:'Calculate total documented professional employment duration as of {{CURRENT_DATE}} from dated employment intervals. Merge overlapping calendar months and do not count gaps. Missing, year-only or ambiguous dates require human review. This is total documented employment, not role-specific experience or a measure of capability. No minimum-years requirement is assumed for this example.'
 };
}
function dimensions(items:[string,Dimension][]):ScreeningConfig{return Object.fromEntries(items.map(([id,q],i)=>[id,{...q,order:(i+1)*10}]));}
export const businessExampleNames=['Customer Success Manager','Operations Manager'] as const;
export function starterTemplates(){return [
 {name:'General Candidate Screening',description:starterDescriptions['General Candidate Screening'],configuration:defaultTemplateConfiguration(dimensions([
  ['years_of_experience',experienceDimension()],
  ['responsibility_and_ownership',dimension('Responsibilities and ownership','Look for what the person personally delivered or maintained. Do not assume a match to unspecified role requirements.',
   'A concrete responsibility or deliverable is described with the person’s contribution and work context.',
   'Responsibilities or participation are listed, but the person’s contribution or scope is unclear.')],
  ['problem_solving',scored('Problem solving and judgment','Look for a problem, the action taken and the reasoning or constraints considered.',
   'A specific problem and a relevant action, decision or improvement are described with enough context to discuss the approach.',
   'Problem-solving claims or activities appear without a specific problem, approach or decision.',
   'Multiple examples, or one detailed example, connect a clearly identified problem to considered alternatives or constraints, an implemented action and the observed result.')],
  ['outcomes',scored('Accomplishments and outcomes','Look for a credible result linked to the person’s work. Consider qualitative results and constraints on sharing business metrics.',
   'A delivered result, improvement or completed objective is connected to the person’s actions and relevant context.',
   'Achievements or targets are claimed, but the connection to the person’s actions or the result is unclear.',
   'The person connects their actions to a delivered outcome and explains sustained value, follow-through or lessons used in subsequent work. Qualitative results are sufficient.')],
  ['collaboration',yesNo('Collaboration and stakeholder work','Look for documented coordination, handoffs, feedback or communication in work. Do not evaluate personality or resume prose.',
   'An example shows how the person coordinated with others, clarified needs, shared information or resolved a work dependency.',
   'Teamwork or communication is asserted without an example of an interaction or shared deliverable.')],
  ['learning_and_adaptation',dimension('Learning and adaptation','Consider evidence of learning a new process, applying feedback or adapting to changed requirements. This supporting dimension is contextual.',
   'A specific example connects learning, feedback or changed requirements to an applied action.',
   'Training, adaptability or learning is mentioned without evidence of application.',false)]
 ]))},
 {name:'Software Engineer',description:starterDescriptions['Software Engineer'],configuration:defaultTemplateConfiguration(dimensions([
  ['years_of_experience',experienceDimension()],
  ['software_implementation',scored('Software implementation','Look for software the person personally implemented. Accept relevant projects and equivalent programming stacks rather than requiring a particular language.',
   'A feature, application, service or tool is described with implementation responsibilities and a concrete use or delivery context.',
   'Languages, tools or coding tasks are listed without a clear implemented deliverable or personal contribution.',
   'A delivered software example explains the person’s implementation decisions, integration or complexity and how the result was used, validated or iterated on.')],
  ['design_reasoning',dimension('Design reasoning and tradeoffs','Look for decisions about interfaces, data, components, constraints or alternatives. Assess scope in context: broad architecture ownership is not required for every engineering role.',
   'A design decision or tradeoff is connected to a concrete implementation problem, constraint or system behavior.',
   'Design or architecture is mentioned without an identifiable decision, constraint or implementation context.',false)],
  ['testing_and_maintainability',yesNo('Testing and maintainability','Look for concrete testing, debugging, code review, refactoring or documentation practices that support maintainable software.',
   'The person describes applying a testing or maintainability practice to a specific implementation or delivery problem.',
   'Testing, clean code or development practices are named without a concrete use or contribution.')],
  ['production_reliability',scored('Production delivery and reliability','Look for deployment, monitoring, incident handling, safe changes or operating software used by others. Match the expected scope to the actual role.',
   'A delivery or operational example describes the person’s action to deploy, observe, support or improve running software.',
   'Production, deployment or operational tooling is mentioned without a specific responsibility or example.',
   'A specific operational example links deployment or incident handling to diagnosis, a safe change and verification or prevention of recurrence.')],
  ['requirements_and_delivery',dimension('Requirements and delivery','Look for translating user or business needs into scoped software work and delivering or iterating on it.',
   'An example links a user need or requirement to an implemented change and delivery or feedback process.',
   'Feature delivery or requirement gathering is listed without a clear connection between the need and the work.')],
  ['engineering_collaboration',yesNo('Engineering collaboration','Look for substantive code review, technical discussions, documentation, cross-team coordination or shared delivery. Formal leadership is not required.',
   'A concrete contribution shows coordination with engineers or stakeholders to resolve a dependency, share knowledge or deliver software.',
   'Team membership, mentoring or collaboration is asserted without a substantive example.')]
 ]))},
 {name:'Data Engineer',description:starterDescriptions['Data Engineer'],configuration:defaultTemplateConfiguration(dimensions([
  ['years_of_experience',experienceDimension()],
  ['sql_and_transformations',yesNo('SQL and data transformation','Look for concrete extraction, joins, transformations, validation or query optimization. SQL evidence matters here: Python or another language is useful context, not an independent mandatory tool.',
   'A data transformation or query task describes what was implemented, its purpose and the person’s contribution.',
   'SQL, Python or transformation tools are listed without a concrete data task or contribution.')],
  ['pipeline_reliability',scored('Pipelines and orchestration','Look for building or maintaining data flows with dependencies, scheduling, failure handling, backfills or repeatability. Accept equivalent tools.',
   'A pipeline example identifies the data flow and a concrete implementation or reliability responsibility.',
   'ETL, pipelines or orchestration tools are mentioned without an identifiable flow or operational responsibility.',
   'An implemented pipeline example explains dependencies and operational safeguards such as idempotency, retries, monitoring or backfills, with evidence of how reliability was checked.')],
  ['data_modeling',scored('Data modeling and storage','Look for dataset structure, relationships, schemas, storage choices or consumer-oriented modeling. Do not require a particular platform.',
   'A modeling or storage example connects a design or implementation choice to data access, reporting or application needs.',
   'Warehouses, databases or modeling tools are named without a clear design or implementation example.',
   'A modeling or storage example explains consumer needs, design alternatives or constraints and how data correctness or access behavior was checked after implementation.')],
  ['data_quality',yesNo('Data quality and validation','Look for checks, reconciliation, contracts, tests, monitoring or investigation of data defects.',
   'A concrete example shows how the person detected, prevented, investigated or corrected a data-quality problem.',
   'Data quality or testing is claimed without a specific check, investigation or corrective action.')],
  ['governance_and_ownership',dimension('Governance and operational ownership','Look for accountable data operations, access controls, documentation, lineage, incident response or consumer support. Do not infer regulatory expertise from an employer or industry.',
   'An example demonstrates responsibility for operating data assets or applying a concrete governance or access practice.',
   'Governance, ownership or operational tools are mentioned without a specific responsibility or action.')],
  ['scale_and_processing',dimension('Scale and processing tradeoffs','Consider batch, streaming, distributed execution, partitioning or performance tradeoffs only where the work requires them. Distributed processing is not a universal requirement.',
   'A processing or performance decision is tied to a concrete workload, constraint or observed behavior.',
   'Scale, streaming or distributed tools are listed without an identifiable workload or decision.',false)]
 ]))},
 {name:'Customer Success Manager',description:starterDescriptions['Customer Success Manager'],configuration:defaultTemplateConfiguration(dimensions([
  ['years_of_experience',experienceDimension()],
  ['onboarding_and_adoption',scored('Customer onboarding and adoption','Look for helping customers reach an agreed objective through onboarding, enablement, adoption planning or removal of usage barriers.',
   'A customer example identifies an onboarding or adoption need and the person’s actions to support progress.',
   'Customer success, training or onboarding is listed without a concrete customer objective or action.',
   'A customer example links an agreed objective to a tailored onboarding or adoption plan, observed progress and an adjustment or follow-through based on feedback.')],
  ['customer_problem_resolution',scored('Customer problem resolution','Look for clarifying customer problems, coordinating resolution, handling escalations and closing the feedback loop.',
   'A specific customer problem or escalation is connected to the person’s investigation, coordination or follow-through.',
   'Issue handling or customer service is asserted without a specific problem or resolution responsibility.',
   'A customer issue example links diagnosis and cross-team coordination to verified resolution, expectation management and prevention or useful follow-up.')],
  ['account_planning',dimension('Account planning and retention','Look for understanding customer goals, monitoring account health, planning engagement and identifying retention risks. Do not require a particular portfolio size or renewal quota.',
   'A concrete example links a customer goal or retention risk to a planned engagement or follow-up action.',
   'Account ownership, retention or relationship management is mentioned without goals, risks or planned actions.')],
  ['stakeholder_coordination',yesNo('Stakeholder coordination','Look for documented work with customer contacts and internal teams, including clear commitments, handoffs and expectation setting. Do not infer interpersonal ability from writing style.',
   'An example shows the person aligning customer and internal stakeholders around a need, commitment or resolution.',
   'Relationship building or stakeholder management is claimed without a concrete coordination example.')],
  ['customer_insight',yesNo('Customer insight and feedback','Look for turning customer feedback, usage observations or recurring issues into a practical service or product improvement.',
   'An example connects customer feedback or observed behavior to a specific recommendation, change or shared insight.',
   'Feedback collection or customer advocacy is named without evidence of what was learned or acted on.')],
  ['commercial_expansion',dimension('Commercial expansion context','Consider identification of additional customer needs, renewal coordination or expansion only if commercial responsibility is part of the role. Revenue targets are not universal requirements.',
   'A relevant commercial example connects a customer need to a coordinated renewal or expansion action.',
   'Upselling, revenue or expansion is mentioned without a customer need or identifiable contribution.',false)]
 ]))},
 {name:'Operations Manager',description:starterDescriptions['Operations Manager'],configuration:defaultTemplateConfiguration(dimensions([
  ['years_of_experience',experienceDimension()],
  ['operational_execution',scored('Operational execution','Look for running a repeatable service or business process, handling dependencies and following through on delivery commitments.',
   'A concrete operational process or service is described with the person’s responsibilities and delivery actions.',
   'Operations responsibility is asserted without an identifiable process, service or personal contribution.',
   'An operational example explains the person’s decisions about dependencies or service commitments, how exceptions were handled and how delivery was checked.')],
  ['process_improvement',scored('Process improvement','Look for identifying a bottleneck, error, delay or unnecessary work and implementing a practical improvement. A formal methodology or certification is not required.',
   'An example links an operational problem to an implemented process change and a qualitative or quantitative result.',
   'Efficiency or improvement is claimed without the problem, action or resulting change being clear.',
   'An improvement example links a diagnosed process problem to implementation, evidence of the result and a control or follow-up that helped sustain the change.')],
  ['capacity_and_priorities',dimension('Capacity planning and prioritization','Look for balancing workload, scheduling, staffing or resources against demand and competing commitments. Do not require a specific budget or team size.',
   'A planning example shows how the person allocated resources or adjusted priorities to meet operational needs.',
   'Scheduling, planning or resource management is listed without a concrete allocation or prioritization decision.')],
  ['quality_and_controls',yesNo('Quality controls and risk follow-through','Look for checks, documented procedures, escalation, corrective actions or vendor oversight appropriate to the operation. Do not assume a specific regulatory requirement.',
   'An example identifies an operational quality issue or risk and the person’s control, escalation or corrective action.',
   'Compliance, quality or risk management is named without an identifiable practice or follow-through.')],
  ['team_coordination',yesNo('Team and cross-functional coordination','Look for clear handoffs, coaching, work allocation or coordination across teams or suppliers. Distinguish personal contribution from team-level claims.',
   'An example shows how the person coordinated people or dependencies to sustain or improve an operational outcome.',
   'Leadership, team supervision or cross-functional work is asserted without a concrete coordination example.')],
  ['performance_monitoring',dimension('Performance monitoring and decisions','Look for using service levels, backlog, cost, timeliness, quality indicators or structured feedback to guide operational action. Specific software and numerical targets are not required.',
   'An example connects an operational indicator or structured feedback to a concrete monitoring or corrective decision.',
   'KPIs, reporting or dashboards are listed without evidence of how the information informed an action.')]
 ]))}
 ];}
