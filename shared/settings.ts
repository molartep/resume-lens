import type { ScreeningConfig } from './types';
export type RuntimeSettings = {
  parser: { tier:'fast'|'cost_effective'|'agentic'|'agentic_plus'; version:string; customPrompt:string; disableCache:boolean; timeoutMs:number; pollIntervalMs:number };
  decider: { timeoutMs:number; healthTimeoutMs:number };
  workflow: { maxPdfMb:number; draftExpiryMinutes:number; maxPendingDrafts:number; timezone:string };
  screeningConfig: ScreeningConfig;
};
export type SettingsResponse = {
  settings:RuntimeSettings;
  environment:{llamaIndexApiUrl:string;llamaIndexKeyConfigured:boolean;projectId:string;organizationId:string;deciderUrl:string;databaseConfigured:boolean;port:number};
};
