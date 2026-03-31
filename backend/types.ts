export interface Deployment {
  id: string;
  env: string;
  status: string;
  timestamp: string;
  version: string;
  duration: string;
  error?: string;
  logs: string[];
  issueIdentified?: string;
  fixApplied?: string;
  tenantId?: string;
  cloudProvider?: string;
  severity?: 'MAJOR' | 'MINOR';
  costEstimate?: number;
  diff?: {
    before: string;
    after: string;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userRole?: string;
  details: string;
  resource?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAJOR';
  ip?: string;
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

export interface SystemSuggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category?: 'cost' | 'security' | 'reliability' | 'performance';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SYSTEM_ADMIN' | 'CLOUD_ENGINEER' | 'DEVOPS_ENGINEER' | 'APPROVER';
  scope: { tenantId: string; cloudProjectId: string }[];
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

export interface ArchitectureNode {
  id: string;
  name: string;
  type: 'pod' | 'service' | 'database' | 'bucket' | 'cluster' | 'repo' | 'vm' | 'topic' | 'cloud' | 'external-users' | 'global-lb' | 'agent';
  status: 'healthy' | 'error' | 'warning';
  details?: string;
  config?: Record<string, any>;
  purpose?: string;
  region?: string;
  zone?: string;
  project?: string;
}

export interface ArchitectureLink {
  source: string;
  target: string;
  type: 'connection' | 'dependency' | 'flow' | 'integration' | 'trigger';
  label?: string;
}

export interface ArchitectureData {
  nodes: ArchitectureNode[];
  links: ArchitectureLink[];
}

export interface Release {
  id: string;
  version: string;
  timestamp: string;
  summary: string;
  type: 'FIX' | 'FEATURE' | 'SYSTEM_UPDATE';
}

export interface Feedback {
  id: string;
  deploymentId: string;
  feedback: string;
  userId: string;
  timestamp: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userMessage: string;
  timestamp: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  evolutionProposal?: string;
}

export interface InfraMap {
  nodes: { id: string; label: string; type: string; x: number; y: number }[];
  edges: { from: string; to: string; label: string }[];
}

export interface GovernancePolicy {
  id: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ENFORCED' | 'BLOCKING' | 'MONITORING';
  description: string;
}

export interface CostRecommendation {
  title: string;
  savings: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  provider: 'GCP' | 'AWS' | 'AZURE';
}
