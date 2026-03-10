// User & Auth
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  provider: 'github' | 'google' | 'gitlab';
  providerId: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// Workspace
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  createdAt: Date;
}

// Environment & Connections
export interface Environment {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
}

export interface Connection {
  id: string;
  workspaceId: string;
  environmentId?: string;
  type: 'api' | 'mcp';
  provider?: string;
  name: string;
  encryptedSecret?: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  lastHealthCheck?: Date;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  createdAt: Date;
}

// DAG Nodes & Edges
export interface Node {
  id: string;
  workspaceId: string;
  name: string;
  type: 'workflow' | 'source' | 'adapter' | 'output';
  description?: string;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Edge {
  id: string;
  workspaceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Runs
export interface Run {
  id: string;
  workspaceId: string;
  environmentId?: string;
  nodeId?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt?: Date;
  finishedAt?: Date;
  logs: Record<string, unknown>[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// API Response
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}
