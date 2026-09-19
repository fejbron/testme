// Shared client-side response types mirroring the JSON API contract.
// These are hand-maintained to match src/app/api/** route responses.

export type ApiError = { error: string };

export type AssignedCampaign = {
  id: string;
  name: string;
  version: number;
  status: string;
  score: number;
  progress: { completed: number; total: number };
};

export type CategoryBreakdown = { category: string; total: number };

export type StageView = {
  challengeInstanceId: string | null;
  status: string;
  title: string;
  slug: string | null;
  description: string | null;
  points: number | null;
  completionType: string | null;
  scoreAwarded: number;
};

export type RecentEvent = { type: string; at: string; payload: unknown };

export type InstanceOverview = {
  id: string;
  status: string;
  campaign: { name: string; version: number };
  score: number;
  byCategory: CategoryBreakdown[];
  progress: { completed: number; total: number };
  environment: { status: string; services: string[] } | null;
  stages: StageView[];
  recentEvents: RecentEvent[];
};

export type NotebookType = "OBSERVATION" | "HYPOTHESIS" | "EXPERIMENT" | "RESULT" | "CONCLUSION" | "NOTE";

export type NotebookEntry = {
  id: string;
  type: NotebookType;
  title: string;
  content: string;
  confidence: string;
  createdAt: string;
  updatedAt: string;
};

export type Finding = {
  id: string;
  findingType: string;
  title: string;
  structuredDataJson: Record<string, unknown>;
  explanation: string;
  confidence: string;
  createdAt: string;
};

export type ArtifactRow = {
  id: string | null;
  slug: string;
  kind: string;
  sha256: string | null;
  sizeBytes: number;
  ready: boolean;
};

export type HintRow = { id: string; level: number; penalty: number; used: boolean; content: string | null };

export type SubmissionFeedback = {
  passed?: boolean;
  score?: number;
  maxScore?: number;
  categories?: Record<string, unknown>;
  summary?: string;
} | null;

export type SubmissionStatus = "PENDING" | "GRADING" | "PASSED" | "FAILED" | "ERROR";

export type SubmissionView = {
  id: string;
  type: string;
  status: SubmissionStatus;
  scoreAwarded: number | null;
  feedback: SubmissionFeedback;
  submittedAt: string;
  gradedAt: string | null;
};

export type CodeLanguage = "python" | "c" | "javascript";

// Instructor
export type OverviewRow = {
  instanceId: string;
  student: { id: string; name: string; email: string };
  campaign: string;
  status: string;
  score: number;
  progress: { completed: number; total: number };
  environment: string;
  hintsUsed: number;
  failedSubmissions: number;
  lastActivity: string;
};

export type InstructorStageRow = { slug: string; title: string; status: string; score: number; attempts: number };

export type InstructorSubmissionRow = {
  id: string;
  type: string;
  status: string;
  score: number | null;
  feedback: SubmissionFeedback;
  at: string;
};

export type StudentDetailView = {
  student: { id: string; name: string; email: string };
  campaign: string;
  status: string;
  score: number;
  byCategory: CategoryBreakdown[];
  environment: { status: string; ref: string | null } | null;
  stages: InstructorStageRow[];
  notebook: NotebookEntry[];
  findings: Finding[];
  submissions: InstructorSubmissionRow[];
  evidence: unknown[];
  timeline: RecentEvent[];
};

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) {
    const message = (body as ApiError)?.error ?? `request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}
