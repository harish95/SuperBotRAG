export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Citation {
  document: string;
  page?: number | null;
  snippet: string;
}

export interface ChatQueryResponse {
  answer: string;
  citations: Citation[];
  cached: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: Citation[];
  cached?: boolean;
  failed?: boolean;
}

export type UploadStatus = "processing" | "processed" | "failed";

export interface DocumentRecord {
  id: string;
  filename: string;
  status: UploadStatus;
  uploaded_by: string;
  upload_time: string;
  chunk_count: number;
}

export interface UploadEntry extends DocumentRecord {
  progress?: number;
}

export interface UploadStatusResponse {
  document: DocumentRecord;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface HealthStatus {
  status: string;
  openai_configured: boolean;
  embedding_model: string;
  chat_model: string;
  dynamodb?: string;
  redis?: string;
  qdrant?: string;
  s3?: string;
}
