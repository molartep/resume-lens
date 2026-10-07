import {describe,it,expect} from 'vitest';
import {suggestProfessionalEvidence} from '../server/services/resumeService';

describe('full resume evidence suggestion',()=>{
 it('removes a Markdown name/contact header and preserves the supplied role heading',()=>{
  const professional='# EXPERIENCE\n\n## AI Architect - Example Corp August 2023 - Present, Bogota, Colombia\nBuilt AI products.';
  const source='# Example Candidate Name\n\n[candidate@example.com](mailto:candidate@example.com) +57 3174662178 [linkedin/example-name](https://www.linkedin.com/in/example-name)\n\n'+professional;
  expect(suggestProfessionalEvidence(source)).toBe(professional);
 });
 it('retains unfamiliar sections and useful project links',()=>{
  const text='# Selected Work\nImplemented a compiler.\nhttps://github.com/example/project\n# Community Impact\nMaintained documentation.';
  expect(suggestProfessionalEvidence(text)).toBe(text);
 });
 it('removes complete personal sections including nested headings and resumes at a peer',()=>{
  const source='# Experience\nBuilt APIs.\n# Personal Information\n## Contact\nname@example.com\n## Family\nPrivate details.\n# Selected Work\nBuilt a database.';
  expect(suggestProfessionalEvidence(source)).toBe('# Experience\nBuilt APIs.\n# Selected Work\nBuilt a database.');
 });
 it('stops a nested excluded section at its next peer without losing professional content',()=>{
  expect(suggestProfessionalEvidence('# Resume\n## Contact Details\n+1 5555555555\n## Unusual Projects\nBuilt a tool.')).toBe('# Resume\n## Unusual Projects\nBuilt a tool.');
 });
 it('handles plain-text header and personal sections',()=>{
  expect(suggestProfessionalEvidence('Example Candidate\ncandidate@example.com\nEXPERIENCE\nBuilt APIs.\nPersonal Details:\nNationality: example\nEducation\nEngineering degree.')).toBe('EXPERIENCE\nBuilt APIs.\nEducation\nEngineering degree.');
 });
 it('preserves inline content for review rather than rewriting professional sections',()=>{
  const text='# Experience\nBuilt APIs in Bogota, Colombia.\nMaintained https://example.com/project\nContact collaborator@example.com';
  expect(suggestProfessionalEvidence(text)).toBe(text);
 });
 it('preserves ambiguous unstructured text when no section boundary identifies a header',()=>{
  const text='Built APIs. Contact collaborator@example.com for details.';
  expect(suggestProfessionalEvidence(text)).toBe(text);
 });
 it('does not mistake a professional summary with contact information for a name header',()=>{
  const text='# Professional Summary\nBuilt APIs. example@example.com\n# Projects\nBuilt a tool.';
  expect(suggestProfessionalEvidence(text)).toBe(text);
 });
 it('removes explicit sensitive sections without interpreting their values',()=>{
  expect(suggestProfessionalEvidence('# Projects\nBuilt a tool.\n# Medical History\nPrivate details.\n# Certifications\nCloud certificate.')).toBe('# Projects\nBuilt a tool.\n# Certifications\nCloud certificate.');
 });
});
