export interface Deployment {
  id: string;
  env: "production" | "staging" | "development" | string;
  status: "success" | "failed" | "in-progress" | "queued" | "pending-approval" | string;
  timestamp: string;
  version: string;
  duration: string;
  error?: string;
  logs?: string[];
  issueIdentified?: string;
  fixApplied?: string;
  severity?: 'MAJOR' | 'MINOR';
  costEstimate?: number;
  diff?: { before: string; after: string };
  tenantId?: string;
  cloudProvider?: string;
}

export interface Repository {
  id: string;
  name: string;
  platform: 'github' | 'gitlab' | 'bitbucket';
  url: string;
  intelligence: {
    techStack: string[];
    vulnerabilities: number;
    lastScan: string;
  };
}

export interface CloudProvider {
  id: 'gcp' | 'aws' | 'azure' | string;
  name: string;
  icon: string;
}

export interface SystemSuggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category?: 'cost' | 'security' | 'reliability' | 'performance';
}

export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'CLOUD_ENGINEER'
  | 'DEVOPS_ENGINEER'
  | 'APPROVER'
  | 'VIEWER';

export type BotBehavior = 'PASSIVE' | 'ACTIVE' | 'AUTONOMOUS' | 'OBSERVER';

export interface ProjectScope {
  tenantId: string;
  cloudProjectId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  scope: ProjectScope[];
}

export interface AlertTrigger {
  id: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  message: string;
  timestamp: string;
  source: string;
}

export interface Notification {
  id: string;
  type: 'APPROVAL_REQUEST' | 'SYSTEM_ALERT' | 'DEPLOYMENT_SUCCESS' | 'SYSTEM_UPDATE' | 'SECURITY_ALERT';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity?: 'MAJOR' | 'MINOR' | 'CRITICAL';
  userId?: string;
}

export interface ApprovalRequest {
  id: string;
  deploymentId: string;
  planContent: string;
  requestedBy: string;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userRole?: UserRole;
  details: string;
  resource?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAJOR';
  ip?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  id?: string;
}

export interface DeploymentStats {
  date?: string;
  success: number;
  failed: number;
  total?: number;
  avgDuration?: string;
}

export interface ArchitectureNode {
  id: string;
  name: string;
  type:
    | 'pod'
    | 'service'
    | 'database'
    | 'bucket'
    | 'cluster'
    | 'repo'
    | 'vm'
    | 'topic'
    | 'agent'
    | 'global-lb'
    | 'external-users'
    | 'cloud';
  status: 'healthy' | 'error' | 'warning';
  details?: string;
  purpose?: string;
  config?: Record<string, any>;
  region?: string;
  zone?: string;
  project?: string;
  x?: number;
  y?: number;
}

export interface ArchitectureLink {
  source: string;
  target: string;
  type: 'connection' | 'dependency' | 'flow' | 'trigger' | 'integration';
  label?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt?: any;
  updatedAt: any;
}

export type SystemStatus = 'RUNNING' | 'STOPPED' | 'UPDATING';

export interface Ticket {
  id: string;
  userId: string;
  userMessage: string;
  timestamp: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  evolutionProposal?: string;
}

export interface Release {
  id: string;
  version: string;
  timestamp: string;
  summary: string;
  type: 'FIX' | 'FEATURE' | 'SYSTEM_UPDATE';
}

export interface ArchitectureData {
  nodes: ArchitectureNode[];
  links: ArchitectureLink[];
}

export interface Feedback {
  id: string;
  deploymentId: string;
  feedback: string;
  userId: string;
  timestamp: string;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ENFORCED' | 'BLOCKING' | 'MONITORING';
  createdAt?: string;
  lastTriggered?: string;
}

export interface CostRecommendation {
  id?: string;
  title: string;
  description?: string;
  savings?: string;
  estimatedSavings?: number;
  effort?: 'LOW' | 'MEDIUM' | 'HIGH';
  category?: 'compute' | 'storage' | 'network' | 'database';
  resource?: string;
  applied?: boolean;
  impact?: 'HIGH' | 'MEDIUM' | 'LOW';
  provider?: 'GCP' | 'AWS' | 'AZURE';
}

export interface InfraMap {
  nodes: { id: string; label: string; type: string; x: number; y: number }[];
  edges: { from: string; to: string; label: string }[];
}

export interface SystemState {
  architectureData: ArchitectureData;
  infraMap: InfraMap;
  projectId: string;
  serviceAccount?: string;
  isSandbox?: boolean;
  systemStatus?: SystemStatus;
  systemVersion?: string;
  activeTerminalLogs?: any[];
}
