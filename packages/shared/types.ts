export type StepStatus = "todo" | "doing" | "done";

export interface AgentStep {
  title: string;
  description: string;
  required: boolean;
  status: StepStatus;
}

export interface AgentCitation {
  title: string;
  sourceId: string;
  documentId?: string;
  label?: string;
  page?: number;
  quote?: string;
}

export interface SchoolProfile { id: string; name: string; campus: string; createdAt: string; }
export interface SourceEvidence { sourceId: string; quote: string; }
export interface FormFieldSchema { key: string; required: boolean; type: "text" | "number" | "date" | "multiline"; evidence: SourceEvidence[]; }
export interface EligibilityCriterion { rule: string; status: "met" | "unmet" | "need_info"; explanation: string; profileKeys: string[]; evidence: SourceEvidence[]; }
export interface GroundedAnalysis {
  schoolId: string; schoolName: string; question: string; title: string;
  knowledgeMode: "imported"; profile: Record<string, string>; providedMaterials: string[];
  eligibility: "preliminary_met" | "unmet" | "need_info";
  criteria: EligibilityCriterion[];
  questions: Array<{ key: string; question: string }>;
  materials: Array<{ name: string; required: boolean; guidance: string; status: "provided" | "missing" | "optional"; evidence: SourceEvidence[] }>;
  formFields: FormFieldSchema[];
  deadline: null | { date: string; explanation: string; expired: boolean; evidence: SourceEvidence[] };
  previousRunId?: string;
  sourceVersions: Array<{ id: string; version: string }>;
}

export interface AgentResult {
  id: string;
  intent: string;
  answer: string;
  steps: AgentStep[];
  extractedFields?: Record<string, string | number | boolean | null>;
  citations: AgentCitation[];
  nextActions: string[];
  mode: "live" | "offline" | "fallback";
  warning?: string;
  trace: Array<{ tool: string; status: string; summary: string }>;
  notice: string;
  createdAt: string;
}

export interface CampusTask {
  id: string;
  title: string;
  serviceId: string;
  runId: string;
  formId?: string;
  progress: number;
  status: "办理中" | "已完成";
  dueAt?: string;
  steps: AgentStep[];
}

export interface OcrRecord {
  id: string;
  fields: Record<string, string>;
  mode: "vision" | "text" | "sample";
  warnings: string[];
  fileId?: { bucket: string; path: string };
}

export interface FormDraft {
  id: string;
  serviceId: string;
  fields: Record<string, string>;
  validation: { valid: boolean; errors: Record<string, string> };
  confirmed: boolean;
}
