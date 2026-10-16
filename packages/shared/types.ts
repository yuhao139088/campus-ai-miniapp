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
