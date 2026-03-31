import express from "express";
import dotenv from "dotenv";
dotenv.config({ override: true });
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { exec } from "child_process";
import { promisify } from "util";
import { ProjectsClient } from "@google-cloud/resource-manager";
import { InstancesClient } from "@google-cloud/compute";
import { ClusterManagerClient } from "@google-cloud/container";
import { Storage } from "@google-cloud/storage";
import { ServicesClient } from "@google-cloud/run";
import { CloudBuildClient } from "@google-cloud/cloudbuild";
import { ServiceUsageClient } from "@google-cloud/service-usage";
import { PubSub } from "@google-cloud/pubsub";
import { ArtifactRegistryClient } from "@google-cloud/artifact-registry";
import { SqlInstancesServiceClient } from "@google-cloud/sql";
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { 
  Deployment, 
  AuditLog, 
  Repository, 
  SystemSuggestion, 
  User, 
  Notification, 
  ApprovalRequest, 
  ArchitectureNode, 
  ArchitectureLink, 
  ArchitectureData, 
  InfraMap,
  Release, 
  Feedback, 
  Ticket,
  GovernancePolicy,
  CostRecommendation
} from "./types.ts";
import { applyCodeChange, CodeChange } from './self_modification';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase-applet-config.json'), 'utf8'));

async function startServer() {
  const app = express();
  const server = createServer(app);
  let wss;
  try {
    wss = new WebSocketServer({ server });
  } catch (e) {
    console.error("WebSocket server failed to start:", e);
  }
  const PORT = 3000;

  const rootPath = path.join(__dirname, '..');
  console.log(`[SERVER] Starting server...`);
  console.log(`[SERVER] rootPath: ${rootPath}`);

  // Helper to discover available projects
  const discoverProjects = async () => {
    try {
      const tempProjectsClient = new ProjectsClient();
      const [projects] = await tempProjectsClient.searchProjects({ query: '' });
      const projectIds = projects.map(p => p.projectId);
      console.log(`[INIT] Discovered ${projects.length} accessible projects:`, projectIds);
      return projectIds;
    } catch (e) {
      console.warn("[INIT] Could not search for projects. Trying listProjects...");
      try {
        const tempProjectsClient = new ProjectsClient();
        const [projects] = await tempProjectsClient.searchProjects({ query: '*' });
        return projects.map(p => p.projectId);
      } catch (e2) {
        console.error("[INIT] Project discovery failed completely.", e2);
        return [];
      }
    }
  };

  // Detect GCP Project ID for resource discovery
  const gcpProjectId = await (async () => {
    const isValidId = (id: string | undefined) => {
      if (!id) return false;
      const trimmed = id.trim();
      // Standard GCP Project IDs: 6-30 chars, lowercase letters, numbers, and hyphens.
      // Must start with a letter and cannot end with a hyphen.
      return trimmed.length >= 6 && 
             trimmed.length <= 30 &&
             trimmed !== 'mexico-gec' &&
             /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(trimmed);
    };

    const isSandboxId = (id: string) => id.startsWith('ais-us-east1-');

    // 1. Check various environment variables first
    const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCP_PROJECT_ID;
    if (isValidId(envProjectId)) {
      console.log(`[INIT] Using Project ID from environment: ${envProjectId}`);
      if (isSandboxId(envProjectId!)) {
        console.warn(`[INIT] WARNING: Detected AI Studio sandbox project ID (${envProjectId}). You likely want to set your own GCP_PROJECT_ID in AI Studio Secrets.`);
      }
      return envProjectId?.trim();
    }
    
    // 2. Then try metadata server (most reliable in Cloud Run)
    try {
      const response = await fetch("http://metadata.google.internal/computeMetadata/v1/project/project-id", {
        headers: { "Metadata-Flavor": "Google" },
        timeout: 2000
      } as any);
      if (response.ok) {
        const id = await response.text();
        if (isValidId(id)) {
          console.log(`[INIT] Using Project ID from metadata server: ${id.trim()}`);
          return id.trim();
        }
      }
    } catch (e) {
      console.log("[INIT] Metadata server not available or timed out.");
    }

    // 3. Then check Firebase config
    if (isValidId(firebaseConfig.projectId)) {
      console.log(`[INIT] Using Project ID from Firebase config: ${firebaseConfig.projectId}`);
      return firebaseConfig.projectId.trim();
    }
    
    // 4. Discovery fallback
    const discovered = await discoverProjects();
    if (discovered.length > 0) {
      const validDiscovered = discovered.filter(isValidId);
      if (validDiscovered.length > 0) {
        console.log(`[INIT] Using discovered project: ${validDiscovered[0]}`);
        return validDiscovered[0];
      }
      console.warn(`[INIT] Discovered ${discovered.length} projects, but none matched standard GCP ID format (e.g., ${discovered[0]}).`);
    }

    // 5. Last resort fallback
    const fallbackId = firebaseConfig.projectId || "mexico-gec";
    console.warn(`[INIT] Falling back to default project ID: ${fallbackId}. This may cause errors if it's a placeholder.`);
    return fallbackId;
  })();

  const isProduction = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
  console.log(`[INIT] Starting server in ${isProduction ? 'production' : 'development'} mode`);
  console.log(`[INIT] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[INIT] GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`[INIT] Root path: ${rootPath}`);
  console.log(`[INIT] Working directory: ${process.cwd()}`);
  console.log(`[INIT] __dirname: ${__dirname}`);

  app.get("/health", (req, res) => {
    const distPath = path.join(rootPath, "dist");
    const frontendPath = path.join(rootPath, "frontend");
    res.json({
      status: "ok",
      cwd: process.cwd(),
      dirname: __dirname,
      rootPath: rootPath,
      isProduction: isProduction,
      env: process.env.NODE_ENV,
      distExists: fs.existsSync(distPath),
      distContent: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
      frontendExists: fs.existsSync(frontendPath),
      indexExists: fs.existsSync(path.join(distPath, "index.html")),
      frontendIndexExists: fs.existsSync(path.join(frontendPath, "index.html"))
    });
  });

  app.get("/api/debug/projects", async (req, res) => {
    try {
      const [projects] = await projectsClient.searchProjects({ query: '' });
      res.json({
        detectedId: gcpProjectId,
        discovered: projects.map(p => ({ id: p.projectId, name: p.displayName }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message, detectedId: gcpProjectId });
    }
  });

  // Detect Service Account Email
  let clientEmail: string | null = null;
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth();
    const credentials = await auth.getCredentials();
    clientEmail = (credentials as any).client_email || null;
    if (clientEmail) {
      console.log(`[INIT] Application Service Account: ${clientEmail}`);
    }
  } catch (e) {
    console.log("[INIT] Could not determine service account email automatically.");
  }

  app.get("/api/config", async (req, res) => {
    res.json({
      projectId: gcpProjectId,
      serviceAccount: clientEmail || "unknown",
      isSandbox: isSandboxId(gcpProjectId || '')
    });
  });

  // Initialize Firebase Admin using the Project ID from config
  let adminApp;
  try {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId
    });
    console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } catch (err) {
    // If already initialized, we can ignore
    if (!(err as any).message?.includes('already exists')) {
      console.error("Firebase Admin initialization failed.", err);
    }
  }

  // Explicitly create Firestore instance with project and database ID to avoid fallback to environment defaults
  const db = adminApp 
    ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId) 
    : getFirestore(firebaseConfig.firestoreDatabaseId);
  
  // CRITICAL: Enable ignoreUndefinedProperties to prevent Firestore crashes when GCP resources have missing fields
  db.settings({ ignoreUndefinedProperties: true });
  
  console.log(`Firestore instance created for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId}`);

  // Seed database with initial data if empty
  const seedDatabase = async () => {
    try {
      const governanceRef = db.collection('governance_policies');
      const costRef = db.collection('cost_recommendations');
      const notificationsRef = db.collection('notifications');

      const govSnapshot = await governanceRef.limit(1).get();
      if (govSnapshot.empty) {
        console.log("[SEED] Seeding governance policies...");
        const policies: GovernancePolicy[] = [
          { id: 'POL-001', name: 'NO_PUBLIC_S3_BUCKETS', severity: 'CRITICAL', status: 'ENFORCED', description: 'Prevents creation of publicly accessible S3 buckets.' },
          { id: 'POL-002', name: 'MFA_REQUIRED_FOR_ADMIN', severity: 'HIGH', status: 'ENFORCED', description: 'Requires multi-factor authentication for all administrative actions.' },
          { id: 'POL-003', name: 'COST_LIMIT_EXCEEDED_ALERT', severity: 'MEDIUM', status: 'MONITORING', description: 'Triggers an alert when monthly cloud spend exceeds $10,000.' },
          { id: 'POL-004', name: 'UNAUTHORIZED_REGION_DEPLOY', severity: 'HIGH', status: 'BLOCKING', description: 'Blocks deployments to unauthorized cloud regions.' }
        ];
        for (const p of policies) await governanceRef.doc(p.id).set(p);
      }

      const costSnapshot = await costRef.limit(1).get();
      if (costSnapshot.empty) {
        console.log("[SEED] Seeding cost recommendations...");
        const recommendations: CostRecommendation[] = [
          { title: 'RIGHTSIZE_COMPUTE_INSTANCES', savings: '$1,200/mo', impact: 'HIGH', provider: 'GCP' },
          { title: 'DELETE_UNATTACHED_DISKS', savings: '$450/mo', impact: 'MEDIUM', provider: 'AWS' },
          { title: 'PURCHASE_RESERVED_INSTANCES', savings: '$2,800/yr', impact: 'HIGH', provider: 'AZURE' },
          { title: 'CLEANUP_STALE_SNAPSHOTS', savings: '$120/mo', impact: 'LOW', provider: 'GCP' }
        ];
        for (const r of recommendations) await costRef.doc(r.title.replace(/\s+/g, '_')).set(r);
      }

      const notifSnapshot = await notificationsRef.limit(1).get();
      if (notifSnapshot.empty) {
        console.log("[SEED] Seeding initial notifications...");
        const initialNotifications: Notification[] = [
          {
            id: 'NOT-INIT-001',
            type: 'SYSTEM_UPDATE',
            title: 'SYSTEM_UPDATE_AVAILABLE',
            message: 'A new system update (v1.1.0) is available with enhanced security protocols. Click to apply.',
            timestamp: new Date().toISOString(),
            read: false,
            severity: 'MAJOR'
          },
          {
            id: 'NOT-INIT-002',
            type: 'SECURITY_ALERT',
            title: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            message: 'Detected 3 failed login attempts from IP 192.168.1.105. System locked for 15 minutes.',
            timestamp: new Date().toISOString(),
            read: false,
            severity: 'CRITICAL'
          }
        ];
        for (const n of initialNotifications) await notificationsRef.doc(n.id).set(n);
      }

      const suggestionsRef = db.collection('system_suggestions');
      const suggestionsSnapshot = await suggestionsRef.limit(1).get();
      if (suggestionsSnapshot.empty) {
        console.log("[SEED] Seeding system suggestions...");
        const initialSuggestions = [
          {
            id: 'SUG-001',
            title: 'ENABLE_GKE_AUTOPILOT',
            description: 'Transition existing GKE clusters to Autopilot mode to reduce management overhead and optimize resource utilization.',
            impact: 'high',
            category: 'performance'
          },
          {
            id: 'SUG-002',
            title: 'IMPLEMENT_CLOUD_ARMOR_WAF',
            description: 'Deploy Cloud Armor security policies to protect public-facing endpoints from common web attacks and DDoS.',
            impact: 'high',
            category: 'security'
          },
          {
            id: 'SUG-003',
            title: 'OPTIMIZE_STORAGE_LIFECYCLE',
            description: 'Configure lifecycle rules for GCS buckets to automatically move data to Archive storage after 90 days of inactivity.',
            impact: 'medium',
            category: 'cost'
          }
        ];
        for (const s of initialSuggestions) await suggestionsRef.doc(s.id).set(s);
      }
    } catch (err) {
      console.error("[SEED] Error seeding database:", err);
    }
  };

  await seedDatabase();

  // Request logging
  app.use((req, res, next) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/assets')) {
      console.log(`[REQUEST] ${req.method} ${req.url}`);
    }
    next();
  });

  app.use(express.json());

  // Debug route to verify server status
  app.get("/debug", (req, res) => {
    res.json({
      status: "running",
      env: process.env.NODE_ENV || "development",
      gcpProjectId,
      firebaseProjectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString()
    });
  });

  // Endpoint to serve the Gemini API key to the frontend
  // This is necessary because the platform injects the key into the backend environment
  app.get("/api/gemini-key", (req, res) => {
    const envVars = Object.keys(process.env);
    const keyVars = envVars.filter(k => k.includes('KEY') || k.includes('API') || k.includes('GEMINI'));
    
    console.log("[SECURITY] Available key-related environment variables:", keyVars);

    const key = process.env.API_KEY || 
                process.env.GEMINI_API_KEY || 
                process.env.GOOGLE_API_KEY || 
                process.env.VITE_GEMINI_API_KEY ||
                process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
                process.env.GOOGLE_GENERATIVE_AI_KEY ||
                process.env.GEMINI_KEY;

    const isPlaceholder = (k: string | undefined) => 
      !k || k === 'undefined' || k === 'null' || k === 'MY_GEMINI_API_KEY' || k === 'YOUR_API_KEY' || k === 'TODO_KEYHERE' || k.length < 5;

    if (isPlaceholder(key)) {
      console.warn("[SECURITY] No valid Gemini API key found in environment variables. Checked:", keyVars);
      return res.status(404).json({ 
        error: "API key not configured",
        availableVars: keyVars,
        message: "Please ensure you have configured a Gemini API key in AI Studio settings (Secrets) or selected one via the SELECT_API_KEY button."
      });
    }
    
    console.log(`[SECURITY] Serving Gemini API key (length: ${key.length}, prefix: ${key.substring(0, 4)}...)`);
    res.json({ key });
  });

  // GCP Clients using the detected GCP Project ID
  const clientOptions = { projectId: gcpProjectId && gcpProjectId !== '0' ? gcpProjectId : undefined };
  const projectsClient = new ProjectsClient(clientOptions);
  const instancesClient = new InstancesClient(clientOptions);
  const clustersClient = new ClusterManagerClient(clientOptions);
  const storage = new Storage(clientOptions);
  const runClient = new ServicesClient(clientOptions);
  const cloudBuildClient = new CloudBuildClient(clientOptions);
  const serviceUsageClient = new ServiceUsageClient(clientOptions);
  const pubsubClient = new PubSub(clientOptions);
  const artifactRegistryClient = new ArtifactRegistryClient(clientOptions);
  const sqlClient = new SqlInstancesServiceClient(clientOptions);

  // Regex Scrubber for Log Masking
  const scrubLogs = (logs: string[]) => {
    const ipv4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const ipv6 = /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi;
    const ports = /:\d{2,5}\b/g;
    const apiKeys = /\b[a-zA-Z0-9]{32,}\b/g; // Simplified key pattern
    
    return logs.map(log => 
      log.replace(ipv4, '[MASKED_IP]')
         .replace(ipv6, '[MASKED_IP]')
         .replace(ports, ':[MASKED_PORT]')
         .replace(apiKeys, '[MASKED_KEY]')
    );
  };

  // Broadcast to all clients with Role-Based Masking
  const broadcast = (data: any, targetRole?: string) => {
    wss?.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        const userRole = (client as any).userRole || 'DEVOPS_ENGINEER';
        
        // If targetRole is specified, only broadcast to that role (or SYSTEM_ADMIN)
        if (targetRole && userRole !== targetRole && userRole !== 'SYSTEM_ADMIN') {
          return;
        }

        let payload = data;

        if (userRole !== 'SYSTEM_ADMIN') {
          // Mask logs in deployments
          if (data.type === 'DEPLOYMENT_UPDATED' || data.type === 'DEPLOYMENT_CREATED') {
            payload = { 
              ...data, 
              deployment: { 
                ...data.deployment, 
                logs: scrubLogs(data.deployment.logs) 
              } 
            };
          }
          // Mask active terminal logs
          if (data.type === 'SYNC_STATE') {
            payload = { 
              ...data, 
              state: { 
                ...data.state, 
                activeTerminalLogs: scrubLogs(data.state.activeTerminalLogs) 
              } 
            };
          }
          // Architecture Privacy: Hide sensitive metadata unless Admin or Cloud Engineer
          if (data.type === 'ARCHITECTURE_UPDATED' && userRole !== 'CLOUD_ENGINEER') {
            payload = { 
              ...data, 
              architecture: { 
                ...data.architecture, 
                nodes: data.architecture.nodes.map((n: any) => ({ 
                  ...n, 
                  details: n.details ? '[HIDDEN_METADATA]' : null 
                })) 
              } 
            };
          }
        }
        client.send(JSON.stringify(payload));
      }
    });
  };

  // RBAC Middleware
  const checkRole = (allowedRoles: string[]) => (req: any, res: any, next: any) => {
    const userRole = req.headers['x-user-role'] || 'DEVOPS_ENGINEER'; // Default for demo
    if (allowedRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ error: `Access Denied: Role ${userRole} is not authorized.` });
    }
  };

  // Double-Factor Validation Middleware
  const checkSecretKey = (req: any, res: any, next: any) => {
    const secretKey = req.headers['x-admin-secret-key'];
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    
    // If no secret is set in environment, we allow any key or empty key for demo purposes
    if (!adminSecret || secretKey === adminSecret) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized: Invalid or Missing Admin Secret Key." });
    }
  };

  // Initial System State
  let systemStatus: 'RUNNING' | 'STOPPED' | 'UPDATING' = 'RUNNING';
  let systemVersion = 'v1.0.0 Stable';
  let systemState = {
    projectId: process.env.GCP_PROJECT_ID || 'mexico-gec',
    serviceAccount: clientEmail,
    activeTerminalLogs: [] as string[],
    systemStatus: 'RUNNING',
    systemVersion: 'v1.0.0 Stable'
  };
  let architectureData: ArchitectureData = { nodes: [], links: [] };
  let infraMap: InfraMap = { nodes: [], edges: [] };

  // Load state from Firestore
  try {
    const stateDoc = await db.collection('system_state').doc('global').get();
    if (stateDoc.exists) {
      const data = stateDoc.data();
      systemStatus = data?.systemStatus || systemStatus;
      systemVersion = data?.systemVersion || systemVersion;
      systemState = {
        ...systemState,
        systemStatus,
        systemVersion,
        serviceAccount: data?.serviceAccount || clientEmail,
        activeTerminalLogs: data?.activeTerminalLogs || []
      };
      architectureData = data?.architectureData || architectureData;
      infraMap = data?.infraMap || infraMap;
    }
  } catch (err) {
    console.error("Failed to load system state from Firestore:", err);
  }

  // Helper to fetch from Firestore with fallback
  const getFirestoreData = async <T>(collectionName: string, fallback: T[] = []): Promise<T[]> => {
    try {
      const snapshot = await db.collection(collectionName).get();
      if (snapshot.empty) return fallback;
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (err: any) {
      console.error(`Error fetching ${collectionName} from Firestore:`, err);
      if (err.message && err.message.includes('PERMISSION_DENIED')) {
        const projectId = firebaseConfig.projectId || "mexico-gec";
        const cmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/datastore.user"`;
        broadcast({
          type: 'log',
          payload: `[SECURITY_ALERT] Permission denied for Firestore collection '${collectionName}'. Run: ${cmd}`
        }, 'admin');
      }
      return fallback;
    }
  };

  // Remove local interfaces as they are imported

  const getGcpErrorMessage = (e: any) => {
    // Handle GaxiosError specifically
    if (e.response?.data?.error?.message) return e.response.data.error.message;
    if (e.response?.data?.message) return e.response.data.message;
    if (e.response?.data?.error_description) return e.response.data.error_description;
    
    // Handle ErrorInfo from Google APIs
    if (e.response?.data?.error?.details) {
      const details = e.response.data.error.details;
      const errorInfo = details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo');
      if (errorInfo) {
        return `${e.response.data.error.message} (Reason: ${errorInfo.reason}, Domain: ${errorInfo.domain})`;
      }
    }

    if (e.errors && Array.isArray(e.errors) && e.errors[0]?.message) return e.errors[0].message;
    
    if (e.message) {
      try {
        // Handle stringified JSON errors
        const json = JSON.parse(e.message);
        if (json.error?.message) return json.error.message;
        if (json.message) return json.message;
      } catch (err) {}
      
      // Clean up common GaxiosError noise
      return e.message.replace(/GaxiosError: /, '').replace(/\{[\s\S]*\}/, '').trim() || e.message;
    }
    return "Unknown error";
  };

  const isSandboxId = (id: string) => id.startsWith('ais-us-east1-');

  const refreshGcpData = async () => {
    const projectId = gcpProjectId;
    if (!projectId || projectId === '0') {
      console.warn(`[GCP] Invalid Project ID: ${projectId}. Skipping resource fetch to avoid errors.`);
      broadcast({ type: 'log', payload: `[WARN] GCP Project ID is invalid ('${projectId}'). Resource discovery is disabled until a valid project is configured.` }, 'admin');
      return;
    }

    const isSandbox = isSandboxId(projectId);
    const sandboxWarning = isSandbox ? " (WARNING: This is the AI Studio sandbox project. If you intended to manage your own project, please set GCP_PROJECT_ID in AI Studio Secrets.)" : "";

    console.log(`[GCP] Refreshing data for project: ${projectId}`);
    broadcast({ 
      type: 'log', 
      payload: `[GCP] Starting resource discovery for project: ${projectId}.${sandboxWarning} If this ID is incorrect (e.g., it's a display name like "Mexico GEC" instead of "mexico-gec-12345"), please update the GCP_PROJECT_ID in AI Studio settings.` 
    }, 'admin');
    const requiredApis = [
      'run.googleapis.com',
      'container.googleapis.com',
      'compute.googleapis.com',
      'cloudbuild.googleapis.com',
      'storage-api.googleapis.com',
      'artifactregistry.googleapis.com',
      'pubsub.googleapis.com',
      'sqladmin.googleapis.com'
    ];

    for (const api of requiredApis) {
      try {
        const [service] = await serviceUsageClient.getService({ name: `projects/${projectId}/services/${api}` });
        if (service.state !== 'ENABLED') {
          console.log(`[GCP] API ${api} is not enabled in project ${projectId}. Attempting to enable...`);
          const [operation] = await serviceUsageClient.enableService({ name: `projects/${projectId}/services/${api}` });
          await operation.promise();
          console.log(`[GCP] Successfully enabled API: ${api}`);
          broadcast({ type: 'log', payload: `SUCCESS: Enabled API ${api} in project ${projectId}.` }, 'admin');
        }
      } catch (e: any) {
        const errMsg = e.message || "Unknown error";
        const gcloudEnableCmd = `gcloud services enable ${api} --project ${projectId}`;
        
        if (e.message?.includes('denied') || e.code === 403) {
           console.warn(`[GCP] Permission denied to check/enable API ${api}. Skipping.`);
           broadcast({
             type: 'log',
             payload: `[ERROR] Permission denied to enable API ${api} in project ${projectId}. Run: ${gcloudEnableCmd}`
           }, 'admin');
        } else if (e.message?.includes('not found') || e.code === 404) {
           console.warn(`[GCP] API ${api} or project ${projectId} not found. Skipping.`);
        } else {
           console.error(`[GCP] Could not check/enable API ${api}:`, errMsg);
           broadcast({
             type: 'log',
             payload: `[ERROR] Failed to check/enable API ${api} in project ${projectId}: ${errMsg}. Run: ${gcloudEnableCmd}`
           }, 'admin');
        }
      }
    }

    console.log(`Refreshing GCP data for project: ${projectId}`);
    const newNodes: ArchitectureNode[] = [];
    const newLinks: ArchitectureLink[] = [];
    const newInfraNodes: any[] = [
      { id: 'gcp', label: `GCP (${projectId})`, type: 'cloud', x: 500, y: 100 },
      { id: 'addb-agent', label: 'ADDB Sovereign Agent', type: 'agent', x: 300, y: 200 },
    ];
    newNodes.push({ 
      id: 'gcp', 
      name: `GCP Project: ${projectId}`, 
      type: 'cloud', 
      status: 'healthy', 
      purpose: 'Central cloud infrastructure provider hosting all managed services and resources.',
      details: `Project ID: ${projectId}`
    });
    newNodes.push({ 
      id: 'addb-agent', 
      name: 'ADDB Sovereign Agent', 
      type: 'service', 
      status: 'healthy', 
      purpose: 'Autonomous management layer that monitors, evolves, and maintains the cloud environment.',
      details: 'Status: Active, Mode: Autonomous'
    });
    newNodes.push({ 
      id: 'cicd-pipeline', 
      name: 'CI/CD Pipeline (Cloud Build)', 
      type: 'service', 
      status: 'healthy', 
      purpose: 'Automated workflow for building, testing, and deploying containerized applications.',
      details: 'Managed by Cloud Build'
    });
    newNodes.push({ 
      id: 'external-users', 
      name: 'External Users', 
      type: 'vm', 
      status: 'healthy', 
      purpose: 'End users accessing the system via public internet.',
      details: 'Traffic source: Global'
    });
    newNodes.push({ 
      id: 'global-lb', 
      name: 'Global Load Balancer', 
      type: 'service', 
      status: 'healthy', 
      purpose: 'Distributes incoming traffic across multiple backend services and regions.',
      details: 'Type: HTTPS Load Balancing'
    });
    newLinks.push({ source: 'external-users', target: 'global-lb', type: 'flow', label: 'HTTPS Traffic' });

    const newInfraEdges: any[] = [
      { from: 'external-users', to: 'global-lb', label: 'Traffic' },
      { from: 'addb-agent', to: 'gcp', label: 'Management' },
    ];

    try {
      // 1. Fetch GKE Clusters
      try {
        const [clusters] = await clustersClient.listClusters({ parent: `projects/${projectId}/locations/-` });
        console.log(`Fetched ${clusters.clusters?.length || 0} GKE clusters.`);
        clusters.clusters?.forEach((c, i) => {
          const id = `cluster-${c.name}`;
          const location = c.location || '';
          const isZone = location.split('-').length > 2;
          newNodes.push({ 
            id, 
            name: c.name || 'unknown', 
            type: 'cluster', 
            status: 'healthy', 
            purpose: 'Managed Kubernetes service for orchestrating containerized applications with high availability.',
            details: `Location: ${c.location}, Version: ${c.initialClusterVersion}`,
            region: isZone ? location.split('-').slice(0, 2).join('-') : location,
            zone: isZone ? location : null,
            project: projectId,
            config: {
              endpoint: c.endpoint,
              nodeCount: c.currentNodeCount,
              status: c.status
            }
          });
          newInfraNodes.push({ id, label: c.name, type: 'resource', x: 700, y: 50 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'GKE' });
          newLinks.push({ source: 'global-lb', target: id, type: 'flow', label: 'Routes to' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching GKE clusters: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
                             
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/container.viewer"`;
        const gcloudEnableCmd = `gcloud services enable container.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch GKE clusters in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : "Ensure 'container.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback if real fetch fails
        const mockClusters = [
          { name: 'prod-cluster-01', location: 'us-central1', version: '1.27.3-gke.100', status: 'RUNNING', nodeCount: 3 },
          { name: 'dev-cluster-01', location: 'us-east1-b', version: '1.27.3-gke.100', status: 'RUNNING', nodeCount: 1 }
        ];
        mockClusters.forEach((c, i) => {
          const id = `cluster-${c.name}`;
          const location = c.location;
          const isZone = location.split('-').length > 2;
          newNodes.push({ 
            id, 
            name: c.name, 
            type: 'cluster', 
            status: 'healthy', 
            purpose: 'Managed Kubernetes service (Mock Fallback).',
            details: `Location: ${c.location}, Version: ${c.version}`,
            region: isZone ? location.split('-').slice(0, 2).join('-') : location,
            zone: isZone ? location : null,
            project: projectId,
            config: {
              endpoint: '34.123.45.67',
              nodeCount: c.nodeCount,
              status: c.status
            }
          });
          newInfraNodes.push({ id, label: c.name, type: 'resource', x: 700, y: 50 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'GKE' });
          newLinks.push({ source: 'global-lb', target: id, type: 'flow', label: 'Routes to' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'GKE'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'GKE'
          }, 'admin');
        }
      }

      // 2. Fetch Cloud Run Services
      try {
        const [runServices] = await runClient.listServices({ parent: `projects/${projectId}/locations/-` });
        console.log(`Fetched ${runServices.length || 0} Cloud Run services.`);
        runServices.forEach((s, i) => {
          const id = `run-${s.name}`;
          const region = s.name?.split('/')[3];
          newNodes.push({ 
            id, 
            name: s.name || 'unknown', 
            type: 'service', 
            status: 'healthy', 
            purpose: 'Serverless platform for deploying highly scalable containerized applications without managing infrastructure.',
            details: `URL: ${s.uri}, Region: ${region}`,
            region: region,
            project: projectId,
            config: {
              ingress: s.ingress,
              generation: s.generation,
              revisions: s.latestReadyRevision
            }
          });
          newInfraNodes.push({ id, label: s.name, type: 'resource', x: 850, y: 150 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Cloud Run' });
          newLinks.push({ source: 'global-lb', target: id, type: 'flow', label: 'Routes to' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching Cloud Run services: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
                             
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/run.viewer"`;
        const gcloudEnableCmd = `gcloud services enable run.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch Cloud Run services in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : "Ensure 'run.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback if real fetch fails
        const mockServices = [
          { name: 'api-gateway', location: 'us-central1', url: 'https://api-gateway-xyz.a.run.app' },
          { name: 'auth-service', location: 'us-east1', url: 'https://auth-service-xyz.a.run.app' }
        ];
        mockServices.forEach((s, i) => {
          const id = `run-${s.name}`;
          newNodes.push({ 
            id, 
            name: s.name, 
            type: 'service', 
            status: 'healthy', 
            purpose: 'Serverless platform for running containerized applications (Mock Fallback).',
            details: `Region: ${s.location}, URL: ${s.url}`,
            region: s.location,
            project: projectId,
            config: {
              url: s.url,
              ingress: 'all'
            }
          });
          newInfraNodes.push({ id, label: s.name, type: 'resource', x: 850, y: 50 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Cloud Run' });
          newLinks.push({ source: 'global-lb', target: id, type: 'flow', label: 'Routes to' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'Cloud Run'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'Cloud Run'
          }, 'admin');
        }
      }

      // 3. Fetch GCS Buckets
      try {
        const [buckets] = await storage.getBuckets();
        console.log(`Fetched ${buckets.length || 0} GCS buckets.`);
        buckets.forEach((b, i) => {
          const id = `bucket-${b.name}`;
          newNodes.push({ 
            id, 
            name: b.name, 
            type: 'bucket', 
            status: 'healthy', 
            purpose: 'Highly durable and scalable object storage for unstructured data such as logs, backups, and media.',
            details: `Location: ${b.metadata.location}, Storage Class: ${b.metadata.storageClass}`,
            region: b.metadata.location,
            project: projectId,
            config: {
              versioning: b.metadata.versioning?.enabled,
              lifecycle: b.metadata.lifecycle?.rule?.length || 0
            }
          });
          newInfraNodes.push({ id, label: b.name, type: 'resource', x: 550, y: 350 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'GCS' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching GCS buckets: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
        const isInvalidProject = errMsg.includes('Project id: 0') || errMsg.includes('invalid') || errMsg.includes('not found');
        
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/storage.admin"`;
        const gcloudEnableCmd = `gcloud services enable storage-api.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch GCS buckets in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : isInvalidProject ? "INVALID_PROJECT_ID. Please check your GCP_PROJECT_ID setting in AI Studio Secrets. It must be the lowercase ID, not the display name." : "Ensure 'storage-api.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback if real fetch fails
        const mockBuckets = [
          { name: 'sovereign-assets-prod', location: 'US', storageClass: 'STANDARD' },
          { name: 'system-logs-archive', location: 'US-EAST1', storageClass: 'COLDLINE' }
        ];
        mockBuckets.forEach((b, i) => {
          const id = `gcs-${b.name}`;
          newNodes.push({ 
            id, 
            name: b.name, 
            type: 'bucket', 
            status: 'healthy', 
            purpose: 'Object storage for unstructured data (Mock Fallback).',
            details: `Location: ${b.location}, Class: ${b.storageClass}`,
            region: b.location,
            project: projectId,
            config: {
              location: b.location,
              storageClass: b.storageClass
            }
          });
          newInfraNodes.push({ id, label: b.name, type: 'resource', x: 550, y: 350 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'GCS' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'GCS'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'GCS'
          }, 'admin');
        }
      }

      // 4. Fetch Compute Instances (Aggregated List for ALL zones)
      try {
        console.log(`Fetching GCE instances for project: ${projectId}`);
        // In @google-cloud/compute v6, aggregatedList returns an iterable
        const iterable = instancesClient.aggregatedListAsync({
          project: projectId,
        });
        
        let idx = 0;
        for await (const [zone, instancesObject] of iterable) {
          const zoneInstances = instancesObject.instances;
          if (zoneInstances) {
            zoneInstances.forEach((i: any) => {
              const id = `vm-${i.name}`;
              const region = zone.split('-').slice(0, 2).join('-');
              newNodes.push({ 
                id, 
                name: i.name || 'unknown', 
                type: 'vm', 
                status: i.status === 'RUNNING' ? 'healthy' : 'warning', 
                purpose: 'Customizable virtual machine instances for running specialized workloads and legacy applications.',
                details: `Zone: ${zone}, Machine Type: ${i.machineType?.split('/').pop()}`,
                region: region,
                zone: zone || null,
                project: projectId,
                config: {
                  cpu: i.cpuPlatform,
                  status: i.status,
                  disks: i.disks?.length
                }
              });
              newInfraNodes.push({ id, label: i.name, type: 'resource', x: 400, y: 450 + (idx * 60) });
              newInfraEdges.push({ from: 'gcp', to: id, label: 'Compute' });
              idx++;
            });
          }
        }
        console.log(`Fetched ${idx} GCE instances.`);
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching GCE instances: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
                             
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/compute.viewer"`;
        const gcloudEnableCmd = `gcloud services enable compute.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch GCE instances in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : "Ensure 'compute.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback if real fetch fails
        const mockVms = [
          { name: 'bastion-host-01', zone: 'us-central1-a', machineType: 'e2-medium', status: 'RUNNING' },
          { name: 'worker-node-legacy', zone: 'us-east1-b', machineType: 'n2-standard-4', status: 'RUNNING' }
        ];
        mockVms.forEach((v, i) => {
          const id = `gce-${v.name}`;
          newNodes.push({ 
            id, 
            name: v.name, 
            type: 'vm', 
            status: 'healthy', 
            purpose: 'Virtual machine instance for legacy workloads (Mock Fallback).',
            details: `Zone: ${v.zone}, Type: ${v.machineType}`,
            region: v.zone.split('-').slice(0, 2).join('-'),
            zone: v.zone || null,
            project: projectId,
            config: {
              machineType: v.machineType,
              status: v.status
            }
          });
          newInfraNodes.push({ id, label: v.name, type: 'resource', x: 550, y: 50 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'GCE' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'GCE'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'GCE'
          }, 'admin');
        }
      }

      // 5. Fetch Pub/Sub Topics
      try {
        const [topics] = await pubsubClient.getTopics();
        console.log(`Fetched ${topics.length} Pub/Sub topics.`);
        topics.forEach((t, i) => {
          const name = t.name.split('/').pop() || 'unknown';
          const id = `pubsub-${name}`;
          newNodes.push({ 
            id, 
            name, 
            type: 'topic', 
            status: 'healthy', 
            purpose: 'Asynchronous messaging service that decouples services that produce events from services that process events.',
            details: `Topic: ${t.name}`,
            region: 'global',
            project: projectId,
            config: {
              kmsKey: t.metadata?.kmsKeyName || 'default'
            }
          });
          newInfraNodes.push({ id, label: name, type: 'resource', x: 200, y: 500 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Pub/Sub' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching Pub/Sub topics: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const gcloudCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/pubsub.viewer"`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch Pub/Sub topics in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudCmd}` : "Ensure 'pubsub.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback
        const mockTopics = [
          { name: 'system-events', labels: { env: 'prod' } },
          { name: 'user-notifications', labels: { env: 'prod' } }
        ];
        mockTopics.forEach((t, i) => {
          const id = `pubsub-${t.name}`;
          newNodes.push({ 
            id, 
            name: t.name, 
            type: 'service', 
            status: 'healthy', 
            purpose: 'Messaging service for event-driven architectures (Mock Fallback).',
            details: `Topic: ${t.name}`,
            project: projectId
          });
          newInfraNodes.push({ id, label: t.name, type: 'resource', x: 400, y: 400 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Pub/Sub' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudCmd,
            resource: 'Pub/Sub'
          }, 'admin');
        }
      }

      // 6. Fetch Artifact Registry Repositories
      try {
        const [repos] = await artifactRegistryClient.listRepositories({ parent: `projects/${projectId}/locations/-` });
        console.log(`Fetched ${repos.length} Artifact Registry repositories.`);
        repos.forEach((r, i) => {
          const name = r.name?.split('/').pop() || 'unknown';
          const id = `artifact-${name}`;
          const region = r.name?.split('/')[3];
          newNodes.push({ 
            id, 
            name, 
            type: 'repo', 
            status: 'healthy', 
            purpose: 'Single place for your organization to manage container images and language packages (such as Maven and npm).',
            details: `Format: ${r.format}, Location: ${region}`,
            region: region,
            project: projectId,
            config: {
              mode: r.mode,
              immutableTags: (r as any).immutableTags
            }
          });
          newInfraNodes.push({ id, label: name, type: 'resource', x: 100, y: 300 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Artifact Registry' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching Artifact Registry repos: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const gcloudCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/artifactregistry.reader"`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch Artifact Registry repos in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudCmd}` : "Ensure 'artifactregistry.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback
        const mockRepos = [
          { name: 'docker-repo', format: 'DOCKER', location: 'us-central1' },
          { name: 'npm-repo', format: 'NPM', location: 'us-central1' }
        ];
        mockRepos.forEach((r, i) => {
          const id = `ar-${r.name}`;
          newNodes.push({ 
            id, 
            name: r.name, 
            type: 'service', 
            status: 'healthy', 
            purpose: 'Managed repository for container images and language packages (Mock Fallback).',
            details: `Format: ${r.format}, Region: ${r.location}`,
            project: projectId
          });
          newInfraNodes.push({ id, label: r.name, type: 'resource', x: 250, y: 400 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Artifact Registry' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudCmd,
            resource: 'Artifact Registry'
          }, 'admin');
        }
      }

      // 7. Fetch Cloud SQL Instances
      try {
        const [sqlInstances] = await sqlClient.list({ project: projectId });
        console.log(`Fetched ${sqlInstances.items?.length || 0} Cloud SQL instances.`);
        sqlInstances.items?.forEach((inst, i) => {
          const id = `sql-${inst.name}`;
          newNodes.push({
            id,
            name: inst.name || 'unknown',
            type: 'database',
            status: inst.state === 'RUNNABLE' ? 'healthy' : 'warning',
            purpose: 'Fully managed relational database service for MySQL, PostgreSQL, and SQL Server with automated backups and scaling.',
            details: `Engine: ${inst.databaseVersion}, Region: ${inst.region}`,
            region: inst.region,
            project: projectId,
            config: {
              tier: inst.settings?.tier,
              storage: inst.settings?.dataDiskSizeGb,
              backup: inst.settings?.backupConfiguration?.enabled
            }
          });
          newInfraNodes.push({ id, label: inst.name, type: 'resource', x: 300, y: 600 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Cloud SQL' });
        });
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching Cloud SQL instances: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
                             
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/cloudsql.viewer"`;
        const gcloudEnableCmd = `gcloud services enable sqladmin.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch Cloud SQL instances in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : "Ensure 'sqladmin.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback
        const mockSql = [
          { name: 'main-db-01', databaseVersion: 'POSTGRES_14', region: 'us-central1', state: 'RUNNABLE' }
        ];
        mockSql.forEach((s, i) => {
          const id = `sql-${s.name}`;
          newNodes.push({ 
            id, 
            name: s.name, 
            type: 'database', 
            status: 'healthy', 
            purpose: 'Managed relational database service (Mock Fallback).',
            details: `Version: ${s.databaseVersion}, Region: ${s.region}`,
            region: s.region,
            project: projectId,
            config: {
              version: s.databaseVersion,
              state: s.state
            }
          });
          newInfraNodes.push({ id, label: s.name, type: 'resource', x: 100, y: 50 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Cloud SQL' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'Cloud SQL'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'Cloud SQL'
          }, 'admin');
        }
      }

      // 8. Fetch Cloud Build Deployments
      try {
        const [builds] = await cloudBuildClient.listBuilds({ projectId });
        console.log(`Fetched ${builds.length || 0} Cloud Build builds.`);
        const fetchedDeployments = builds.map(b => ({
          id: b.id || 'unknown',
          env: 'gcp-build',
          status: b.status === 'SUCCESS' ? 'success' : b.status === 'FAILURE' ? 'failed' : 'pending',
          timestamp: b.createTime ? new Date(Number(b.createTime.seconds) * 1000).toISOString() : new Date().toISOString(),
          version: b.substitutions?.['REVISION_ID'] || 'unknown',
          duration: b.finishTime ? `${Math.round((Number(b.finishTime.seconds) - Number(b.createTime!.seconds)) / 60)}m` : 'N/A',
          logs: [`Build Status: ${b.status}`, `Log URL: ${b.logUrl}`]
        }));
        
        // Save to Firestore
        for (const dep of fetchedDeployments) {
          try {
            await db.collection('deployments').doc(dep.id).set(dep, { merge: true });
          } catch (e) {
            console.error(`Error saving deployment ${dep.id} to Firestore:`, e);
          }
        }
      } catch (e: any) {
        const errMsg = getGcpErrorMessage(e);
        console.error(`[GCP] Error fetching Cloud Build builds: ${errMsg}`);
        
        const isPermissionError = errMsg.toLowerCase().includes('denied') || 
                                 errMsg.toLowerCase().includes('permission') || 
                                 errMsg.toLowerCase().includes('authorized') ||
                                 e.code === 403 || 
                                 e.response?.status === 403;
        const isApiDisabled = errMsg.toLowerCase().includes('disabled') || 
                             errMsg.toLowerCase().includes('not been used') ||
                             errMsg.toLowerCase().includes('not enabled');
                             
        const gcloudIamCmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${clientEmail || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/cloudbuild.builds.viewer"`;
        const gcloudEnableCmd = `gcloud services enable cloudbuild.googleapis.com --project ${projectId}`;
        
        broadcast({
          type: 'log',
          payload: `[ERROR] Failed to fetch Cloud Build builds in project ${projectId}: ${errMsg}. ${isPermissionError ? `PERMISSION_DENIED. Run: ${gcloudIamCmd}` : isApiDisabled ? `API_DISABLED. Run: ${gcloudEnableCmd}` : "Ensure 'cloudbuild.googleapis.com' is enabled."}`
        }, 'admin');

        // Mock fallback
        const mockBuilds = [
          { id: 'b123', status: 'SUCCESS', startTime: new Date().toISOString() }
        ];
        mockBuilds.forEach((b, i) => {
          const id = `build-${b.id}`;
          newNodes.push({ 
            id, 
            name: `Build ${b.id}`, 
            type: 'service', 
            status: 'healthy', 
            purpose: 'Continuous integration and delivery platform (Mock Fallback).',
            details: `Status: ${b.status}, Started: ${b.startTime}`,
            project: projectId
          });
          newInfraNodes.push({ id, label: `Build ${b.id}`, type: 'resource', x: 100, y: 400 + (i * 60) });
          newInfraEdges.push({ from: 'gcp', to: id, label: 'Cloud Build' });
        });

        if (isPermissionError) {
          broadcast({
            type: 'PERMISSION_DENIED',
            projectId,
            serviceAccount: clientEmail || 'YOUR_SERVICE_ACCOUNT',
            command: gcloudIamCmd,
            resource: 'Cloud Build'
          }, 'admin');
        } else if (isApiDisabled) {
          broadcast({
            type: 'API_DISABLED',
            projectId,
            command: gcloudEnableCmd,
            resource: 'Cloud Build'
          }, 'admin');
        }
      }

      // Intelligent Workflow Linking
      const gcpNode = newNodes.find(n => n.id === 'gcp');
      const cicdNode = newNodes.find(n => n.id === 'cicd-pipeline');
      const runServices = newNodes.filter(n => n.id.startsWith('run-'));
      const gkeClusters = newNodes.filter(n => n.id.startsWith('cluster-'));
      const sqlInstances = newNodes.filter(n => n.id.startsWith('sql-'));
      const buckets = newNodes.filter(n => n.id.startsWith('bucket-'));
      const topics = newNodes.filter(n => n.id.startsWith('pubsub-'));
      const repos = newNodes.filter(n => n.id.startsWith('artifact-'));

      if (gcpNode && cicdNode) {
        newLinks.push({ source: gcpNode.id, target: cicdNode.id, type: 'dependency', label: 'Hosts' });
      }

      repos.forEach(repo => {
        if (cicdNode) {
          newLinks.push({ source: cicdNode.id, target: repo.id, type: 'flow', label: 'Pushes Image' });
        }
      });

      runServices.forEach(svc => {
        repos.forEach(repo => {
          newLinks.push({ source: repo.id, target: svc.id, type: 'flow', label: 'Pulls Image' });
        });
        sqlInstances.forEach(sql => {
          newLinks.push({ source: svc.id, target: sql.id, type: 'integration', label: 'DB Connection' });
        });
        topics.forEach(topic => {
          newLinks.push({ source: topic.id, target: svc.id, type: 'trigger', label: 'Triggers' });
        });
      });

      gkeClusters.forEach(cluster => {
        repos.forEach(repo => {
          newLinks.push({ source: repo.id, target: cluster.id, type: 'flow', label: 'Pulls Image' });
        });
        sqlInstances.forEach(sql => {
          newLinks.push({ source: cluster.id, target: sql.id, type: 'integration', label: 'DB Connection' });
        });
      });

      // Default fallback for unlinked nodes
      newNodes.forEach(node => {
        if (node.id !== 'gcp' && !newLinks.some(l => l.target === node.id)) {
          newLinks.push({ source: 'gcp', target: node.id, type: 'dependency' });
        }
      });

      // Persist to Firestore
      architectureData = { nodes: newNodes, links: newLinks };
      infraMap = { nodes: newInfraNodes, edges: newInfraEdges };

      await db.collection('system_state').doc('global').set({
        architectureData,
        infraMap,
        projectId,
        serviceAccount: clientEmail
      }, { merge: true });

      broadcast({ type: 'ARCHITECTURE_UPDATED', architecture: architectureData });
      broadcast({ type: 'INFRA_MAP_UPDATED', infraMap });

    } catch (err) {
      console.error("Error fetching GCP resources:", err);
    }
  };

  // API Endpoints
  app.post("/api/system/refresh-gcp", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    console.log("Manual GCP resource refresh triggered...");
    broadcast({ type: 'log', payload: '[SYSTEM] Manual GCP refresh triggered. Clearing old logs...' }, 'admin');
    broadcast({ type: 'CLEAR_LOGS' }, 'admin');
    try {
      await refreshGcpData();
      res.json({ success: true, message: "GCP resource refresh triggered successfully." });
    } catch (err) {
      console.error("Refresh error:", err);
      res.status(500).json({ error: "Failed to refresh GCP resources." });
    }
  });

  app.post("/api/system/simulate-failure", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    try {
      const deploymentId = `DEP-${Math.floor(1000 + Math.random() * 9000)}`;
      const newDeployment: Deployment = {
        id: deploymentId,
        env: 'production',
        status: 'failed',
        timestamp: new Date().toISOString(),
        version: 'v1.0.9-buggy',
        duration: '2m',
        logs: [
          'Starting deployment...',
          'Pulling image: gcr.io/project/app:v1.0.9-buggy',
          'Deploying to Cloud Run...',
          'Error: Readiness probe failed. Service returned 500 Internal Server Error.',
          'Deployment failed.'
        ]
      };
      await db.collection('deployments').doc(deploymentId).set(newDeployment);
      broadcast({ type: "DEPLOYMENT_CREATED", deployment: newDeployment });
      res.json({ success: true, deploymentId });
    } catch (err) {
      res.status(500).json({ error: "Failed to simulate failure" });
    }
  });

  app.get("/api/init", async (req, res) => {
    const userRole = req.headers['x-user-role'] as string || 'DEVOPS_ENGINEER';
    
    const [
      deployments,
      notifications,
      approvals,
      suggestions,
      releases,
      repositories
    ] = await Promise.all([
      getFirestoreData('deployments'),
      getFirestoreData('notifications'),
      getFirestoreData('approvals'),
      getFirestoreData('system_suggestions'),
      getFirestoreData('releases'),
      getFirestoreData('repositories')
    ]);

    let adminData = {};
    if (userRole === 'SYSTEM_ADMIN' || userRole === 'APPROVER') {
      const [team, auditLogs, feedbacks, governance, costIntel] = await Promise.all([
        getFirestoreData('users'),
        getFirestoreData('audit_logs'),
        getFirestoreData('feedbacks'),
        getFirestoreData('governance_policies'),
        getFirestoreData('cost_recommendations')
      ]);
      
      let tickets = [];
      if (userRole === 'SYSTEM_ADMIN') {
        tickets = await getFirestoreData('tickets');
      }

      adminData = { team, auditLogs, feedbacks, tickets, governance, costIntel };
    }

    res.json({
      deployments,
      notifications,
      approvals,
      suggestions,
      releases,
      repositories,
      infraMap,
      architectureData,
      ...adminData
    });
  });

  app.get("/api/deployments", async (req, res) => {
    const data = await getFirestoreData('deployments');
    res.json(data);
  });

  app.get("/api/system-suggestions", async (req, res) => {
    const data = await getFirestoreData('system_suggestions');
    res.json(data);
  });

  app.get("/api/repositories", checkRole(['SYSTEM_ADMIN', 'DEVOPS_ENGINEER']), async (req, res) => {
    const data = await getFirestoreData('repositories');
    res.json(data);
  });

  app.get("/api/architecture", (req, res) => {
    const userRole = req.headers['x-user-role'] || 'DEVOPS_ENGINEER';
    if (userRole === 'SYSTEM_ADMIN' || userRole === 'CLOUD_ENGINEER') {
      res.json(architectureData);
    } else {
      // Mask sensitive metadata for other roles
      const maskedData = {
        ...architectureData,
        nodes: architectureData.nodes.map(n => ({
          ...n,
          details: n.details ? '[HIDDEN_METADATA]' : null
        }))
      };
      res.json(maskedData);
    }
  });

  app.get("/api/system-intelligence", async (req, res) => {
    const data = await getFirestoreData('system_suggestions');
    res.json(data);
  });

  app.get("/api/notifications", checkRole(['SYSTEM_ADMIN', 'CLOUD_ENGINEER', 'DEVOPS_ENGINEER', 'APPROVER']), async (req, res) => {
    const data = await getFirestoreData('notifications');
    res.json(data);
  });

  app.post("/api/notifications/read", checkRole(['SYSTEM_ADMIN', 'CLOUD_ENGINEER', 'DEVOPS_ENGINEER', 'APPROVER']), async (req, res) => {
    const { id } = req.body;
    try {
      await db.collection('notifications').doc(id).update({ read: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update notification." });
    }
  });

  app.get("/api/approvals", checkRole(['APPROVER', 'SYSTEM_ADMIN']), async (req, res) => {
    const data = await getFirestoreData('approvals');
    res.json(data);
  });

  app.get("/api/audit-logs", checkRole(['SYSTEM_ADMIN', 'APPROVER']), async (req, res) => {
    const data = await getFirestoreData('audit_logs');
    res.json(data);
  });

  app.get("/api/infra-map", (req, res) => {
    res.json(infraMap);
  });

  app.get("/api/feedbacks", checkRole(['SYSTEM_ADMIN', 'APPROVER']), async (req, res) => {
    const feedbacks = await getFirestoreData<Feedback>('feedbacks', []);
    res.json(feedbacks);
  });

  // WebSocket logic
  wss?.on('connection', (ws: any) => {
    console.log('Client connected to ADDB WebSocket');
    
    // Send initial state on connection
    ws.send(JSON.stringify({ 
      type: 'SYNC_STATE', 
      state: systemState 
    }));

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'IDENTIFY') {
          ws.userRole = data.role;
          console.log(`Client identified as: ${ws.userRole}`);
          // Re-send state with correct masking
          ws.send(JSON.stringify({ 
            type: 'SYNC_STATE', 
            state: ws.userRole === 'SYSTEM_ADMIN' ? systemState : {
              ...systemState,
              activeTerminalLogs: scrubLogs(systemState.activeTerminalLogs)
            }
          }));
        }
        if (data.type === 'UPDATE_STATE') {
          systemState = { ...systemState, ...data.state };
          // Persist state update to Firestore
          await db.collection('system_state').doc('global').set(systemState, { merge: true });
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    });
  });

  app.post("/api/approvals/approve", checkRole(['SYSTEM_ADMIN', 'APPROVER']), async (req, res) => {
    const { id, userId, userRole } = req.body;
    try {
      const approvalRef = db.collection('approvals').doc(id);
      const approvalDoc = await approvalRef.get();
      if (approvalDoc.exists) {
        const approval = approvalDoc.data() as any;
        await approvalRef.update({ status: 'APPROVED' });
        
        // Find and mark the notification as read
        const notificationsSnapshot = await db.collection('notifications')
          .where('type', '==', 'APPROVAL_REQUEST')
          .where('read', '==', false)
          .get();
        
        for (const doc of notificationsSnapshot.docs) {
          const notif = doc.data();
          if (notif.message.includes(approval.deploymentId)) {
            await doc.ref.update({ read: true });
          }
        }

        const deploymentRef = db.collection('deployments').doc(approval.deploymentId);
        const deploymentDoc = await deploymentRef.get();
        if (deploymentDoc.exists) {
          const deployment = deploymentDoc.data() as Deployment;
          const updatedLogs = [
            ...deployment.logs,
            "[INFO] APPROVAL RECEIVED. RESUMING DEPLOYMENT...",
            "[SUCCESS] Deployment completed after approval."
          ];
          await deploymentRef.update({ status: 'success', logs: updatedLogs });
          
          // Create Audit Log
          const auditLog = {
            id: `AUD-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            timestamp: new Date().toISOString(),
            action: "DEPLOYMENT_APPROVED",
            userId: userId || "USR-004",
            userRole: userRole || "APPROVER",
            details: `Approved deployment ${approval.deploymentId}`
          };
          await db.collection('audit_logs').doc(auditLog.id).set(auditLog);

          broadcast({ type: "DEPLOYMENT_UPDATED", deployment: { ...deployment, status: 'success', logs: updatedLogs } });
          broadcast({ type: "TERMINAL_RESUME", deploymentId: approval.deploymentId });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Approval request not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to approve deployment." });
    }
  });

  app.get("/api/team", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const data = await getFirestoreData('users');
    res.json(data);
  });

  // Lifecycle Controls - Double-Factor Validation
  app.post("/api/system/lifecycle", checkRole(['SYSTEM_ADMIN']), checkSecretKey, async (req, res) => {
    const { action } = req.body;
    console.log(`System Lifecycle Action: ${action}`);

    if (action === 'SELF-UPDATE') {
      systemStatus = 'UPDATING';
      systemState.systemStatus = 'UPDATING';
      await db.collection('system_state').doc('global').update({ systemStatus: 'UPDATING' });
      broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'UPDATING' });

      // Simulate update process
      setTimeout(async () => {
        const versionParts = systemVersion.replace('v', '').split('.').map(Number);
        versionParts[2]++; // Increment patch
        systemVersion = `v${versionParts.join('.')}`;
        systemState.systemVersion = systemVersion;
        systemStatus = 'RUNNING';
        systemState.systemStatus = 'RUNNING';

        const newRelease: Release = {
          id: `REL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          version: systemVersion,
          timestamp: new Date().toISOString(),
          summary: "Automated System Self-Update: git pull, npm install, build successful.",
          type: "SYSTEM_UPDATE"
        };
        await db.collection('releases').doc(newRelease.id).set(newRelease);
        await db.collection('system_state').doc('global').update({ 
          systemStatus: 'RUNNING', 
          systemVersion: systemVersion 
        });

        broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'RUNNING' });
        broadcast({ type: 'SYSTEM_VERSION_UPDATED', version: systemVersion });
        broadcast({ type: 'RELEASE_CREATED', release: newRelease });
      }, 5000);

      return res.json({ success: true, message: "Self-update initiated." });
    }

    if (action === 'RESTART') {
      systemStatus = 'UPDATING';
      await db.collection('system_state').doc('global').update({ systemStatus: 'UPDATING' });
      broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'UPDATING' });
      setTimeout(async () => {
        systemStatus = 'RUNNING';
        await db.collection('system_state').doc('global').update({ systemStatus: 'RUNNING' });
        broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'RUNNING' });
      }, 2000);
      return res.json({ success: true, message: "Restart initiated." });
    }

    if (action === 'SHUTDOWN') {
      systemStatus = 'STOPPED';
      await db.collection('system_state').doc('global').update({ systemStatus: 'STOPPED' });
      broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'STOPPED' });
      return res.json({ success: true, message: "Shutdown initiated." });
    }

    if (action === 'START') {
      systemStatus = 'RUNNING';
      await db.collection('system_state').doc('global').update({ systemStatus: 'RUNNING' });
      broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'RUNNING' });
      return res.json({ success: true, message: "System started." });
    }

    res.status(400).json({ error: "Invalid action" });
  });

  app.post("/api/system/restore", checkRole(['SYSTEM_ADMIN']), checkSecretKey, async (req, res) => {
    const { version } = req.body;
    console.log(`System Restoration to version: ${version}`);

    // Simulate restoration process with progress
    systemStatus = 'UPDATING';
    broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'UPDATING' });

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 20;
      broadcast({ type: 'SYSTEM_UPDATE_PROGRESS', progress });

      if (progress >= 100) {
        clearInterval(interval);
        systemVersion = version;
        systemStatus = 'RUNNING';
        systemState.systemVersion = version;
        systemState.systemStatus = 'RUNNING';

        await db.collection('system_state').doc('global').update({ 
          systemStatus: 'RUNNING', 
          systemVersion: version 
        });

        broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'RUNNING' });
        broadcast({ type: 'SYSTEM_VERSION_UPDATED', version: version });
        
        // Add a restoration log
        const auditLog: AuditLog = {
          id: `AUDIT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'SYSTEM_RESTORE',
          userId: 'SYSTEM_ADMIN',
          userRole: 'SYSTEM_ADMIN',
          details: `System restored to version ${version} by manual override.`
        };
        await db.collection('audit_logs').doc(auditLog.id).set(auditLog);
        broadcast({ type: 'AUDIT_LOG_CREATED', log: auditLog });
      }
    }, 1000);

    res.json({ success: true, message: `Restoration to ${version} initiated.` });
  });

  app.get("/api/governance", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const data = await getFirestoreData('governance_policies');
    res.json(data);
  });

  app.get("/api/cost-intel", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const data = await getFirestoreData('cost_recommendations');
    res.json(data);
  });

  // Ticketing System
  app.get("/api/tickets", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const tickets = await getFirestoreData<Ticket>('tickets', []);
    res.json(tickets);
  });

  app.post("/api/tickets", async (req, res) => {
    const { message, userId } = req.body;
    const year = new Date().getFullYear();
    const newTicket: Ticket = {
      id: `REQ-${year}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      userId: userId || "USR-UNKNOWN",
      userMessage: message,
      timestamp: new Date().toISOString(),
      status: 'OPEN'
    };
    try {
      await db.collection('tickets').doc(newTicket.id).set(newTicket);
      res.json(newTicket);
    } catch (err) {
      res.status(500).json({ error: "Failed to create ticket." });
    }
  });

  app.post("/api/tickets/:id/propose", checkRole(['SYSTEM_ADMIN']), checkSecretKey, async (req, res) => {
    const { id } = req.params;
    const { proposal } = req.body;
    try {
      const ticketRef = db.collection('tickets').doc(id);
      const doc = await ticketRef.get();
      if (doc.exists) {
        const ticket = doc.data() as Ticket;
        const finalProposal = proposal || `// AI PROPOSED EVOLUTION FOR ${id}\n// Feature: ${ticket.userMessage}\n\nexport const evolveSystem = () => {\n  console.log("Implementing ${ticket.userMessage}...");\n  // Logic to fulfill request goes here\n};`;
        await ticketRef.update({ status: 'IN_PROGRESS', evolutionProposal: finalProposal });
        res.json({ ...ticket, status: 'IN_PROGRESS', evolutionProposal: finalProposal });
      } else {
        res.status(404).json({ error: "Ticket not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to propose evolution." });
    }
  });

  app.post("/api/tickets/:id/resolve", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
      const ticketRef = db.collection('tickets').doc(id);
      const doc = await ticketRef.get();
      if (doc.exists) {
        const ticket = doc.data() as Ticket;
        await ticketRef.update({ status: 'RESOLVED' });
        broadcast({ 
          type: 'USER_NOTIFICATION', 
          userId: ticket.userId, 
          message: `Your request ${ticket.id} is now live in ${systemVersion}!` 
        });
        res.json({ ...ticket, status: 'RESOLVED' });
      } else {
        res.status(404).json({ error: "Ticket not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to resolve ticket." });
    }
  });

  // Releases
  app.get("/api/releases", async (req, res) => {
    const data = await getFirestoreData('releases');
    res.json(data);
  });

  app.post("/api/feedback", async (req, res) => {
    const { deploymentId, feedback, userId } = req.body;
    const newFeedback: Feedback = {
      id: `FDB-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      deploymentId,
      feedback,
      userId: userId || "USR-UNKNOWN",
      timestamp: new Date().toISOString()
    };
    try {
      await db.collection('feedbacks').doc(newFeedback.id).set(newFeedback);
      
      // Create notification for Admin
      const notification: Notification = {
        id: `NOT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        type: 'SYSTEM_ALERT',
        title: 'USER_FEEDBACK_RECEIVED',
        message: `Correction Proposal for ${deploymentId}: ${feedback}`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: 'MINOR'
      };
      await db.collection('notifications').doc(notification.id).set(notification);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to submit feedback." });
    }
  });

  app.post("/api/feedback/:id/fix", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const { id } = req.params;
    try {
      const feedbackRef = db.collection('feedbacks').doc(id);
      const feedbackDoc = await feedbackRef.get();
      if (feedbackDoc.exists) {
        const feedback = feedbackDoc.data() as Feedback;
        const deploymentRef = db.collection('deployments').doc(feedback.deploymentId);
        const deploymentDoc = await deploymentRef.get();
        if (deploymentDoc.exists) {
          const deployment = deploymentDoc.data() as Deployment;
          const updatedLogs = [
            ...deployment.logs,
            `[INFO] AI_FIX_INITIATED: Responding to feedback "${feedback.feedback}"`,
            "[INFO] Analyzing code diff and applying corrections..."
          ];
          await deploymentRef.update({ status: 'in-progress', logs: updatedLogs });
          
          setTimeout(async () => {
            const newVersion = `v${(parseFloat(deployment.version.replace('v', '')) + 0.01).toFixed(2)}`;
            const finalLogs = [...updatedLogs, "[SUCCESS] AI fix applied and redeployed successfully."];
            await deploymentRef.update({ status: 'success', version: newVersion, logs: finalLogs });
            broadcast({ type: "DEPLOYMENT_UPDATED", deployment: { ...deployment, status: 'success', version: newVersion, logs: finalLogs } });
          }, 3000);

          await feedbackRef.delete();
          res.json({ success: true });
        } else {
          res.status(404).json({ error: "Deployment not found" });
        }
      } else {
        res.status(404).json({ error: "Feedback not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to apply fix." });
    }
  });

  app.post("/api/team/invite", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const { email, role, scope } = req.body;
    const newUser = {
      id: `USR-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      name: email.split('@')[0],
      email,
      role,
      scope,
      timestamp: new Date().toISOString()
    };
    try {
      await db.collection('users').doc(newUser.id).set(newUser);
      const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/invite/${newUser.id}?token=SECURE_${Math.random().toString(36).substring(7)}`;
      res.json({ success: true, inviteUrl });
    } catch (err) {
      res.status(500).json({ error: "Failed to invite user." });
    }
  });

  app.post("/api/system-intelligence/modify-code", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const change: CodeChange = req.body;
    
    if (!change.filePath || !change.targetContent || !change.replacementContent) {
      return res.status(400).json({ error: "Invalid code change payload." });
    }

    try {
      const result = await applyCodeChange(change);
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error during self-modification." });
    }
  });

  app.post("/api/system-intelligence/apply", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    const { id } = req.body;
    try {
      const suggestionRef = db.collection('system_suggestions').doc(id);
      const doc = await suggestionRef.get();
      if (doc.exists) {
        const suggestion = doc.data() as any;
        console.log(`Applying system evolution: ${suggestion.title}`);
        
        // Simulate a deployment for this change
        const deploymentId = `dep-${Date.now()}`;
        const deployment = {
          id: deploymentId,
          title: `Evolution: ${suggestion.title}`,
          status: 'in-progress',
          timestamp: new Date().toISOString(),
          logs: [`Initiating evolution: ${suggestion.title}`, `Analyzing dependencies...`, `Applying configuration changes...`],
          environment: 'production',
          service: 'infrastructure-core',
          version: 'v1.1.0-evo',
          author: 'ADDB_AUTONOMOUS'
        };
        
        await db.collection('deployments').doc(deploymentId).set(deployment);
        
        // Start progress simulation
        let progress = 0;
        broadcast({ type: 'SYSTEM_STATUS_UPDATED', status: 'UPDATING' });
        
        const interval = setInterval(() => {
          progress += Math.floor(Math.random() * 15) + 5;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // Finalize deployment
            db.collection('deployments').doc(deploymentId).update({
              status: 'success',
              logs: [...deployment.logs, `Configuration applied successfully.`, `Verifying health checks...`, `Evolution complete.`]
            }).catch(err => console.error("Failed to update deployment:", err));
            
            // Add a notification
            const notification = {
              id: `EVO-${Date.now()}`,
              title: 'Evolution Applied',
              message: `System evolution "${suggestion.title}" has been successfully applied.`,
              type: 'success',
              timestamp: new Date().toISOString(),
              read: false
            };
            db.collection('notifications').doc(notification.id).set(notification).catch(err => console.error("Failed to add notification:", err));
            broadcast({ type: 'USER_NOTIFICATION', notification });

            broadcast({ type: "SYSTEM_UPDATE_PROGRESS", progress: null });
            broadcast({ type: "SYSTEM_STATUS_UPDATED", status: 'RUNNING' });
            broadcast({ type: "SYSTEM_VERSION_UPDATED", version: 'v1.1.0-evo' });
          } else {
            broadcast({ type: "SYSTEM_UPDATE_PROGRESS", progress });
          }
        }, 1000);

        await suggestionRef.delete();
        res.json({ success: true, message: `Applied: ${suggestion.title}. Deployment ${deploymentId} initiated.` });
      } else {
        res.status(404).json({ error: "Suggestion not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to apply suggestion." });
    }
  });

  app.post("/api/system/scan-leaks", checkRole(['SYSTEM_ADMIN']), async (req, res) => {
    console.log("Running Security Leak Detection Scan...");
    
    try {
      // Real scan using grep for common patterns
      const patterns = ['AI_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE_KEY'];
      const findings: { file: string, pattern: string, risk: string }[] = [];

      for (const pattern of patterns) {
        try {
          const { stdout } = await execAsync(`grep -rli "${pattern}" . --exclude-dir={node_modules,dist,.git} --exclude=server.ts --exclude=types.ts`);
          if (stdout) {
            const files = stdout.split('\n').filter(f => f.trim());
            files.forEach(file => {
              findings.push({ file, pattern, risk: pattern.includes('KEY') || pattern.includes('SECRET') ? 'HIGH' : 'MEDIUM' });
            });
          }
        } catch (e) {
          // grep returns exit code 1 if no matches found, which promisify(exec) treats as an error
        }
      }

      const notification: Notification = {
        id: `LEAK-${Date.now()}`,
        type: 'SYSTEM_ALERT',
        title: 'SECURITY_LEAK_DETECTED',
        message: findings.length > 0 
          ? `Potential sensitive data patterns found in ${findings.length} files. Review .env and config files immediately.`
          : "Security scan completed. No obvious leaks detected.",
        timestamp: new Date().toISOString(),
        read: false,
        severity: findings.length > 0 ? 'CRITICAL' : 'MINOR'
      };

      await db.collection('notifications').doc(notification.id).set(notification);
      broadcast({ type: 'USER_NOTIFICATION', notification });
      res.json({ success: true, findings });
    } catch (err) {
      console.error("Scan error:", err);
      res.status(500).json({ error: "Failed to run security scan." });
    }
  });

  app.patch("/api/deployments/:id", async (req, res) => {
    const { id } = req.params;
    const { issueIdentified, fixApplied } = req.body;
    try {
      const deploymentRef = db.collection('deployments').doc(id);
      const doc = await deploymentRef.get();
      if (doc.exists) {
        const deployment = doc.data() as Deployment;
        const updatedDeployment = {
          ...deployment,
          issueIdentified: issueIdentified || deployment.issueIdentified,
          fixApplied: fixApplied || deployment.fixApplied
        };
        await deploymentRef.update(updatedDeployment);
        broadcast({ type: "DEPLOYMENT_UPDATED", deployment: updatedDeployment });
        res.json(updatedDeployment);
      } else {
        res.status(404).json({ error: "Deployment not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to update deployment." });
    }
  });

  app.post("/api/git/push", checkRole(['SYSTEM_ADMIN']), checkSecretKey, async (req, res) => {
    const { repoUrl, pat, userName, userEmail } = req.body;
    if (!repoUrl || !pat) {
      return res.status(400).json({ error: "Repository URL and PAT are required." });
    }

    try {
      // Configure Git Identity and Safe Directory
      const name = userName || "ADDB Sovereign Bot";
      const email = userEmail || "addb@example.com";
      
      // Add current directory to safe.directory to avoid permission issues in containers
      try {
        await execAsync("git config --global --add safe.directory '*' ");
      } catch (e) {
        console.log("Safe directory config failed, might already be set:", e);
      }

      await execAsync(`git config --global user.email "${email}"`);
      await execAsync(`git config --global user.name "${name}"`);

      // Initialize git if not already initialized
      await execAsync("git init");
      
      // Use a more robust add command and capture stderr for debugging
      try {
        await execAsync("git add .");
      } catch (addError: any) {
        console.error("Git add error detail:", addError.stderr || addError.message);
        throw new Error(`Git add failed: ${addError.stderr || addError.message}`);
      }
      
      // Check if there are changes to commit
      const { stdout: status } = await execAsync("git status --porcelain");
      if (status.trim()) {
        try {
          await execAsync(`git commit -m 'feat: official enterprise release ${new Date().toISOString()}'`);
        } catch (e: any) {
          console.log("Commit failed, possibly no changes or other issue:", e.stderr || e.message);
        }
      }

      // Ensure we are on 'main' branch (renames current branch to main)
      await execAsync("git branch -M main");

      // Construct the remote URL with PAT for authentication
      // Format: https://<pat>@github.com/user/repo.git
      const authenticatedUrl = repoUrl.replace("https://", `https://${pat}@`);
      
      // Try to add remote, if it fails (already exists), update it
      try {
        await execAsync(`git remote add origin ${authenticatedUrl}`);
      } catch (e) {
        await execAsync(`git remote set-url origin ${authenticatedUrl}`);
      }

      // Push with force and capture stderr
      try {
        await execAsync("git push -u origin main --force");
      } catch (pushError: any) {
        console.error("Git push error detail:", pushError.stderr || pushError.message);
        throw new Error(`Git push failed: ${pushError.stderr || pushError.message}`);
      }

      res.json({ status: "success", message: "Repository pushed successfully to " + repoUrl });
    } catch (error: any) {
      console.error("Git operation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/deploy", async (req, res) => {
    const { env, version, severity: manualSeverity, command, costEstimate: manualCost } = req.body;
    
    // Severity Scoring Engine
    const costEstimate = manualCost || Math.floor(Math.random() * 200);
    const containsDestructive = command && (
      command.toLowerCase().includes('delete') || 
      command.toLowerCase().includes('drop') || 
      command.toLowerCase().includes('destroy')
    );
    
    let severity: 'MAJOR' | 'MINOR' = 'MINOR';
    if (env === 'production' || containsDestructive || costEstimate > 100 || manualSeverity === 'MAJOR') {
      severity = 'MAJOR';
    }

    const isMajor = severity === 'MAJOR';
    
    const newDeployment: Deployment = {
      id: `DEP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      env: env || "staging",
      status: isMajor ? "pending-approval" : "in-progress",
      timestamp: new Date().toISOString(),
      version: version || `v1.2.0`,
      duration: "0s",
      severity,
      costEstimate,
      diff: {
        before: "const config = {\n  replicas: 2,\n  memory: '512Mi'\n};",
        after: containsDestructive ? "// Resource deleted" : `const config = {\n  replicas: ${env === 'production' ? 5 : 3},\n  memory: '1Gi'\n};`
      },
      logs: [
        "[INFO] Deployment initialized by agent.",
        isMajor ? `[WARNING] MAJOR CHANGE DETECTED (${env === 'production' ? 'PROD ENV' : containsDestructive ? 'DESTRUCTIVE CMD' : 'HIGH COST'}). GENERATING PLAN.MD...` : "[INFO] Minor change detected. Proceeding..."
      ]
    };

    try {
      if (isMajor) {
        const planContent = `# DEPLOYMENT PLAN: ${newDeployment.id}\n\n## Changes\n- Update core service to ${newDeployment.version}\n- Database schema migration (v12 -> v13)\n- Cache invalidation across all regions\n\n## Risk Assessment\n- HIGH: Possible downtime during migration\n- MEDIUM: Cache miss spike expected\n\n## Rollback Plan\n- Revert to previous stable version\n- Restore DB snapshot if migration fails`;
        
        newDeployment.logs.push("[INFO] PLAN.MD GENERATED. WAITING FOR APPROVAL...");
        
        const approval = {
          id: `APP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          deploymentId: newDeployment.id,
          planContent,
          requestedBy: "ADDB_AGENT",
          timestamp: new Date().toISOString(),
          status: 'PENDING' as const
        };
        await db.collection('approvals').doc(approval.id).set(approval);
        
        const notification: Notification = {
          id: `NOT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          type: 'APPROVAL_REQUEST',
          title: 'MAJOR_CHANGE_PENDING',
          message: `Deployment ${newDeployment.id} requires approval for ${newDeployment.env}.`,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'MAJOR'
        };
        await db.collection('notifications').doc(notification.id).set(notification);
      }

      await db.collection('deployments').doc(newDeployment.id).set(newDeployment);
      
      // Notify clients of new deployment
      broadcast({ type: "DEPLOYMENT_CREATED", deployment: newDeployment });

      if (!isMajor) {
        // Simulate deployment completion for minor changes
        setTimeout(async () => {
          const isSuccess = Math.random() > 0.1;
          const status = isSuccess ? "success" : "failed";
          const duration = `${Math.floor(Math.random() * 5) + 2}m ${Math.floor(Math.random() * 60)}s`;
          const finalLogs = [
            ...newDeployment.logs,
            "[INFO] Pulling container image...",
            "[INFO] Running pre-flight checks...",
            isSuccess ? "[INFO] Starting application containers..." : "[ERROR] Health check failed.",
            isSuccess ? "[INFO] Health checks passed." : "[ERROR] Rolling back...",
            isSuccess ? `[SUCCESS] Deployment ${newDeployment.version} completed.` : "[FAILED] Deployment aborted."
          ];
          
          await db.collection('deployments').doc(newDeployment.id).update({ status, duration, logs: finalLogs });
          broadcast({ type: "DEPLOYMENT_UPDATED", deployment: { ...newDeployment, status, duration, logs: finalLogs } });
        }, 5000);
      }

      res.json(newDeployment);
    } catch (err) {
      res.status(500).json({ error: "Failed to initiate deployment." });
    }
  });

  // Vite middleware for development
  if (!isProduction) {
    console.log("[INIT] Initializing Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      configFile: path.join(rootPath, 'vite.config.ts'),
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url === '/debug') return next();
      
      try {
        const indexPath = path.join(rootPath, "frontend", "index.html");
        console.log(`[DEV] Serving index from: ${indexPath} for URL: ${url}`);
        if (!fs.existsSync(indexPath)) {
          console.error(`[DEV] Frontend index.html not found at: ${indexPath}`);
          return res.status(404).send("Frontend source not found");
        }
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error(`[DEV] Error serving index:`, e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(rootPath, "dist");
    const indexPath = path.join(distPath, "index.html");
    
    console.log(`[PRODUCTION] Serving static files from: ${distPath}`);
    console.log(`[PRODUCTION] Index path: ${indexPath}`);
    
    // Serve static files
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      const url = req.originalUrl;
      
      // Skip API and debug routes
      if (url.startsWith('/api') || url === '/debug') {
        return res.status(404).json({ error: "Not found" });
      }

      // If it's a request for an asset that wasn't found by express.static, return 404
      if (url.startsWith('/assets/')) {
        return res.status(404).send("Asset not found");
      }
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application build not found. Please run build first.");
      }
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled server error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack 
    });
  });

  try {
    server.listen(PORT, "0.0.0.0", async () => {
      console.log(`ADDB Server running on http://localhost:${PORT}`);
      console.log(`[SERVER] Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      if (clientEmail) {
        console.log(`[SECURITY] Application is running as service account: ${clientEmail}`);
        console.log(`[SECURITY] To grant access to project ${gcpProjectId}, run:`);
        console.log(`gcloud projects add-iam-policy-binding ${gcpProjectId} --member="serviceAccount:${clientEmail}" --role="roles/viewer"`);
        console.log(`gcloud projects add-iam-policy-binding ${gcpProjectId} --member="serviceAccount:${clientEmail}" --role="roles/storage.admin"`);
        console.log(`gcloud projects add-iam-policy-binding ${gcpProjectId} --member="serviceAccount:${clientEmail}" --role="roles/datastore.user"`);
        
        broadcast({
          type: 'log',
          payload: `[SECURITY] Application service account: ${clientEmail}. Please ensure it has 'Viewer', 'Storage Admin', and 'Cloud Datastore User' roles in project ${gcpProjectId}.`
        }, 'admin');
      }

      // Test Firestore Connection
      try {
        console.log(`Testing Firestore connection to database: ${firebaseConfig.firestoreDatabaseId}...`);
        await db.collection('system_state').doc('global').get();
        console.log("Firestore connection successful.");
      } catch (err) {
        console.error("CRITICAL: Firestore connection failed on startup!", err);
      }

      // Initial data fetch
      refreshGcpData();
      
      // Periodic refresh every 5 minutes
      setInterval(refreshGcpData, 5 * 60 * 1000);
    });
  } catch (e) {
    console.error("CRITICAL: Server failed to listen!", e);
  }
}

startServer();
