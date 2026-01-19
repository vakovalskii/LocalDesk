import type { SDKMessage, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

export type ClaudeSettingsEnv = {
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_MODEL: string;
  API_TIMEOUT_MS: string;
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: string;
};

export type WebSearchProvider = 'tavily' | 'zai';

export type ZaiApiUrl = 'default' | 'coding';

export type ZaiReaderApiUrl = 'default' | 'coding';

export type ApiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;  // Optional temperature for vLLM/OpenAI-compatible APIs
  tavilyApiKey?: string; // Optional Tavily API key for web search
  zaiApiKey?: string; // Optional Z.AI API key for web search
  webSearchProvider?: WebSearchProvider; // Web search provider: 'tavily' or 'zai'
  zaiApiUrl?: ZaiApiUrl; // Z.AI API URL variant: 'default' or 'coding'
  permissionMode?: 'default' | 'ask'; // Permission mode: 'default' = auto-execute, 'ask' = require confirmation
  enableMemory?: boolean; // Enable long-term memory tool
  enableZaiReader?: boolean; // Enable Z.AI Web Reader tool
  zaiReaderApiUrl?: ZaiReaderApiUrl; // Z.AI Reader API URL variant: 'default' or 'coding'
};

export type ModelInfo = {
  id: string;
  name: string;
  description?: string;
};

export type UserPromptMessage = {
  type: "user_prompt";
  prompt: string;
};

export type StreamMessage = SDKMessage | UserPromptMessage;

export type SessionStatus = "idle" | "running" | "completed" | "error";

export type SessionInfo = {
  id: string;
  title: string;
  status: SessionStatus;
  claudeSessionId?: string;
  cwd?: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  threadId?: string; // Thread ID for multi-thread sessions
};

// Todo item type
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

// File change tracking type
export type ChangeStatus = 'pending' | 'confirmed';
export interface FileChange {
  path: string;              // Relative path from project root
  additions: number;         // Number of lines added
  deletions: number;         // Number of lines deleted
  status: ChangeStatus;      // 'pending' = can be rolled back, 'confirmed' = cannot rollback
}

// Thread info for listing threads in a session
export type ThreadInfo = {
  threadId: string;
  model: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
};

// Multi-thread task types
export type MultiThreadTask = {
  id: string;
  title: string;
  mode: TaskMode;
  createdAt: number;
  updatedAt: number;
  status: 'running' | 'completed' | 'error';
  threadIds: string[];
  shareWebCache?: boolean;
  consensusModel?: string;
  consensusQuantity?: number;
  consensusPrompt?: string;
  autoSummary?: boolean;
  tasks?: ThreadTask[];
};

// Server -> Client events
export type ServerEvent =
  | { type: "stream.message"; payload: { sessionId: string; threadId?: string; message: StreamMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId: string; threadId?: string; prompt: string } }
  | { type: "session.status"; payload: { sessionId: string; threadId?: string; status: SessionStatus; title?: string; cwd?: string; error?: string; model?: string } }
  | { type: "session.list"; payload: { sessions: SessionInfo[] } }
  | { type: "session.history"; payload: { sessionId: string; threadId?: string; status: SessionStatus; messages: StreamMessage[]; inputTokens?: number; outputTokens?: number; todos?: TodoItem[]; model?: string; fileChanges?: FileChange[] } }
  | { type: "session.deleted"; payload: { sessionId: string } }
  | { type: "thread.list"; payload: { sessionId: string; threads: ThreadInfo[] } }
  | { type: "task.created"; payload: { task: MultiThreadTask; threads: ThreadInfo[] } }
  | { type: "task.status"; payload: { taskId: string; status: 'running' | 'completed' | 'error' } }
  | { type: "task.deleted"; payload: { taskId: string } }
  | { type: "permission.request"; payload: { sessionId: string; threadId?: string; toolUseId: string; toolName: string; input: unknown; explanation?: string } }
  | { type: "runner.error"; payload: { sessionId?: string; threadId?: string; message: string } }
  | { type: "settings.loaded"; payload: { settings: ApiSettings | null } }
  | { type: "models.loaded"; payload: { models: ModelInfo[] } }
  | { type: "models.error"; payload: { message: string } }
  | { type: "todos.updated"; payload: { sessionId: string; threadId?: string; todos: TodoItem[] } }
  | { type: "file_changes.updated"; payload: { sessionId: string; threadId?: string; fileChanges: FileChange[] } }
  | { type: "file_changes.confirmed"; payload: { sessionId: string; threadId?: string } }
  | { type: "file_changes.rolledback"; payload: { sessionId: string; threadId?: string; fileChanges: FileChange[] } }
  | { type: "file_changes.error"; payload: { sessionId: string; threadId?: string; message: string } };

// Task creation types
export type TaskMode = 'consensus' | 'different_tasks';

export type ThreadTask = {
  model: string;
  prompt: string;
  threadId?: string; // Assigned after creation
};

export type CreateTaskPayload = {
  mode: TaskMode;
  title: string;
  cwd?: string;
  allowedTools?: string;
  // For consensus mode: single model and quantity
  consensusModel?: string;
  consensusQuantity?: number; // 2-10
  autoSummary?: boolean; // Same model creates summary after all threads complete
  // For different tasks mode: array of tasks
  tasks?: ThreadTask[];
  shareWebCache?: boolean; // Share web requests between threads
};

// Client -> Server events
export type ClientEvent =
  | { type: "session.start"; payload: { title: string; prompt: string; cwd?: string; allowedTools?: string; model?: string } }
  | { type: "session.continue"; payload: { sessionId: string; prompt: string } }
  | { type: "session.stop"; payload: { sessionId: string } }
  | { type: "session.delete"; payload: { sessionId: string } }
  | { type: "session.pin"; payload: { sessionId: string; isPinned: boolean } }
  | { type: "session.update-cwd"; payload: { sessionId: string; cwd: string } }
  | { type: "session.list" }
  | { type: "session.history"; payload: { sessionId: string; threadId?: string } }
  | { type: "permission.response"; payload: { sessionId: string; toolUseId: string; result: PermissionResult } }
  | { type: "message.edit"; payload: { sessionId: string; messageIndex: number; newPrompt: string } }
  | { type: "settings.get" }
  | { type: "settings.save"; payload: { settings: ApiSettings } }
  | { type: "open.external"; payload: { url: string } }
  | { type: "models.get" }
  | { type: "task.create"; payload: CreateTaskPayload }
  | { type: "task.delete"; payload: { taskId: string } }
  | { type: "thread.list"; payload: { sessionId: string } }
  | { type: "file_changes.confirm"; payload: { sessionId: string; threadId?: string } }
  | { type: "file_changes.rollback"; payload: { sessionId: string; threadId?: string } };
