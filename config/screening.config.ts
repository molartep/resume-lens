import type { ScreeningConfig } from '../shared/types';
export const screeningConfig: ScreeningConfig = {
 years_of_experience:{label:'Years of Experience',order:10,type:'score',instructions:{question:'How many years of professional experience does the candidate have, as of today?',today:'{{CURRENT_DATE}}'},criteria:['None','2 years','4 years','6 years','8 years','10+ years']},
 technical_depth:{label:'Technical Depth',order:20,type:'score',instructions:"Rate hands-on engineering depth using the experience and project bullets: what the candidate personally built, how complex it was, how much they owned. Ignore skills keyword lists, titles, and company names. Score the depth shown, not the years worked. When torn between two levels, pick the lower.",criteria:[
 'No roles or projects where they wrote code. Technical exposure is adjacent only: manual QA, IT support, PM, sales engineering.',
 'Coding appears only as coursework, bootcamp, or tutorial projects (to-do apps, clones). Nothing shipped to real users.',
 "Small scoped work inside someone else's design: bug fixes, minor features, CRUD screens. One language, one layer. Bullets list tasks, not problems solved. Also score here if you can't tell what they actually built.",
 'Owns features end to end in a live system: designs, builds, tests, and ships with little supervision. Works across two layers (e.g. API plus frontend). Mentions code review, testing, deploys, or on-call.',
 'Owns whole systems and makes architecture tradeoffs. Depth in two domains (e.g. backend plus infrastructure). Hard problems with numbers attached: performance, scaling, migrations, incidents. Often leads projects or mentors.',
 'Deep specialist with real breadth: maintainer of a widely used open-source project, systems internals (compilers, kernels, distributed systems, database engines), or org-wide architecture ownership at significant scale.'
 ]},
 mentorship_demonstrated:{label:'Mentorship Demonstrated',order:30,type:'noul',instructions:'Does the resume demonstrate mentoring experience?'},
 llm_experience:{label:'LLM Experience',order:40,type:'noul',instructions:'Does the candidate have experience developing LLM products?',criteria:{true:'The candidate has built products or features powered by AI or Large Language Models',false:'The candidate does not show experience building AI products.'}},
 certifications_opensource:{label:'Open Source Experience',order:50,type:'noul',instructions:'Does the candidate have open source experience?'},
 career_progression:{label:'Career Progression',order:60,type:'choice',instructions:'What type of career progression is shown?',criteria:{steady_growth:'Clear progression with increasing seniority',lateral_moves:'Similar roles at different companies',job_hopping:'Frequent changes with short tenure',unclear:'Progression pattern is unclear'},categoryLabels:{steady_growth:'Steady growth',lateral_moves:'Lateral moves',job_hopping:'Frequent short tenures',unclear:'Unclear'}},
 primary_talent_profile:{label:'Primary Talent Profile',order:70,type:'choice',instructions:"Pick the best match for the candidate's talent profile. Judge from their experience holistically, not from job titles or a skills list alone. Weight the most recent roles heaviest.",criteria:{
 frontend_engineer:'Builds user-facing interfaces: React, Vue, or Angular work, design systems, browser performance, accessibility. Consumes APIs but does not own them.',
 backend_engineer:'Builds server-side services, APIs, and data models. Owns business logic, databases, queues, and service performance. Little or no UI work.',
 full_stack_engineer:'Ships both UI and services on the same projects with neither side dominant. Not a backend engineer who occasionally edited a template.',
 mobile_engineer:'Builds iOS, Android, or cross-platform apps (Swift, Kotlin, React Native, Flutter): app store releases, device performance, native SDKs.',
 devops_infrastructure:'Owns how code runs and ships: CI/CD, Kubernetes, Terraform, cloud infrastructure, monitoring, reliability and on-call. Covers DevOps, SRE, and platform engineering.',
 data_engineer:'Builds pipelines and data platforms: ETL, warehouses, Spark, Airflow, dbt, streaming. Serves analysts and models rather than end users.',
 ml_ai_engineer:'Trains, fine-tunes, evaluates, or serves models. Includes applied ML, LLM, and research engineering.',
 security_engineer:'Application, cloud, or product security: threat modeling, penetration testing, detection engineering, identity, vulnerability remediation.',
 embedded_systems:'Low-level work: firmware, drivers, kernels, compilers, robotics, or hardware-constrained C, C++, and Rust.',
 other:'Real engineering that fits none of the above, such as QA automation, game development, or forward-deployed and solutions engineering.'
 },categoryLabels:{frontend_engineer:'Frontend Engineer',backend_engineer:'Backend Engineer',full_stack_engineer:'Full Stack Engineer',mobile_engineer:'Mobile Engineer',devops_infrastructure:'DevOps / Infrastructure',data_engineer:'Data Engineer',ml_ai_engineer:'ML / AI Engineer',security_engineer:'Security Engineer',embedded_systems:'Embedded Systems',other:'Other'}}
};
