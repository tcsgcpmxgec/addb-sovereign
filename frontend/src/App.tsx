import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  Terminal, 
  Activity, 
  History, 
  Send, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Server,
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  FileText,
  X,
  Shield,
  HelpCircle,
  Bell, 
  Users, 
  ShieldAlert, 
  FileCheck, 
  AlertTriangle, 
  AlertCircle,
  UserPlus, 
  Lock,
  Search,
  Settings,
  LogOut,
  Plus,
  MessageSquare,
  Zap,
  Globe,
  Database,
  Layers,
  Share2,
  Download,
  Filter,
  RefreshCw,
  MoreVertical,
  Trash2,
  Edit2,
  ExternalLink,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Minimize2,
  Rocket,
  Menu,
  Info,
  Wrench,
  Eye,
  GitBranch,
  UploadCloud,
  Tag,
  Scale,
  DollarSign,
  Gavel,
  ArrowRight,
  Network,
  Bot,
  Box
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import ForceGraph2D from 'react-force-graph-2d';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  serverTimestamp, 
  doc, 
  updateDoc,
  getDoc,
  setDoc,
  limit,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { db, auth } from './firebase';
import { cn } from './lib/utils';
import { BotBehavior, Deployment, ChatMessage, DeploymentStats, User, UserRole, Notification, ApprovalRequest, AuditLog, ArchitectureData, ArchitectureNode, ArchitectureLink, ChatSession, SystemStatus, Ticket, Release, Repository, CloudProvider, SystemSuggestion, GovernancePolicy, CostRecommendation } from './types';
import { chatWithADDB, analyzeFailure, generateSuggestions, proposeEvolutionAI } from './services/geminiService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          message = `Database Error (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
          <div className="bg-[#0D0D0E] border border-red-500/50 rounded-lg p-8 max-w-md w-full text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">SYSTEM_ERROR</h2>
            <p className="text-[#626269] text-sm mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white py-2 rounded font-bold text-xs tracking-widest hover:bg-red-600 transition-colors"
            >
              RESTART_SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  { id: 'gcp', name: 'Google Cloud', icon: '☁️' },
  { id: 'aws', name: 'AWS', icon: '📦' },
  { id: 'azure', name: 'Azure', icon: '🔷' },
];

function NavItem({ active, onClick, icon, label, restricted }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, restricted?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold tracking-widest transition-all border-l-2",
        active 
          ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]" 
          : "text-[#626269] border-transparent hover:text-[#E1E1E6] hover:bg-[#1C1C1F]/50"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {restricted && <Lock className="w-3 h-3 text-[#323236]" />}
    </button>
  );
}

function ArchitectureGraph({ data, onExport }: { data: ArchitectureData, onExport: () => void }) {
  const fgRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(null);

  return (
    <div className="relative w-full h-[700px] bg-[#050505] rounded-lg border border-[#1C1C1F] overflow-hidden flex">
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10 flex items-center justify-between w-[calc(100%-2rem)]">
          <div className="text-[10px] font-bold text-[#626269] tracking-widest uppercase flex items-center gap-2">
            <Activity className="w-3 h-3 text-[#F27D26]" />
            Architecture Blueprint (Live)
          </div>
          <button 
            onClick={onExport}
            className="px-3 py-1 bg-[#1C1C1F] border border-[#323236] text-[9px] font-bold text-[#E1E1E6] rounded hover:bg-[#323236] transition-all flex items-center gap-2"
          >
            <FileText className="w-3 h-3" />
            EXPORT_SVG
          </button>
        </div>
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          onNodeClick={(node: any) => setSelectedNode(node)}
          nodeLabel={(node: any) => {
            return `<div class="p-2 bg-[#0D0D0E] border border-[#323236] rounded text-[10px] space-y-1">
              <div class="font-bold text-[#F27D26] uppercase">${node.type}: ${node.name}</div>
              ${node.purpose ? `<div class="text-[#E1E1E6] italic">"${node.purpose}"</div>` : ''}
              <div class="text-[8px] text-[#626269]">Click for full configuration details</div>
            </div>`;
          }}
          nodeColor={(node: any) => {
            if (node.status === 'error') return '#FF4444';
            if (node.status === 'warning') return '#F27D26';
            return '#00FF00';
          }}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.name;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

            // Draw shadow/glow
            ctx.shadowColor = node.status === 'error' ? 'rgba(255, 68, 68, 0.5)' : node.status === 'warning' ? 'rgba(242, 125, 38, 0.5)' : 'rgba(0, 255, 0, 0.2)';
            ctx.shadowBlur = 10 / globalScale;

            // Draw Node Shape based on type
            ctx.beginPath();
            if (node.type === 'cluster') {
              ctx.rect(node.x - 10/globalScale, node.y - 10/globalScale, 20/globalScale, 20/globalScale);
            } else if (node.type === 'bucket') {
              ctx.arc(node.x, node.y, 10/globalScale, 0, 2 * Math.PI);
            } else if (node.type === 'service') {
              ctx.moveTo(node.x, node.y - 12/globalScale);
              ctx.lineTo(node.x + 12/globalScale, node.y);
              ctx.lineTo(node.x, node.y + 12/globalScale);
              ctx.lineTo(node.x - 12/globalScale, node.y);
              ctx.closePath();
            } else if (node.type === 'vm') {
              ctx.roundRect?.(node.x - 12/globalScale, node.y - 8/globalScale, 24/globalScale, 16/globalScale, 4/globalScale);
            } else if (node.type === 'database') {
              ctx.ellipse(node.x, node.y - 5/globalScale, 10/globalScale, 5/globalScale, 0, 0, 2 * Math.PI);
              ctx.rect(node.x - 10/globalScale, node.y - 5/globalScale, 20/globalScale, 10/globalScale);
              ctx.ellipse(node.x, node.y + 5/globalScale, 10/globalScale, 5/globalScale, 0, 0, 2 * Math.PI);
            } else if (node.type === 'topic') {
              const sides = 6;
              const size = 10/globalScale;
              ctx.moveTo(node.x + size * Math.cos(0), node.y + size * Math.sin(0));
              for (let i = 1; i <= sides; i++) {
                ctx.lineTo(node.x + size * Math.cos(i * 2 * Math.PI / sides), node.y + size * Math.sin(i * 2 * Math.PI / sides));
              }
            } else if (node.type === 'repo') {
              ctx.rect(node.x - 10/globalScale, node.y - 8/globalScale, 20/globalScale, 16/globalScale);
              ctx.rect(node.x - 10/globalScale, node.y - 12/globalScale, 8/globalScale, 4/globalScale);
            } else if (node.type === 'external-users') {
              // User icon shape
              ctx.arc(node.x, node.y - 5/globalScale, 5/globalScale, 0, 2 * Math.PI);
              ctx.moveTo(node.x - 8/globalScale, node.y + 8/globalScale);
              ctx.arc(node.x, node.y + 15/globalScale, 10/globalScale, Math.PI, 2 * Math.PI);
            } else if (node.type === 'global-lb') {
              // Load balancer diamond
              ctx.moveTo(node.x, node.y - 15/globalScale);
              ctx.lineTo(node.x + 15/globalScale, node.y);
              ctx.lineTo(node.x, node.y + 15/globalScale);
              ctx.lineTo(node.x - 15/globalScale, node.y);
              ctx.closePath();
              // Inner lines
              ctx.moveTo(node.x - 5/globalScale, node.y);
              ctx.lineTo(node.x + 5/globalScale, node.y);
            } else if (node.type === 'agent') {
              // Hexagon for agent
              const sides = 6;
              const size = 15/globalScale;
              ctx.moveTo(node.x + size * Math.cos(0), node.y + size * Math.sin(0));
              for (let i = 1; i <= sides; i++) {
                ctx.lineTo(node.x + size * Math.cos(i * 2 * Math.PI / sides), node.y + size * Math.sin(i * 2 * Math.PI / sides));
              }
            } else {
              ctx.arc(node.x, node.y, 8/globalScale, 0, 2 * Math.PI);
            }
            
            ctx.fillStyle = 'rgba(13, 13, 14, 0.9)';
            ctx.fill();
            ctx.strokeStyle = node.status === 'error' ? '#FF4444' : node.status === 'warning' ? '#F27D26' : node.type === 'agent' ? '#F27D26' : '#00FF00';
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();

            ctx.shadowBlur = 0; // Reset shadow

            // Draw Label
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#E1E1E6';
            ctx.font = `bold ${10/globalScale}px Sans-Serif`;
            ctx.fillText(label.toUpperCase(), node.x, node.y + 25/globalScale);

            if (node.status === 'error' || node.type === 'agent') {
              ctx.beginPath();
              ctx.arc(node.x, node.y, (20 + Math.sin(Date.now() / 100) * 5) / globalScale, 0, 2 * Math.PI);
              ctx.strokeStyle = node.type === 'agent' ? 'rgba(242, 125, 38, 0.2)' : 'rgba(255, 68, 68, 0.3)';
              ctx.stroke();
            }
          }}
          linkColor={(link: any) => {
            if (link.type === 'flow') return '#F27D26';
            if (link.type === 'trigger') return '#00FF00';
            if (link.type === 'integration') return '#3B82F6';
            return '#1C1C1F';
          }}
          linkLabel={(link: any) => {
            return `<div class="px-2 py-1 bg-[#0D0D0E] border border-[#323236] rounded text-[8px] text-[#626269] font-bold uppercase">
              ${link.label || link.type}
            </div>`;
          }}
          linkDirectionalParticles={(link: any) => (link.type === 'flow' || link.type === 'trigger') ? 4 : 0}
          linkDirectionalParticleSpeed={(link: any) => link.type === 'trigger' ? 0.02 : 0.01}
          linkWidth={(link: any) => link.type === 'dependency' ? 1 : 2}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.1}
          backgroundColor="#050505"
        />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 p-3 bg-[#0D0D0E]/80 border border-[#1C1C1F] rounded text-[8px] text-[#626269] space-y-2 backdrop-blur-sm z-10">
          <div className="font-bold text-[#E1E1E6] mb-1 uppercase tracking-widest">Architecture Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#F27D26] rounded-full" />
            <span>TRAFFIC FLOW</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#00FF00] rounded-full" />
            <span>EVENT TRIGGER</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#3B82F6] rounded-full" />
            <span>INTEGRATION</span>
          </div>
          <div className="pt-1 border-t border-[#1C1C1F] flex items-center gap-2">
            <div className="w-2 h-2 border border-[#F27D26] rotate-45" />
            <span>LOAD BALANCER</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 border border-[#00FF00]" />
            <span>GKE CLUSTER</span>
          </div>
        </div>
      </div>

      {/* Side Panel for Details */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="w-80 bg-[#0D0D0E] border-l border-[#1C1C1F] p-6 overflow-y-auto z-20"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">Resource Details</div>
              <button onClick={() => setSelectedNode(null)} className="text-[#626269] hover:text-[#E1E1E6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-bold text-[#E1E1E6] mb-1">{selectedNode.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#1C1C1F] border border-[#323236] rounded text-[#626269] uppercase font-bold">
                    {selectedNode.type}
                  </span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold",
                    selectedNode.status === 'healthy' ? "bg-green-500/10 text-green-500" :
                    selectedNode.status === 'warning' ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-red-500/10 text-red-500"
                  )}>
                    {selectedNode.status}
                  </span>
                </div>
              </div>

              {selectedNode.purpose && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-[#626269] uppercase tracking-widest">Purpose & Usage</div>
                  <p className="text-[11px] text-[#A1A1A6] leading-relaxed italic">
                    "{selectedNode.purpose}"
                  </p>
                </div>
              )}

              {selectedNode.details && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-[#626269] uppercase tracking-widest">Operational Metadata</div>
                  <div className="p-3 bg-[#050505] border border-[#1C1C1F] rounded text-[10px] text-[#E1E1E6] font-mono whitespace-pre-wrap">
                    {selectedNode.details}
                  </div>
                </div>
              )}

              {selectedNode.config && Object.keys(selectedNode.config).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-[#626269] uppercase tracking-widest">Configuration Overview</div>
                  <div className="space-y-2">
                    {Object.entries(selectedNode.config).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-[#050505] border border-[#1C1C1F] rounded">
                        <span className="text-[9px] text-[#626269] uppercase">{key}</span>
                        <span className="text-[10px] text-[#E1E1E6] font-mono">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-[#1C1C1F]">
                <button className="w-full py-3 bg-[#1C1C1F] border border-[#323236] text-[10px] font-bold text-[#E1E1E6] rounded hover:bg-[#323236] transition-all flex items-center justify-center gap-2">
                  <Activity className="w-3 h-3" />
                  VIEW_LIVE_TELEMETRY
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeploymentHistory({ deployments }: { deployments: Deployment[] }) {
  return (
    <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden flex flex-col">
      <div className="p-4 bg-[#1C1C1F]/50 border-b border-[#1C1C1F] flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-widest text-[#626269] uppercase flex items-center gap-2">
          <History className="w-3 h-3 text-[#F27D26]" />
          Deployment History
        </div>
        <div className="text-[9px] text-[#323236] uppercase font-bold">Chronological_View</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1C1C1F] bg-[#050505]">
              <th className="p-4 text-[9px] font-bold text-[#626269] uppercase tracking-wider">Status</th>
              <th className="p-4 text-[9px] font-bold text-[#626269] uppercase tracking-wider">Deployment ID</th>
              <th className="p-4 text-[9px] font-bold text-[#626269] uppercase tracking-wider">Version</th>
              <th className="p-4 text-[9px] font-bold text-[#626269] uppercase tracking-wider">Environment</th>
              <th className="p-4 text-[9px] font-bold text-[#626269] uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C1C1F]">
            {deployments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[10px] text-[#323236] italic">
                  No deployment history available
                </td>
              </tr>
            ) : (
              deployments.map((dep) => (
                <tr key={dep.id} className="hover:bg-[#1C1C1F]/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {dep.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : dep.status === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-[#F27D26] animate-spin" />
                      )}
                      <span className={cn(
                        "text-[9px] font-bold uppercase",
                        dep.status === 'success' ? "text-green-500" :
                        dep.status === 'failed' ? "text-red-500" :
                        "text-[#F27D26]"
                      )}>
                        {dep.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-mono text-[#E1E1E6]">{dep.id}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-2.5 h-2.5 text-[#626269]" />
                      <span className="text-[10px] text-[#E1E1E6]">{dep.version}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C1C1F] text-[#626269] font-bold uppercase tracking-tighter">
                      {dep.env}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-[#626269]">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="text-[10px]">{new Date(dep.timestamp).toLocaleString()}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimplifiedStatusFeed({ deployments }: { deployments: Deployment[] }) {
  return (
    <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden flex flex-col h-[300px]">
      <div className="p-3 bg-[#1C1C1F]/50 border-b border-[#1C1C1F] flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-widest text-[#626269] uppercase flex items-center gap-2">
          <Activity className="w-3 h-3 text-[#F27D26]" />
          Deployment Feed
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {deployments.length === 0 ? (
          <div className="p-4 text-[10px] text-[#323236] italic">No deployments found</div>
        ) : (
          deployments.slice(0, 15).map(dep => (
            <div key={dep.id} className="p-2 bg-[#050505] border border-[#1C1C1F] rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dep.status === 'success' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : dep.status === 'failed' ? (
                  <XCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <Loader2 className="w-3 h-3 text-[#F27D26] animate-spin" />
                )}
                <span className="text-[9px] font-bold text-[#E1E1E6]">{dep.id}</span>
                <span className="text-[8px] text-[#323236] uppercase">{dep.env}</span>
              </div>
              <div className="text-[8px] font-mono text-[#323236]">
                {dep.status === 'success' ? 'STABLE' : dep.status === 'failed' ? 'ERROR' : 'PROC'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FeatureTooltip({ title, description, restricted }: { title: string, description: string, restricted?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1 group" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {restricted ? (
        <ShieldAlert className="w-3 h-3 text-red-500 cursor-help" />
      ) : (
        <Info className="w-3 h-3 text-[#626269] cursor-help" />
      )}
      <AnimatePresence>
        {show && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-[#1C1C1F] border border-[#323236] rounded shadow-2xl z-[100] pointer-events-none"
          >
            <div className="text-[9px] font-bold text-[#F27D26] mb-1 uppercase tracking-widest">{title}</div>
            <p className="text-[8px] text-[#E1E1E6] leading-tight">
              {restricted ? "Contact the System Admin to request access to this technical asset." : description}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#323236]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SystemLegend() {
  return (
    <div className="flex items-center gap-6 px-8 py-4 bg-[#0D0D0E] border-t border-[#1C1C1F] text-[9px] font-bold tracking-widest text-[#626269]">
      <span className="text-[#323236]">SYSTEM_LEGEND:</span>
      <div className="flex items-center gap-2">
        <Info className="w-3 h-3 text-[#626269]" />
        <span>INFO: TECH_EXPLANATION</span>
      </div>
      <div className="flex items-center gap-2">
        <Shield className="w-3 h-3 text-red-500" />
        <span>SECURITY: RBAC_RESTRICTION</span>
      </div>
      <div className="flex items-center gap-2">
        <Zap className="w-3 h-3 text-yellow-500" />
        <span>PERFORMANCE: SELF_EVOLUTION</span>
      </div>
      <div className="flex items-center gap-2">
        <Wrench className="w-3 h-3 text-green-500" />
        <span>AUTO_FIX: AI_PATCHED</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-[#323236]">STACK: NEXT16 | GO | GEMINI | WS</span>
      </div>
    </div>
  );
}

function InfrastructureMap({ nodes, edges }: { nodes: any[], edges: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Edges
      edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (fromNode && toNode) {
          ctx.beginPath();
          ctx.moveTo(fromNode.x, fromNode.y);
          ctx.lineTo(toNode.x, toNode.y);
          ctx.strokeStyle = '#323236';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Draw arrow
          const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
          ctx.beginPath();
          ctx.moveTo(toNode.x - 15 * Math.cos(angle), toNode.y - 15 * Math.sin(angle));
          ctx.lineTo(toNode.x - 25 * Math.cos(angle - 0.2), toNode.y - 25 * Math.sin(angle - 0.2));
          ctx.lineTo(toNode.x - 25 * Math.cos(angle + 0.2), toNode.y - 25 * Math.sin(angle + 0.2));
          ctx.fillStyle = '#323236';
          ctx.fill();
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#0D0D0E';
        ctx.fill();
        ctx.strokeStyle = node.type === 'agent' ? '#F27D26' : '#323236';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#E1E1E6';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + 35);
        
        // Pulse effect for agent
        if (node.type === 'agent') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 25 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(242, 125, 38, 0.2)';
          ctx.stroke();
        }
      });
    };

    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animationId);
  }, [nodes, edges]);

  return (
    <div className="relative w-full h-[400px] bg-[#050505] rounded-lg border border-[#1C1C1F] overflow-hidden">
      <div className="absolute top-4 left-4 text-[10px] font-bold text-[#626269] tracking-widest uppercase">Live Infrastructure Map</div>
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={400} 
        className="w-full h-full"
      />
    </div>
  );
}

function CodeDiffViewer({ before, after }: { before: string, after: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 h-[300px] overflow-hidden border border-[#1C1C1F] rounded bg-[#050505]">
      <div className="flex flex-col border-r border-[#1C1C1F]">
        <div className="p-2 bg-[#1C1C1F]/50 text-[10px] font-bold text-[#626269] border-b border-[#1C1C1F]">BEFORE</div>
        <pre className="p-4 text-[10px] text-red-400/80 overflow-auto flex-1 font-mono leading-relaxed">
          {before}
        </pre>
      </div>
      <div className="flex flex-col">
        <div className="p-2 bg-[#F27D26]/10 text-[10px] font-bold text-[#F27D26] border-b border-[#1C1C1F]">AFTER (PROPOSED)</div>
        <pre className="p-4 text-[10px] text-green-400/80 overflow-auto flex-1 font-mono leading-relaxed">
          {after}
        </pre>
      </div>
    </div>
  );
}

function AuditLogsView({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold tracking-widest text-[#626269]">GOVERNANCE AUDIT LOGS</h3>
        <div className="text-[10px] text-[#626269]">TOTAL ENTRIES: {logs.length}</div>
      </div>
      <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1C1C1F]/50 border-b border-[#1C1C1F]">
              <th className="p-4 text-[10px] font-bold text-[#626269] uppercase tracking-widest">Timestamp</th>
              <th className="p-4 text-[10px] font-bold text-[#626269] uppercase tracking-widest">Action</th>
              <th className="p-4 text-[10px] font-bold text-[#626269] uppercase tracking-widest">User</th>
              <th className="p-4 text-[10px] font-bold text-[#626269] uppercase tracking-widest">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-[#1C1C1F] hover:bg-[#1C1C1F]/20 transition-colors">
                <td className="p-4 text-[10px] text-[#626269]">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-[#F27D26]/10 text-[#F27D26] text-[9px] font-bold rounded border border-[#F27D26]/20">
                    {log.action}
                  </span>
                </td>
                <td className="p-4">
                  <div className="text-[10px] font-bold text-[#E1E1E6]">{log.userId}</div>
                  <div className="text-[8px] text-[#626269]">{log.userRole}</div>
                </td>
                <td className="p-4 text-[10px] text-[#E1E1E6]">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemLogs({ logs }: { logs: { id: string, message: string, timestamp: string }[] }) {
  const saMatch = logs.find(l => l.message.includes('Application service account:'))?.message.match(/account: (.*)\. Please/);
  const serviceAccount = saMatch ? saMatch[1] : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden flex flex-col h-[300px]">
      <div className="p-3 bg-[#1C1C1F]/50 border-b border-[#1C1C1F] flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-widest text-[#626269] uppercase flex items-center gap-2">
          <Terminal className="w-3 h-3 text-[#F27D26]" />
          System & Security Logs
        </div>
        <div className="flex items-center gap-4">
          {serviceAccount && (
            <button 
              onClick={() => copyToClipboard(serviceAccount)}
              className="text-[8px] font-bold text-[#F27D26] hover:underline flex items-center gap-1"
            >
              COPY_SERVICE_ACCOUNT
            </button>
          )}
          <div className="text-[9px] text-[#323236] uppercase font-bold">Live_Stream</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px]">
        {logs.length === 0 ? (
          <div className="text-[#323236] italic">Awaiting system events...</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-[#323236] shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className={cn(
                "break-all",
                log.message.includes('[ERROR]') || log.message.includes('denied') ? "text-red-400" :
                log.message.includes('[SECURITY]') || log.message.includes('WARNING') ? "text-yellow-400" :
                log.message.includes('SUCCESS') ? "text-green-400" :
                "text-[#626269]"
              )}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GcpSetupCard({ projectId, serviceAccount, logs }: { projectId: string, serviceAccount?: string, logs: any[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/system/refresh-gcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': 'SECURE_ADMIN_KEY_2024' // This should be handled by a proper auth context in a real app
        }
      });
      if (response.ok) {
        console.log("Refresh triggered");
      }
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setTimeout(() => setRefreshing(false), 2000);
    }
  };

  const setupErrors = logs.filter(l => (l.message.includes('PERMISSION_DENIED') || l.message.includes('[ERROR]')) && l.message.includes(projectId));
  const commands = setupErrors.map(l => {
    const match = l.message.match(/Run: (gcloud .*)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  const isPlaceholder = projectId === 'mexico-gec' || projectId === '0';
  
  return (
    <div className="bg-[#0D0D0E] border border-[#F27D26]/20 rounded-lg overflow-hidden flex flex-col">
      <div className="p-3 bg-[#F27D26]/5 border-b border-[#F27D26]/20 flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-widest text-[#F27D26] uppercase flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          GCP INFRASTRUCTURE SETUP
        </div>
        <div className="flex items-center gap-2">
          {isPlaceholder && (
            <div className="flex items-center gap-2 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded">
              <AlertCircle className="w-2.5 h-2.5 text-red-500" />
              <span className="text-[8px] text-red-500 font-bold uppercase">Placeholder Project</span>
            </div>
          )}
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border border-[#F27D26]/30 text-[8px] font-bold uppercase transition-all ${refreshing ? 'bg-[#F27D26]/20 text-white cursor-wait' : 'hover:bg-[#F27D26]/10 text-[#F27D26]'}`}
          >
            <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Resources'}
          </button>
          {commands.length > 0 ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-[8px] text-yellow-500 font-bold uppercase">Action Required</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[8px] text-green-500 font-bold uppercase">Permissions Active</span>
            </>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[8px] text-[#626269] uppercase font-bold">Project ID</div>
            <div className="text-[10px] font-mono text-[#E1E1E6] bg-[#050505] p-2 rounded border border-[#1C1C1F] flex items-center justify-between">
              {projectId}
              <button onClick={() => copyToClipboard(projectId, 'pid')} className="text-[#F27D26] hover:text-white transition-colors">
                {copied === 'pid' ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[8px] text-[#626269] uppercase font-bold">Service Account</div>
            <div className="text-[10px] font-mono text-[#E1E1E6] bg-[#050505] p-2 rounded border border-[#1C1C1F] flex items-center justify-between">
              <span className="truncate mr-2">{serviceAccount || 'Detecting...'}</span>
              {serviceAccount && (
                <button onClick={() => copyToClipboard(serviceAccount, 'sa')} className="text-[#F27D26] hover:text-white transition-colors shrink-0">
                  {copied === 'sa' ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[8px] text-[#626269] uppercase font-bold">Required Permissions</div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {commands.length > 0 ? (
              commands.map((cmd, i) => (
                <div key={i} className="group relative">
                  <pre className="text-[9px] font-mono text-yellow-500/90 bg-[#1C1C1F]/30 p-2 rounded border border-yellow-500/20 break-all whitespace-pre-wrap">
                    {cmd}
                  </pre>
                  <button 
                    onClick={() => copyToClipboard(cmd!, `cmd-${i}`)}
                    className="absolute top-2 right-2 p-1 bg-[#0D0D0E] border border-[#323236] rounded text-[#F27D26] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copied === `cmd-${i}` ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  </button>
                </div>
              ))
            ) : (
              <div className="text-[10px] text-green-500/80 bg-green-500/5 p-3 rounded border border-green-500/20 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                All required IAM roles detected for active services.
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded flex gap-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-[9px] text-blue-400 leading-relaxed">
            These permissions allow the ADDB Agent to visualize and manage your GCP resources. 
            Granting 'Viewer' and 'Storage Admin' roles is necessary for full infrastructure visibility.
          </p>
        </div>
      </div>
    </div>
  );
}

function SystemUpdateOverlay({ progress, version }: { progress: number, version: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
    >
      <div className="w-full max-w-md p-8 bg-[#0D0D0E] border border-[#1C1C1F] rounded-xl shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center animate-pulse">
            <RefreshCw className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#E1E1E6]">System Restoration</h3>
            <p className="text-[10px] text-[#626269] uppercase tracking-widest">Restoring to {version}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-[10px] font-mono text-[#626269]">
            <span>PROGRESS</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#1C1C1F] rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
            />
          </div>
          <p className="text-[10px] text-center text-[#323236] italic">
            {progress < 30 ? "Initializing restoration protocols..." :
             progress < 60 ? "Reverting system evolution patches..." :
             progress < 90 ? "Validating core configuration..." :
             "Finalizing system stabilization..."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ArchetypeArchitectureView() {
  const archetypes = [
    {
      id: 'zonal',
      title: 'Zonal Archetype',
      description: 'Application deployed in a single zone. Best for non-critical workloads or development environments.',
      nodes: [
        { id: 'lb-1', name: 'Regional LB', type: 'global-lb', status: 'healthy', region: 'us-central1' },
        { id: 'app-1', name: 'App Instance', type: 'service', status: 'healthy', region: 'us-central1', zone: 'us-central1-a' },
        { id: 'db-1', name: 'Cloud SQL', type: 'database', status: 'healthy', region: 'us-central1', zone: 'us-central1-a' }
      ]
    },
    {
      id: 'regional',
      title: 'Regional Archetype',
      description: 'Distributed across multiple zones in one region. Provides high availability against zonal failures.',
      nodes: [
        { id: 'lb-2', name: 'Regional LB', type: 'global-lb', status: 'healthy', region: 'us-east1' },
        { id: 'app-2a', name: 'App Instance A', type: 'service', status: 'healthy', region: 'us-east1', zone: 'us-east1-b' },
        { id: 'app-2b', name: 'App Instance B', type: 'service', status: 'healthy', region: 'us-east1', zone: 'us-east1-c' },
        { id: 'db-2', name: 'HA Cloud SQL', type: 'database', status: 'healthy', region: 'us-east1' }
      ]
    },
    {
      id: 'multi-regional',
      title: 'Multi-regional Archetype',
      description: 'Deployed across multiple regions. Provides disaster recovery and low latency for global users.',
      nodes: [
        { id: 'glb-3', name: 'Global LB', type: 'global-lb', status: 'healthy' },
        { id: 'reg-a', name: 'Region US', type: 'cloud', status: 'healthy', region: 'us-west1' },
        { id: 'reg-b', name: 'Region EU', type: 'cloud', status: 'healthy', region: 'europe-west1' },
        { id: 'db-3', name: 'Spanner (Global)', type: 'database', status: 'healthy' }
      ]
    },
    {
      id: 'global',
      title: 'Global Archetype',
      description: 'Fully global deployment with edge caching and global load balancing.',
      nodes: [
        { id: 'cdn', name: 'Cloud CDN', type: 'service', status: 'healthy' },
        { id: 'glb-4', name: 'Global LB', type: 'global-lb', status: 'healthy' },
        { id: 'backend-us', name: 'US Backend', type: 'cluster', status: 'healthy', region: 'us-central1' },
        { id: 'backend-asia', name: 'Asia Backend', type: 'cluster', status: 'healthy', region: 'asia-east1' }
      ]
    },
    {
      id: 'hybrid',
      title: 'Hybrid Archetype',
      description: 'Connects Google Cloud resources with on-premises infrastructure via Interconnect or VPN.',
      nodes: [
        { id: 'gcp-res', name: 'Cloud Run', type: 'service', status: 'healthy', region: 'us-central1' },
        { id: 'interconnect', name: 'Cloud Interconnect', type: 'agent', status: 'healthy' },
        { id: 'on-prem', name: 'On-Prem Data Center', type: 'vm', status: 'warning' }
      ]
    },
    {
      id: 'multicloud',
      title: 'Multicloud Archetype',
      description: 'Workloads distributed across multiple cloud providers (e.g., GCP and AWS) using Anthos.',
      nodes: [
        { id: 'anthos', name: 'Anthos Config Mgt', type: 'agent', status: 'healthy' },
        { id: 'gke-gcp', name: 'GKE (GCP)', type: 'cluster', status: 'healthy', region: 'us-central1' },
        { id: 'gke-aws', name: 'EKS (AWS)', type: 'cluster', status: 'healthy', region: 'aws-us-east-1' }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {archetypes.map(arch => (
        <div key={arch.id} className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-xl p-6 hover:border-[#F27D26]/50 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-[#F27D26] uppercase">{arch.title}</h3>
            <div className="px-2 py-0.5 rounded bg-[#1C1C1F] text-[8px] font-bold text-[#626269] uppercase tracking-tighter">
              Archetype {arch.id.toUpperCase()}
            </div>
          </div>
          <p className="text-[10px] text-[#626269] mb-6 leading-relaxed italic">
            {arch.description}
          </p>
          
          <div className="relative h-48 bg-[#050505] rounded-lg border border-[#1C1C1F] overflow-hidden p-4">
             {/* Simplified Visual Representation */}
             <div className="flex items-center justify-center h-full gap-4">
                {arch.nodes.map((node, idx) => {
                  const Icon = node.type === 'database' ? Database : 
                               node.type === 'global-lb' ? Network :
                               node.type === 'service' ? Zap :
                               node.type === 'cluster' ? Server :
                               node.type === 'agent' ? Bot : Cpu;
                  
                  return (
                    <div key={node.id} className="flex flex-col items-center gap-2">
                       <div className="w-10 h-10 rounded bg-[#1C1C1F] border border-[#3B82F6]/30 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[#3B82F6]" />
                       </div>
                       <div className="text-[8px] font-bold text-[#626269] uppercase text-center w-16 truncate">{node.name}</div>
                       {idx < arch.nodes.length - 1 && (
                         <div className="absolute h-px bg-[#1C1C1F] w-8" style={{ left: `${(idx + 1) * 25}%` }} />
                       )}
                    </div>
                  );
                })}
             </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
             {arch.nodes.map(n => (
               <div key={n.id} className="px-2 py-1 rounded bg-[#050505] border border-[#1C1C1F] text-[7px] font-bold text-[#626269] uppercase">
                 {n.type}: {n.region || 'global'}
               </div>
             ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StructuredArchitectureView({ data }: { data: ArchitectureData }) {
  // Group nodes by project
  const projects = Array.from(new Set(data.nodes.map(n => n.project || 'Unknown Project')));

  return (
    <div className="w-full space-y-12 bg-[#050505] p-8 rounded-lg border border-[#1C1C1F]">
      {projects.map(project => {
        const projectNodes = data.nodes.filter(n => (n.project || 'Unknown Project') === project);
        const regions = Array.from(new Set(projectNodes.map(n => n.region || 'global')));

        return (
          <div key={project} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[#1C1C1F]" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-[#626269] uppercase">{project}</h2>
              <div className="h-px flex-1 bg-[#1C1C1F]" />
            </div>

            <div className="relative border-2 border-[#3B82F6] rounded-xl p-8 bg-[#3B82F6]/5">
              <div className="absolute -top-3 left-6 px-3 bg-[#3B82F6] text-[10px] font-bold text-white rounded uppercase tracking-widest">
                Google Cloud
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {regions.map(region => {
                  const regionNodes = projectNodes.filter(n => (n.region || 'global') === region);
                  const zones = Array.from(new Set(regionNodes.map(n => n.zone).filter(Boolean)));
                  const regionalNodes = regionNodes.filter(n => !n.zone);

                  return (
                    <div key={region} className="relative border border-[#1C1C1F] rounded-lg p-6 bg-[#0D0D0E]">
                      <div className="absolute -top-2.5 left-4 px-2 bg-[#0D0D0E] text-[9px] font-bold text-[#626269] uppercase border border-[#1C1C1F] rounded">
                        {region === 'global' ? 'Global Resources' : `Region: ${region}`}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        {zones.length > 0 ? (
                          zones.map(zone => (
                            <div key={zone} className="flex flex-col gap-3">
                              <div className="text-[8px] font-bold text-[#626269] uppercase tracking-tighter text-center py-1 bg-[#1C1C1F]/30 rounded">
                                Zone: {zone?.split('-').pop()}
                              </div>
                              <div className="space-y-2">
                                {regionNodes.filter(n => n.zone === zone).map(node => (
                                  <ArchitectureNodeCard key={node.id} node={node} />
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
                             {regionNodes.map(node => (
                               <ArchitectureNodeCard key={node.id} node={node} />
                             ))}
                          </div>
                        )}
                      </div>
                      
                      {zones.length > 0 && regionalNodes.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-[#1C1C1F]">
                          <div className="text-[8px] font-bold text-[#626269] uppercase mb-3">Regional Services</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {regionalNodes.map(node => (
                              <ArchitectureNodeCard key={node.id} node={node} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend & Layers */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pt-8 border-t border-[#1C1C1F]">
        {['Zonal', 'Regional', 'Multi-regional', 'Global', 'Multicloud', 'Hybrid'].map(layer => (
          <div key={layer} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
            <span className="text-[9px] font-bold text-[#626269] uppercase tracking-widest">{layer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchitectureNodeCard({ node }: { node: ArchitectureNode }) {
  const Icon = node.type === 'database' ? Database : 
               node.type === 'bucket' ? Layers :
               node.type === 'cluster' ? Server :
               node.type === 'service' ? Zap :
               node.type === 'vm' ? Cpu : 
               node.type === 'external-users' ? Users :
               node.type === 'global-lb' ? Network :
               node.type === 'agent' ? Bot :
               node.type === 'topic' ? MessageSquare :
               node.type === 'repo' ? Box : Globe;

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={cn(
        "p-3 rounded border bg-[#050505] transition-all cursor-pointer group",
        node.status === 'healthy' ? "border-[#1C1C1F] hover:border-[#00FF00]/30" : 
        node.status === 'warning' ? "border-[#F27D26]/30" : "border-red-500/30"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "p-1.5 rounded",
          node.status === 'healthy' ? "bg-[#1C1C1F] group-hover:bg-[#00FF00]/10" : 
          node.status === 'warning' ? "bg-[#F27D26]/10" : "bg-red-500/10"
        )}>
          <Icon className={cn(
            "w-3 h-3",
            node.status === 'healthy' ? "text-[#626269] group-hover:text-[#00FF00]" : 
            node.status === 'warning' ? "text-[#F27D26]" : "text-red-500"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-[#E1E1E6] truncate uppercase tracking-tight">{node.name}</div>
          <div className="text-[8px] text-[#626269] uppercase">{node.type}</div>
        </div>
      </div>
      {node.purpose && (
        <p className="text-[8px] text-[#626269] line-clamp-2 leading-tight italic">
          "{node.purpose}"
        </p>
      )}
    </motion.div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'history' | 'repos' | 'team' | 'audit' | 'architecture' | 'evolution' | 'help' | 'whats-new' | 'governance' | 'cost-intel'>('dashboard');
  const [architectureViewMode, setArchitectureViewMode] = useState<'graph' | 'structured' | 'archetypes'>('structured');
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'model', 
      content: 'ADDB System Online. I am your Autonomous DevOps Deployment Bot. I can help you manage multi-cloud infrastructure, trigger deployments, and optimize your GCP/AWS/Azure resources. How can I assist you today?', 
      timestamp: new Date().toISOString() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // RBAC & Governance State
  const [currentUser, setCurrentUser] = useState<User>({
    id: "USR-001",
    name: "Navaneeth J",
    email: "navaneeth.j08@gmail.com",
    role: "SYSTEM_ADMIN",
    scope: [{ tenantId: "*", cloudProjectId: "*" }]
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('DEVOPS_ENGINEER');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  // New State
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>(CLOUD_PROVIDERS[0]);
  const [tenantId, setTenantId] = useState('mexico-gec');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [systemSuggestions, setSystemSuggestions] = useState<SystemSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<{suggestion: SystemSuggestion, effectiveness: string, timestamp: string}[]>([]);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionStatus, setEvolutionStatus] = useState<string | null>(null);
  const [needsRelease, setNeedsRelease] = useState(false);
  const [governancePolicies, setGovernancePolicies] = useState<GovernancePolicy[]>([]);
  const [costRecommendations, setCostRecommendations] = useState<CostRecommendation[]>([]);
  const [infraMap, setInfraMap] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [architectureData, setArchitectureData] = useState<ArchitectureData>({ nodes: [], links: [] });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingProjectId, setOnboardingProjectId] = useState('');
  const [onboardingCommand, setOnboardingCommand] = useState('');
  const [isSystemIntelOpen, setIsSystemIntelOpen] = useState(false);
  const [isTerminalResumed, setIsTerminalResumed] = useState(false);
  const [botBehavior, setBotBehavior] = useState<BotBehavior>('ACTIVE');
  const [projectId, setProjectId] = useState('mexico-gec');
  const [isSandbox, setIsSandbox] = useState(false);
  const isPlaceholder = projectId === 'mexico-gec' || projectId === '0';
  const [activeTerminalLogs, setActiveTerminalLogs] = useState<string[]>([]);
  const [systemLogs, setSystemLogs] = useState<{ id: string, message: string, timestamp: string }[]>([]);
  const [serviceAccount, setServiceAccount] = useState<string | undefined>();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [adminSecretKey, setAdminSecretKey] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('RUNNING');
  const [systemVersion, setSystemVersion] = useState('v1.0.4');

  // Firebase Chat State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    // Autonomous Mode Simulation
    if (botBehavior !== 'AUTONOMOUS') return;

    const interval = setInterval(async () => {
      // Check for active user session before proceeding
      if (!currentUser || !currentUser.id) {
        console.warn('[AUTONOMOUS] No active user session found. Skipping autonomous actions.');
        return;
      }

      // Check if project ID is valid (not placeholder)
      if (!projectId || projectId === '0' || projectId.includes('mexico-gec')) {
        console.warn('[AUTONOMOUS] Invalid GCP Project ID detected. Skipping autonomous actions.');
        return;
      }

      const failedDeployments = deployments.filter(d => d.status === 'failed');
      if (failedDeployments.length > 0) {
        const d = failedDeployments[0];
        console.log(`[AUTONOMOUS] Detected failed deployment: ${d.id}. Analyzing...`);
        
        try {
          const analysis = await analyzeFailure(d);
          console.log(`[AUTONOMOUS] Analysis for ${d.id}: ${analysis.issueIdentified}. Applying fix: ${analysis.fixApplied}`);
          
          let fixStatus = 'applied';
          if (analysis.codeChange) {
            console.log(`[AUTONOMOUS] Applying code fix to ${analysis.codeChange.filePath}...`);
            try {
              const res = await fetch('/api/system-intelligence/modify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...analysis.codeChange,
                  description: `Autonomous fix for deployment ${d.id}: ${analysis.fixApplied}`
                })
              });
              if (!res.ok) {
                const errData = await res.json();
                console.error('[AUTONOMOUS] Code fix failed:', errData.message);
                fixStatus = 'failed';
              } else {
                console.log('[AUTONOMOUS] Code fix applied successfully.');
                fixStatus = 'success';
              }
            } catch (err) {
              console.error('[AUTONOMOUS] Error calling modify-code API:', err);
              fixStatus = 'error';
            }
          }

          // Update deployment status to 'success' if fix was applied or if it was a non-code fix
          const dRef = doc(db, 'deployments', d.id);
          await updateDoc(dRef, { 
            status: fixStatus === 'failed' ? 'failed' : 'success', 
            logs: [...d.logs, `[AUTONOMOUS_FIX] ${analysis.fixApplied} (${fixStatus})`] 
          });

          // Add notification
          const notif: Notification = {
            id: `auto-${Date.now()}`,
            title: fixStatus === 'failed' ? 'Autonomous Fix Failed' : 'Autonomous Fix Applied',
            message: fixStatus === 'failed' 
              ? `Bot failed to apply fix for deployment ${d.id}.`
              : `Bot automatically fixed deployment ${d.id}: ${analysis.fixApplied}`,
            type: 'SYSTEM_ALERT',
            timestamp: new Date().toISOString(),
            read: false,
            severity: fixStatus === 'failed' ? 'CRITICAL' : 'MAJOR',
            userId: currentUser.id || 'SYSTEM'
          };
          await addDoc(collection(db, 'notifications'), notif);
        } catch (err) {
          console.error("[AUTONOMOUS] Failed to apply fix:", err);
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [botBehavior, deployments, currentUser.id]);

  useEffect(() => {
    // Proactive System Evolution Loop
    if (botBehavior !== 'AUTONOMOUS') return;

    const interval = setInterval(async () => {
      // Check for active user session before proceeding
      if (!currentUser || !currentUser.id) {
        console.warn('[AUTONOMOUS] No active user session found. Skipping proactive evolution.');
        return;
      }

      // Check if project ID is valid (not placeholder)
      if (!projectId || projectId === '0' || projectId.includes('mexico-gec')) {
        console.warn('[AUTONOMOUS] Invalid GCP Project ID detected. Skipping proactive evolution.');
        return;
      }

      if (botBehavior !== 'AUTONOMOUS' || isEvolving) return;
      
      console.log('[AUTONOMOUS] Proactive evolution check...');
      setIsEvolving(true);
      try {
        const suggestions = await generateSuggestions(architectureData.nodes, deployments, projectId);
        if (suggestions && suggestions.length > 0) {
          console.log(`[AUTONOMOUS] Found ${suggestions.length} suggestions. Applying all...`);
          for (const suggestion of suggestions) {
            console.log(`[AUTONOMOUS] Saving and Applying: ${suggestion.title}`);
            // Ensure suggestion is in Firestore so the backend can find it
            await setDoc(doc(db, 'system_suggestions', suggestion.id), suggestion, { merge: true });
            await applySystemEvolution(suggestion.id, suggestion);
          }
        } else {
          console.log('[AUTONOMOUS] No new suggestions found.');
        }
      } catch (err) {
        console.error('[AUTONOMOUS] Proactive evolution failed', err);
      } finally {
        setIsEvolving(false);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [botBehavior, deployments, architectureData.nodes, projectId]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          if (data.projectId) setProjectId(data.projectId);
          if (data.serviceAccount) setServiceAccount(data.serviceAccount);
          if (data.isSandbox) setIsSandbox(data.isSandbox);
        }
      } catch (err) {
        console.error('Failed to fetch GCP config', err);
      }
    };
    fetchConfig();

    // Auto-onboard API key if in AI Studio and missing
    const checkApiKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          console.log("[AI Studio] No API key selected. Prompting user...");
          // We don't call openSelectKey automatically here to avoid annoying the user on every refresh,
          // but we ensure the UI is ready.
        }
      }
    };
    checkApiKey();
  }, []);

  const fetchInitData = async () => {
    try {
      const data = await safeFetch('/api/init');
      setDeployments(data.deployments || []);
      setNotifications(data.notifications || []);
      setApprovals(data.approvals || []);
      setSystemSuggestions(data.suggestions || []);
      setReleases(data.releases || []);
      setRepositories(data.repositories || []);
      setInfraMap(data.infraMap || { nodes: [], links: [] });
      setArchitectureData(data.architectureData || { nodes: [], links: [] });
      
      if (data.team) setTeamMembers(data.team);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.feedbacks) setFeedbacks(data.feedbacks);
      if (data.tickets) setTickets(data.tickets);
      if (data.governance) setGovernancePolicies(data.governance);
      if (data.costIntel) setCostRecommendations(data.costIntel);
    } catch (err) {
      console.error('Failed to fetch initial data', err);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;
    fetchInitData();
  }, [isAuthReady, currentUser.role]);

  useEffect(() => {
    // Firebase Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            const isOwner = user.email === 'navaneeth.j08@gmail.com';
            const finalRole = isOwner ? 'SYSTEM_ADMIN' : userData.role;
            
            const updatedUser = {
              ...userData,
              id: user.uid,
              name: user.displayName || userData.name || 'Unknown User',
              email: user.email || userData.email || '',
              role: finalRole
            };

            if (userData.role !== finalRole) {
              await updateDoc(doc(db, 'users', user.uid), { role: finalRole });
            }

            setCurrentUser(updatedUser);
          } else {
            // New user - assign default role or check if it's the owner
            const isOwner = user.email === 'navaneeth.j08@gmail.com';
            const newUser: User = {
              id: user.uid,
              name: user.displayName || 'New User',
              email: user.email || '',
              role: isOwner ? 'SYSTEM_ADMIN' : 'DEVOPS_ENGINEER',
              scope: [{ tenantId: '*', cloudProjectId: '*' }]
            };
            await setDoc(doc(db, 'users', user.uid), newUser);
            setCurrentUser(newUser);
          }
        } catch (err) {
          console.error('Failed to fetch user role', err);
          // Fallback to basic user info
          setCurrentUser(prev => ({
            ...prev,
            id: user.uid,
            name: user.displayName || prev.name,
            email: user.email || prev.email
          }));
        }
      } else {
        setCurrentUser({
          id: 'GUEST_' + Math.random().toString(36).substr(2, 9),
          name: 'Guest',
          email: '',
          role: 'VIEWER',
          scope: []
        });
      }
      setIsAuthReady(true);
      setIsAuthLoading(false);
    });

    // Fetch Chat Sessions
    let unsubscribeSessions: () => void;
    if (isAuthReady && currentUser.id) {
      const q = query(
        collection(db, 'chat_sessions'),
        where('userId', '==', currentUser.id),
        orderBy('updatedAt', 'desc')
      );
      unsubscribeSessions = onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
        setChatSessions(sessions);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chat_sessions');
      });
    }

    // WebSocket Setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to ADDB WebSocket');
      // Identify user role for log masking and privacy
      socket.send(JSON.stringify({ type: 'IDENTIFY', role: currentUser.role }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SYNC_STATE') {
        setProjectId(data.state.projectId);
        setServiceAccount(data.state.serviceAccount);
        setActiveTerminalLogs(data.state.activeTerminalLogs);
      } else if (data.type === 'DEPLOYMENT_CREATED') {
        if (data.deployment) {
          setDeployments(prev => [data.deployment, ...prev]);
        }
      } else if (data.type === 'DEPLOYMENT_UPDATED') {
        const updatedDep = data.deployment as Deployment;
        if (updatedDep && updatedDep.id) {
          setDeployments(prev => prev.map(d => d && d.id === updatedDep.id ? updatedDep : d));
          
          // Update selected deployment if it's the one that was updated
          setSelectedDeployment(prev => prev?.id === updatedDep.id ? updatedDep : prev);

          // If deployment just failed and has no analysis yet, trigger AI analysis
          if (updatedDep.status === 'failed' && !updatedDep.issueIdentified) {
            handleFailureAnalysis(updatedDep);
          }
        }
      } else if (data.type === 'PERMISSION_DENIED') {
        const botMessage: ChatMessage = {
          id: `PERM-${Date.now()}`,
          role: 'model',
          content: `⚠️ **PERMISSION DENIED** detected for ${data.resource} in project \`${data.projectId}\`. 
          
          To fix this, please run the following command in your Cloud Shell or local terminal:
          
          \`\`\`bash
          ${data.command}
          \`\`\`
          
          After running the command, I will automatically retry the discovery in 5 minutes, or you can ask me to "re-sync architecture" now.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMessage]);
      } else if (data.type === 'API_DISABLED') {
        const botMessage: ChatMessage = {
          id: `API-${Date.now()}`,
          role: 'model',
          content: `🚫 **API DISABLED** detected for ${data.resource} in project \`${data.projectId}\`. 
          
          To enable this API, please run the following command in your Cloud Shell or local terminal:
          
          \`\`\`bash
          ${data.command}
          \`\`\`
          
          After enabling the API, I will automatically retry the discovery in 5 minutes, or you can ask me to "re-sync architecture" now.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, botMessage]);
      } else if (data.type === 'TERMINAL_RESUME') {
        setIsTerminalResumed(true);
        setTimeout(() => setIsTerminalResumed(false), 3000);
      } else if (data.type === 'ARCHITECTURE_UPDATED') {
        setArchitectureData(data.architecture);
        
        // Trigger AI suggestions if user is admin
        if (currentUser?.role === 'SYSTEM_ADMIN' && data.architecture.nodes.length > 0) {
          generateSuggestions(data.architecture.nodes, deployments, projectId).then(async (suggestions) => {
            for (const sugg of suggestions) {
              await setDoc(doc(db, 'system_suggestions', sugg.id), sugg, { merge: true });
            }
          }).catch(err => console.error("Error generating suggestions:", err));
        }
      } else if (data.type === 'INFRA_MAP_UPDATED') {
        setInfraMap(data.infraMap);
      } else if (data.type === 'SYSTEM_STATUS_UPDATED') {
        setSystemStatus(data.status);
        if (data.status === 'RUNNING') {
          setUpdateProgress(null);
        }
      } else if (data.type === 'SYSTEM_VERSION_UPDATED') {
        setSystemVersion(data.version);
      } else if (data.type === 'SYSTEM_UPDATE_PROGRESS') {
        setUpdateProgress(data.progress);
      } else if (data.type === 'RELEASE_CREATED') {
        setReleases(prev => [data.release, ...prev]);
      } else if (data.type === 'log') {
        setSystemLogs(prev => [{
          id: Math.random().toString(36).substring(7),
          message: data.payload,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 50));
      } else if (data.type === 'CLEAR_LOGS') {
        setSystemLogs([]);
      } else if (data.type === 'USER_NOTIFICATION') {
        const notif = data.notification || {
          id: `NOT-${Math.random().toString(36).substring(7)}`,
          type: 'SYSTEM_ALERT',
          title: 'REQUEST_LIVE',
          message: data.message,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'MINOR'
        };
        if (!notif.userId || notif.userId === currentUser.id) {
          setNotifications(prev => [notif, ...prev]);
        }
      }
    };

    const handleFailureAnalysis = async (dep: Deployment) => {
      try {
        const analysis = await analyzeFailure(dep);
        await fetch(`/api/deployments/${dep.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analysis)
        });
      } catch (err) {
        console.error('Failed to analyze deployment failure', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting...');
      // Optional: implement reconnection logic
    };

    return () => {
      socket.close();
      if (unsubscribeSessions) unsubscribeSessions();
      unsubscribeAuth();
    };
  }, [isAuthReady, currentUser.id, currentUser.role]);

  useEffect(() => {
    if (activeSessionId && isAuthReady) {
      const q = query(
        collection(db, `chat_sessions/${activeSessionId}/messages`),
        orderBy('timestamp', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => doc.data() as ChatMessage);
        setMessages(msgs.length > 0 ? msgs : [
          { 
            role: 'model', 
            content: 'ADDB System Online. I am your Autonomous DevOps Deployment Bot. I can help you manage multi-cloud infrastructure, trigger deployments, and optimize your GCP/AWS/Azure resources. How can I assist you today?', 
            timestamp: new Date().toISOString() 
          }
        ]);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `chat_sessions/${activeSessionId}/messages`);
      });
      return () => unsubscribe();
    } else if (!activeSessionId) {
      setMessages([
        { 
          role: 'model', 
          content: 'ADDB System Online. I am your Autonomous DevOps Deployment Bot. I can help you manage multi-cloud infrastructure, trigger deployments, and optimize your GCP/AWS/Azure resources.\n\n**Capabilities:**\n- Check deployment status\n- Trigger new deployments\n- Switch project contexts\n- Analyze system failures\n- Propose architectural evolutions\n\nHow can I assist you today?', 
          timestamp: new Date().toISOString() 
        }
      ]);
    }
  }, [activeSessionId, isAuthReady]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'x-user-role': currentUser.role
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text}`);
      }
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Expected JSON but received: ${text.substring(0, 100)}`);
      }
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      throw err;
    }
  };

  const fetchDeployments = async () => {
    try {
      const data = await safeFetch('/api/deployments');
      setDeployments(data);
    } catch (err) {
      console.error('Failed to fetch deployments', err);
    }
  };

  const fetchRepositories = async () => {
    try {
      const data = await safeFetch('/api/repositories');
      setRepositories(data);
    } catch (err) {
      console.error('Failed to fetch repositories', err);
    }
  };

  const fetchSystemIntelligence = async () => {
    try {
      const data = await safeFetch('/api/system-intelligence');
      setSystemSuggestions(data);
    } catch (err) {
      console.error('Failed to fetch system intelligence', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await safeFetch('/api/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const fetchApprovals = async () => {
    try {
      const data = await safeFetch('/api/approvals');
      setApprovals(data);
    } catch (err) {
      console.error('Failed to fetch approvals', err);
    }
  };

  const fetchTeam = async () => {
    try {
      const data = await safeFetch('/api/team');
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to fetch team', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await safeFetch('/api/audit-logs');
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  };

  const fetchInfraMap = async () => {
    try {
      const data = await safeFetch('/api/infra-map');
      setInfraMap(data);
    } catch (err) {
      console.error('Failed to fetch infra map', err);
    }
  };

  const fetchArchitecture = async () => {
    try {
      const data = await safeFetch('/api/architecture');
      setArchitectureData(data);
    } catch (err) {
      console.error('Failed to fetch architecture', err);
    }
  };

  const fetchTickets = async () => {
    try {
      const data = await safeFetch('/api/tickets');
      setTickets(data);
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    }
  };

  const fetchReleases = async () => {
    try {
      const data = await safeFetch('/api/releases');
      setReleases(data);
    } catch (err) {
      console.error('Failed to fetch releases', err);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await safeFetch('/api/feedbacks');
      setFeedbacks(data);
    } catch (err) {
      console.error('Failed to fetch feedbacks', err);
    }
  };

  const fetchGovernance = async () => {
    try {
      const data = await safeFetch('/api/governance');
      setGovernancePolicies(data);
    } catch (err) {
      console.error('Failed to fetch governance', err);
    }
  };

  const fetchCostIntel = async () => {
    try {
      const data = await safeFetch('/api/cost-intel');
      setCostRecommendations(data);
    } catch (err) {
      console.error('Failed to fetch cost intel', err);
    }
  };

  const handleGitPush = async () => {
    setIsPushing(true);
    setPushStatus(null);
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-admin-secret-key': adminSecretKey
        },
        body: JSON.stringify({ 
          repoUrl, 
          pat,
          userName: currentUser.name,
          userEmail: currentUser.email
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPushStatus({ type: 'success', message: data.message });
      } else {
        setPushStatus({ type: 'error', message: data.error });
      }
    } catch (err: any) {
      setPushStatus({ type: 'error', message: err.message });
    } finally {
      setIsPushing(false);
    }
  };

  const handleSystemAction = async (action: string) => {
    try {
      const res = await fetch('/api/system/lifecycle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-admin-secret-key': adminSecretKey
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        // Status will be updated via WebSocket
      } else if (data.error) {
        setNotifications(prev => [{
          id: `ERR-${Math.random().toString(36).substring(7)}`,
          type: 'SYSTEM_ALERT',
          title: 'ACTION_FAILED',
          message: data.error,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'CRITICAL'
        }, ...prev]);
      }
    } catch (err) {
      console.error('Failed to perform system action', err);
    }
  };

  const handleRestoreVersion = async (version: string) => {
    try {
      setUpdateProgress(0);
      setNotifications(prev => [{
        id: `RESTORE-${Date.now()}`,
        type: 'SYSTEM_ALERT',
        title: 'RESTORATION_INITIATED',
        message: `System restoration to version ${version} in progress...`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: 'MAJOR'
      }, ...prev]);

      const res = await fetch('/api/system/restore', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-admin-secret-key': adminSecretKey
        },
        body: JSON.stringify({ version })
      });
      const data = await res.json();
      
      if (data.success) {
        // Progress will be updated via WebSocket
      } else {
        throw new Error(data.error || 'Restoration failed');
      }
    } catch (err: any) {
      setUpdateProgress(null);
      console.error('Failed to restore system version', err);
      setNotifications(prev => [{
        id: `RESTORE-ERR-${Date.now()}`,
        type: 'SYSTEM_ALERT',
        title: 'RESTORATION_FAILED',
        message: err.message,
        timestamp: new Date().toISOString(),
        read: false,
        severity: 'CRITICAL'
      }, ...prev]);
    }
  };

  const proposeEvolution = async (ticketId: string) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      setNotifications(prev => [{
        id: `EVO-${Date.now()}`,
        type: 'SYSTEM_ALERT',
        title: 'EVOLUTION_STARTED',
        message: `ADDB is analyzing evolution request: ${ticket.userMessage}`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: 'MINOR'
      }, ...prev]);

      const proposal = await proposeEvolutionAI(ticket, architectureData.nodes);
      
      const res = await fetch(`/api/tickets/${ticketId}/propose`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-admin-secret-key': adminSecretKey
        },
        body: JSON.stringify({ proposal })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? data : t));
      
      setNotifications(prev => [{
        id: `EVO-DONE-${Date.now()}`,
        type: 'SYSTEM_ALERT',
        title: 'EVOLUTION_PROPOSED',
        message: `ADDB has generated a technical proposal for: ${ticket.userMessage}`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: 'MINOR'
      }, ...prev]);
    } catch (err) {
      console.error('Failed to propose evolution', err);
    }
  };

  const resolveTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      setTickets(prev => prev.map(t => t.id === ticketId ? data : t));
    } catch (err) {
      console.error('Failed to resolve ticket', err);
    }
  };

  const askBotToFix = async (feedbackId: string) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/fix`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
        fetchDeployments();
      }
    } catch (err) {
      console.error('Failed to ask bot to fix', err);
    }
  };

  const submitFeedback = async (deploymentId: string, feedback: string) => {
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId, feedback, userId: currentUser.id })
      });
      if (res.ok) {
        // Show success message or close modal
      }
    } catch (err) {
      console.error('Failed to submit feedback', err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const exportArchitecture = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `architecture-${new Date().toISOString()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const approveDeployment = async (id: string) => {
    try {
      const res = await fetch('/api/approvals/approve', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ id, userId: currentUser.id, userRole: currentUser.role })
      });
      const data = await res.json();
      if (data.success) {
        setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'APPROVED' } : a));
        setSelectedApproval(null);
        fetchNotifications();
        fetchDeployments();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error('Failed to approve deployment', err);
    }
  };

  const inviteStakeholder = async () => {
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole,
          scope: [{ tenantId: tenantId, cloudProjectId: 'pending' }]
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedInviteUrl(data.inviteUrl);
        fetchTeam();
      }
    } catch (err) {
      console.error('Failed to invite stakeholder', err);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      const notification = notifications.find(n => n.id === id);
      
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

      // If it's a system update notification, trigger the update
      if (notification?.type === 'SYSTEM_UPDATE') {
        const versionMatch = notification.message.match(/v\d+\.\d+\.\d+/);
        const version = versionMatch ? versionMatch[0] : 'v1.1.0';
        
        await fetch('/api/system/restore', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-role': currentUser.role,
            'x-admin-secret-key': adminSecretKey
          },
          body: JSON.stringify({ version })
        });
      }
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const applySystemEvolution = async (id: string, suggestionOverride?: SystemSuggestion) => {
    try {
      setEvolutionStatus(`Applying: ${suggestionOverride?.title || id}...`);
      setUpdateProgress(0);
      const res = await fetch('/api/system-intelligence/apply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setNeedsRelease(true);
        const suggestion = suggestionOverride || systemSuggestions.find(s => s.id === id);
        if (suggestion) {
          const effectiveness = suggestion.impact === 'high' ? '98% Reliability Improvement' : 
                               suggestion.impact === 'medium' ? '45% Performance Gain' : '15% Cost Reduction';
          setAppliedSuggestions(prev => [{
            suggestion,
            effectiveness,
            timestamp: new Date().toISOString()
          }, ...prev].slice(0, 6));
        }
        setSystemSuggestions(prev => prev.filter(s => s.id !== id));
        setEvolutionStatus('Evolution successful!');
        setTimeout(() => setEvolutionStatus(null), 3000);
      } else if (data.error) {
        setUpdateProgress(null);
        setEvolutionStatus(`Failed: ${data.error}`);
        setTimeout(() => setEvolutionStatus(null), 5000);
      }
    } catch (err) {
      setUpdateProgress(null);
      console.error('Failed to apply system evolution', err);
      setEvolutionStatus('Evolution failed.');
      setTimeout(() => setEvolutionStatus(null), 5000);
    }
  };

  const runLeakScan = async () => {
    try {
      const res = await fetch('/api/system/scan-leaks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role
        }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => [{
          id: `SCAN-${Date.now()}`,
          type: 'SYSTEM_ALERT',
          title: 'SCAN_COMPLETE',
          message: `Security scan finished. Found ${data.findings.length} potential leaks.`,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'CRITICAL'
        }, ...prev]);
      }
    } catch (err) {
      console.error('Failed to run leak scan', err);
    }
  };

  const generateOnboardingCommand = (projectId: string) => {
    let cmd = '';
    if (cloudProvider.id === 'gcp') {
      cmd = `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccount || 'YOUR_SERVICE_ACCOUNT'}" --role="roles/editor"`;
    } else if (cloudProvider.id === 'aws') {
      cmd = `aws iam attach-user-policy --user-name ADDB_AGENT --policy-arn arn:aws:iam::aws:policy/AdministratorAccess --account-id ${projectId}`;
    } else {
      cmd = `az role assignment create --assignee "addb-app-id" --role "Contributor" --scope "/subscriptions/${projectId}"`;
    }
    setOnboardingCommand(cmd);
  };

  const createNewSession = async (initialMessage?: string) => {
    if (!isAuthReady || !currentUser.id) return null;
    try {
      const sessionRef = await addDoc(collection(db, 'chat_sessions'), {
        userId: currentUser.id,
        title: initialMessage ? 'New Session' : 'Empty Session',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveSessionId(sessionRef.id);
      return sessionRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chat_sessions');
      return null;
    }
  };

  useEffect(() => {
    if (ws && isAuthReady) {
      ws.send(JSON.stringify({
        type: 'UPDATE_STATE',
        state: { projectId, activeTerminalLogs }
      }));
    }
  }, [projectId, activeTerminalLogs, ws, isAuthReady]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    let sessionId = activeSessionId;
    if (!sessionId && currentUser.id) {
      sessionId = await createNewSession(input);
    }

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      // Save user message to Firestore if logged in
      if (sessionId && currentUser.id) {
        const userMsgWithContext = { ...userMsg, userId: currentUser.id, sessionId: sessionId };
        await addDoc(collection(db, `chat_sessions/${sessionId}/messages`), userMsgWithContext)
          .catch(err => handleFirestoreError(err, OperationType.CREATE, `chat_sessions/${sessionId}/messages`));
        
        await updateDoc(doc(db, 'chat_sessions', sessionId), { 
          updatedAt: serverTimestamp() 
        })
          .catch(err => handleFirestoreError(err, OperationType.UPDATE, `chat_sessions/${sessionId}`));
      }

      const response = await chatWithADDB(input, updatedMessages, botBehavior);
      
      if ((response as any).requiresKeySelection) {
        setIsTyping(false);
        const modelMsg: ChatMessage = { 
          role: 'model', 
          content: response.text || "Please select an API key to continue.", 
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          sessionId: sessionId
        };
        setMessages(prev => [...prev, modelMsg]);
        return;
      }

      let modelContent = response.text || "I'm not sure how to respond to that.";
      
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'getDeploymentStatus') {
            const res = await fetch('/api/deployments');
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              modelContent += `\n\n[SYSTEM_UPDATE] Current status: Found ${data.length} recent deployments. Latest is ${data[0].id} (${data[0].status}) in ${data[0].env}.`;
            } else {
              modelContent += `\n\n[SYSTEM_UPDATE] No recent deployments found in the current project.`;
            }
          } else if (call.name === 'triggerDeployment') {
            const { env, version } = call.args as any;
            const res = await fetch('/api/deploy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ env, version })
            });
            const data = await res.json();
            if (data && data.id) {
              modelContent += `\n\n[SYSTEM_UPDATE] Deployment triggered: ${data.id} to ${data.env} (version ${data.version}). Monitoring progress...`;
            } else {
              modelContent += `\n\n[SYSTEM_UPDATE] Failed to trigger deployment: ${data.message || data.error || 'Unknown error'}`;
            }
            fetchDeployments();
          } else if (call.name === 'switchProject') {
            const { projectId: newProjectId } = call.args as any;
            setProjectId(newProjectId);
            modelContent += `\n\n[SYSTEM_UPDATE] Switched active project context to: ${newProjectId}. Refreshing data...`;
            fetchInitData();
          } else if (call.name === 'switchCloudProvider') {
            const { providerId } = call.args as any;
            const provider = CLOUD_PROVIDERS.find(p => p.id === providerId);
            if (provider) {
              setCloudProvider(provider);
              modelContent += `\n\n[SYSTEM_UPDATE] Switched active cloud provider to: ${provider.name}.`;
            }
          }
        }
      }

      const modelMsg: ChatMessage = { 
        role: 'model', 
        content: modelContent, 
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        sessionId: sessionId || undefined
      };
      setMessages(prev => [...prev, modelMsg]);
      
      // Save model message to Firestore if logged in
      if (sessionId && currentUser.id) {
        await addDoc(collection(db, `chat_sessions/${sessionId}/messages`), modelMsg)
          .catch(err => handleFirestoreError(err, OperationType.CREATE, `chat_sessions/${sessionId}/messages`));

        // Auto-summarize if it's the first exchange
        if (messages.length <= 2) {
          const summaryResponse = await chatWithADDB(`Summarize this session in exactly 4 words: "${input}"`, []);
          const summary = summaryResponse.text?.replace(/[".]/g, '') || 'New Chat Session';
          await updateDoc(doc(db, 'chat_sessions', sessionId), { 
            title: summary,
            updatedAt: serverTimestamp()
          })
            .catch(err => handleFirestoreError(err, OperationType.UPDATE, `chat_sessions/${sessionId}`));
        }
      }

    } catch (err) {
      console.error('Chat Error:', err);
      setMessages(prev => [...prev, { role: 'model', content: 'Error: Connection to ADDB core lost.', timestamp: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const statsData: DeploymentStats[] = [
    { date: '03/24', success: 12, failed: 1 },
    { date: '03/25', success: 15, failed: 0 },
    { date: '03/26', success: 8, failed: 2 },
    { date: '03/27', success: 18, failed: 1 },
    { date: '03/28', success: 22, failed: 0 },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#F27D26] animate-spin" />
          <div className="text-[10px] font-bold tracking-widest text-[#626269] uppercase animate-pulse">Initializing_Secure_Session...</div>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Accents */}
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F27D26] rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg p-10 space-y-8 shadow-2xl relative z-10"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-[#F27D26] rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(242,125,38,0.3)]">
                <Cpu className="w-10 h-10 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tighter text-white mb-1">ADDB_CORE_ACCESS</h1>
                <p className="text-[10px] font-bold text-[#626269] tracking-[0.2em] uppercase">Autonomous Deployment & Defense Bridge</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-[#1C1C1F]/50 border border-[#323236] rounded text-[10px] text-[#A1A1A6] leading-relaxed italic">
                "System access requires biometric or cryptographic verification. Please authenticate via your authorized Google identity to establish a secure bridge."
              </div>

              <button 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="w-full py-4 bg-[#F27D26] text-black font-bold text-xs tracking-widest rounded hover:bg-[#E16D16] transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(242,125,38,0.2)]"
              >
                <ShieldCheck className="w-5 h-5" />
                AUTHENTICATE_WITH_GOOGLE
              </button>
            </div>

            <div className="pt-6 border-t border-[#1C1C1F] flex justify-between items-center text-[8px] text-[#323236] font-bold tracking-widest">
              <span>SECURE_SESSION_V1.0</span>
              <span>ENCRYPTION_ACTIVE</span>
            </div>
          </motion.div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0A0A0B] text-[#E1E1E6] font-mono selection:bg-[#F27D26] selection:text-black">
      {updateProgress !== null && <SystemUpdateOverlay progress={updateProgress} version={systemVersion} />}
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-[#1C1C1F] bg-[#0D0D0E] flex flex-col z-20">
        <div className="p-6 flex items-center gap-3 border-b border-[#1C1C1F]">
          <div className="w-8 h-8 bg-[#F27D26] rounded flex items-center justify-center">
            <Cpu className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-bold tracking-tighter text-lg">ADDB {systemVersion}</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="DASHBOARD"
          />
          <NavItem 
            active={activeTab === 'architecture'} 
            onClick={() => setActiveTab('architecture')}
            icon={<Activity className="w-4 h-4" />}
            label="ARCHITECTURE"
          />
          <NavItem 
            active={activeTab === 'chat'} 
            onClick={() => {
              if (currentUser.role === 'APPROVER') return;
              setActiveTab('chat');
            }}
            icon={<Terminal className="w-4 h-4" />}
            label="AGENT CHAT"
            restricted={currentUser.role === 'APPROVER'}
          />
          <NavItem 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History className="w-4 h-4" />}
            label="DEPLOY LOGS"
          />
          <NavItem 
            active={activeTab === 'repos'} 
            onClick={() => {
              if (currentUser.role === 'APPROVER' || currentUser.role === 'CLOUD_ENGINEER') return;
              setActiveTab('repos');
            }}
            icon={<Server className="w-4 h-4" />}
            label="REPOSITORIES"
            restricted={currentUser.role === 'APPROVER' || currentUser.role === 'CLOUD_ENGINEER'}
          />
          
          {(currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'APPROVER') && (
            <NavItem 
              active={activeTab === 'team'} 
              onClick={() => {
                if (currentUser.role !== 'SYSTEM_ADMIN') return;
                setActiveTab('team');
              }}
              icon={<Users className="w-4 h-4" />}
              label="TEAM"
              restricted={currentUser.role !== 'SYSTEM_ADMIN'}
            />
          )}

          {(currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'APPROVER') && (
            <NavItem 
              active={activeTab === 'audit'} 
              onClick={() => setActiveTab('audit')}
              icon={<FileText className="w-4 h-4" />}
              label="AUDIT LOGS"
            />
          )}

          {currentUser.role === 'SYSTEM_ADMIN' && (
            <>
              <NavItem 
                active={activeTab === 'governance'} 
                onClick={() => setActiveTab('governance')}
                icon={<Scale className="w-4 h-4" />}
                label="GOVERNANCE"
              />
              <NavItem 
                active={activeTab === 'cost-intel'} 
                onClick={() => setActiveTab('cost-intel')}
                icon={<DollarSign className="w-4 h-4" />}
                label="COST INTEL"
              />
            </>
          )}

          {currentUser.role === 'SYSTEM_ADMIN' && (
            <NavItem 
              active={activeTab === 'evolution'} 
              onClick={() => setActiveTab('evolution')}
              icon={<Zap className="w-4 h-4" />}
              label="SYSTEM EVOLUTION"
            />
          )}
          
          <NavItem 
            active={activeTab === 'help'} 
            onClick={() => setActiveTab('help')}
            icon={<HelpCircle className="w-4 h-4" />}
            label="HELP & DOCS"
          />

          <NavItem 
            active={activeTab === 'whats-new'} 
            onClick={() => setActiveTab('whats-new')}
            icon={<Activity className="w-4 h-4" />}
            label="WHAT'S NEW"
          />
          
          {!currentUser.email && (
            <div className="px-4 py-6 mt-4 border-t border-[#1C1C1F]">
              <button 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F27D26] text-black text-[10px] font-bold tracking-widest rounded hover:bg-[#E16D16] transition-all shadow-[0_0_15px_rgba(242,125,38,0.2)]"
              >
                <Lock className="w-3.5 h-3.5" />
                AUTHENTICATE_SYSTEM
              </button>
              <p className="text-[8px] text-[#626269] mt-2 text-center uppercase tracking-tighter">Admin access requires identity verification</p>
            </div>
          )}
          
          {currentUser.role === 'SYSTEM_ADMIN' && (
              <button 
                onClick={() => setIsOnboardingOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[#F27D26]/30 text-[#F27D26] text-[10px] font-bold tracking-widest rounded hover:bg-[#F27D26]/10 transition-all"
              >
                <Activity className="w-3 h-3" />
                CLIENT ONBOARDING
              </button>
            )}
          </nav>

        <div className="p-6 border-t border-[#1C1C1F] text-[10px] text-[#626269] space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            CORE SYSTEM ACTIVE
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            ENCRYPTED SESSION
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64 min-h-screen">
        <header className="h-16 border-b border-[#1C1C1F] bg-[#0D0D0E]/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-[#626269]">PATH:</span>
              <span className="text-[#F27D26]">root/addb/{activeTab}</span>
            </div>
            
            <div className="h-4 w-[1px] bg-[#1C1C1F]" />
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-[#050505] border border-[#1C1C1F] rounded-full">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  systemStatus === 'RUNNING' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                  systemStatus === 'STOPPED' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                  "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                )} />
                <span className="text-[9px] font-bold tracking-widest text-[#626269] uppercase">{systemStatus}</span>
              </div>

              {(currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'CLOUD_ENGINEER') && (
                <select 
                  value={cloudProvider.id}
                  onChange={(e) => setCloudProvider(CLOUD_PROVIDERS.find(p => p.id === e.target.value)!)}
                  className="bg-transparent text-[10px] font-bold text-[#E1E1E6] border-none focus:ring-0 cursor-pointer hover:text-[#F27D26] transition-colors"
                >
                  {CLOUD_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0D0D0E]">{p.icon} {p.name.toUpperCase()}</option>
                  ))}
                </select>
              )}
              
              <div className="flex items-center gap-2 bg-[#1C1C1F] px-2 py-1 rounded border border-[#323236]">
                <span className="text-[9px] text-[#626269]">TENANT:</span>
                <input 
                  type="text" 
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="bg-transparent text-[10px] font-bold text-[#F27D26] border-none p-0 focus:ring-0 w-24"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "p-2 text-[#626269] hover:text-[#F27D26] transition-colors relative",
                  notifications.some(n => !n.read && n.severity === 'MAJOR') && "animate-pulse text-[#F27D26]"
                )}
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0D0D0E]" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-[#1C1C1F] bg-[#1C1C1F]/30 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest text-[#626269]">GLOBAL ALERT CENTER</span>
                      <span className="text-[9px] text-[#323236]">{notifications.length} TOTAL</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-[10px] text-[#323236] italic">No notifications</div>
                      ) : (
                        notifications.slice(0, 10).map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => markNotificationRead(n.id)}
                            className={cn(
                              "p-4 border-b border-[#1C1C1F] hover:bg-[#1C1C1F]/20 cursor-pointer transition-colors",
                              !n.read && "bg-[#F27D26]/5"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1.5",
                                n.severity === 'MAJOR' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                                n.type === 'DEPLOYMENT_SUCCESS' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                                "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                              )} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-[10px] font-bold text-[#E1E1E6]">{n.title}</div>
                                  <span className="text-[8px] text-[#323236]">{new Date(n.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-[10px] text-[#626269] leading-tight mb-2">{n.message}</p>
                                 {n.type === 'APPROVAL_REQUEST' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const approval = approvals.find(a => a.deploymentId === n.message.match(/DEP-\d+/)?.[0]);
                                      if (approval && approval.status === 'PENDING') setSelectedApproval(approval);
                                    }}
                                    className={cn(
                                      "text-[8px] font-bold transition-all",
                                      approvals.find(a => a.deploymentId === n.message.match(/DEP-\d+/)?.[0])?.status === 'APPROVED'
                                        ? "text-green-500 cursor-default"
                                        : "text-[#F27D26] hover:underline"
                                    )}
                                  >
                                    {approvals.find(a => a.deploymentId === n.message.match(/DEP-\d+/)?.[0])?.status === 'APPROVED' 
                                      ? 'APPROVED' 
                                      : 'VIEW_PLAN'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* System Intelligence Widget */}
            {currentUser.role === 'SYSTEM_ADMIN' && (
              <div className="relative">
                <button 
                  onClick={() => setIsSystemIntelOpen(!isSystemIntelOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F27D26]/10 border border-[#F27D26]/30 rounded hover:bg-[#F27D26]/20 transition-all group"
                >
                  <div className="relative">
                    <Cpu className="w-3.5 h-3.5 text-[#F27D26]" />
                    {systemSuggestions.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-[#F27D26]">SYSTEM_INTEL</span>
                </button>

                <AnimatePresence>
                  {isSystemIntelOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl p-4 z-50"
                    >
                      <div className="text-[10px] font-bold text-[#626269] mb-3 tracking-widest uppercase">Infrastructure Evolution</div>
                      <div className="space-y-3">
                        {systemSuggestions.length === 0 ? (
                          <div className="text-[10px] text-[#323236] italic">No evolution suggestions available.</div>
                        ) : (
                          systemSuggestions.map(s => (
                            <div key={s.id} className="p-2 border border-[#1C1C1F] rounded bg-[#050505] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#E1E1E6]">{s.title}</span>
                                <span className={cn(
                                  "text-[8px] px-1 rounded",
                                  s.impact === 'high' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                                )}>{s.impact.toUpperCase()}</span>
                              </div>
                              <p className="text-[9px] text-[#626269] leading-relaxed">{s.description}</p>
                              <button 
                                onClick={() => applySystemEvolution(s.id)}
                                className="w-full py-1 bg-[#F27D26] text-black text-[9px] font-bold rounded hover:bg-[#E16D16] transition-colors"
                              >
                                APPLY CHANGE
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center gap-6 text-[10px] text-[#626269]">
              <div className="flex flex-col items-end">
                <span>LATENCY</span>
                <span className="text-[#E1E1E6]">12ms</span>
              </div>
              <div className="flex flex-col items-end">
                <span>UPTIME</span>
                <span className="text-[#E1E1E6]">99.98%</span>
              </div>
              
              <div className="h-8 w-[1px] bg-[#1C1C1F] mx-2" />

              {currentUser.email ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-[#E1E1E6] uppercase tracking-tighter">{currentUser.name}</span>
                    <span className="text-[8px] text-[#F27D26] font-mono">{currentUser.role}</span>
                  </div>
                  <button 
                    onClick={() => auth.signOut()}
                    className="p-2 bg-[#1C1C1F] border border-[#323236] rounded hover:bg-red-500/10 hover:text-red-500 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F27D26] text-black text-[10px] font-bold rounded hover:bg-[#E16D16] transition-all"
                >
                  <Lock className="w-3 h-3" />
                  SIGN_IN
                </button>
              )}
            </div>
          </div>
        </header>

        {(isSandbox || isPlaceholder) && (
          <div className="bg-amber-950/30 border-b border-amber-500/30 px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-[10px] text-amber-200/80 font-medium uppercase tracking-widest">
                {isSandbox ? `WARNING: Currently using AI Studio Sandbox Project (${projectId}).` : `WARNING: Using placeholder Project ID (${projectId}).`}
                <span className="text-amber-500 ml-2 italic">Discovery of your actual GCP resources is disabled.</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[9px] text-amber-500/70">To fix: Set <code className="bg-black/40 px-1 rounded text-amber-400">GCP_PROJECT_ID</code> in AI Studio Secrets</span>
              <button 
                onClick={() => setIsOnboardingOpen(true)}
                className="text-[9px] font-bold text-amber-500 hover:text-amber-400 underline uppercase tracking-tighter"
              >
                Onboarding Guide
              </button>
            </div>
          </div>
        )}

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard label="ACTIVE NODES" value={architectureData.nodes.length.toString()} sub="All healthy" />
                  <StatCard label="TOTAL DEPLOYS" value={deployments.length.toString()} sub="Last 24h" />
                  <StatCard label="SUCCESS RATE" value="98.2%" sub="+2.1% from prev" />
                  <div className="bg-[#0D0D0E] border border-[#F27D26]/20 rounded-lg p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold tracking-widest text-[#626269]">DAILY_FIX_SUMMARY</span>
                      <ShieldCheck className="w-4 h-4 text-[#F27D26]" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#E1E1E6]">ISSUES FOUND</span>
                        <span className="text-xs font-bold text-red-500">08</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#E1E1E6]">AUTO-FIXES</span>
                        <span className="text-xs font-bold text-green-500">08</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#1C1C1F] text-[8px] text-[#626269] flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                      SYSTEM INTEGRITY: 100%
                    </div>
                  </div>
                </div>

                {/* Autonomous Testing Guide */}
                <div className="bg-[#F27D26]/5 border border-[#F27D26]/20 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Cpu className="w-5 h-5 text-[#F27D26]" />
                    <h3 className="text-xs font-bold tracking-widest text-[#E1E1E6]">AUTONOMOUS_TESTING_GUIDE</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-[#F27D26]">STEP 1: ENABLE MODE</div>
                      <p className="text-[10px] text-[#626269] leading-relaxed">
                        Navigate to the <span className="text-[#E1E1E6]">SYSTEM EVOLUTION</span> tab and set Bot Behavior to <span className="text-[#F27D26]">AUTONOMOUS</span>.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-[#F27D26]">STEP 2: TRIGGER EVOLUTION</div>
                      <p className="text-[10px] text-[#626269] leading-relaxed">
                        Click <span className="text-[#00FF00]">TRIGGER_EVOLUTION</span> in the Evolution tab. The bot will analyze and apply all pending suggestions automatically.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-[#F27D26]">STEP 3: OBSERVE METRICS</div>
                      <p className="text-[10px] text-[#626269] leading-relaxed">
                        A new <span className="text-[#00FF00]">AUTONOMOUS_EVOLUTION_METRICS</span> section will appear on the dashboard showing applied upgrades and their effectiveness.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Autonomous Evolution Metrics */}
                <AnimatePresence>
                  {appliedSuggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg p-6"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Zap className="w-5 h-5 text-[#00FF00]" />
                          <h3 className="text-xs font-bold tracking-widest text-[#E1E1E6]">AUTONOMOUS_EVOLUTION_METRICS</h3>
                        </div>
                        <div className="px-2 py-1 rounded bg-[#00FF00]/10 border border-[#00FF00]/20 text-[9px] font-bold text-[#00FF00] uppercase">
                          {appliedSuggestions.length} UPGRADES APPLIED
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appliedSuggestions.slice(0, 6).map((item, idx) => (
                          <div key={idx} className="bg-[#050505] border border-[#1C1C1F] p-4 rounded-lg group hover:border-[#00FF00]/30 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[9px] font-bold text-[#626269] uppercase">{item.suggestion.category || 'SYSTEM'}</div>
                              <div className="text-[8px] text-[#626269]">{new Date(item.timestamp).toLocaleTimeString()}</div>
                            </div>
                            <div className="text-[11px] font-bold text-[#E1E1E6] mb-1 group-hover:text-[#00FF00] transition-colors">{item.suggestion.title}</div>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1C1C1F]">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-pulse" />
                              <div className="text-[10px] font-bold text-[#00FF00] uppercase tracking-tighter">{item.effectiveness}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Infrastructure Map */}
                <InfrastructureMap nodes={infraMap.nodes} edges={infraMap.edges} />

                {/* System Logs & Stats */}
                <div className="space-y-6">
                  <GcpSetupCard projectId={projectId} serviceAccount={serviceAccount} logs={systemLogs} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <SystemLogs logs={systemLogs} />
                    </div>
                    <div className="space-y-6">
                      <SimplifiedStatusFeed deployments={deployments} />
                    </div>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg p-6">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-bold tracking-widest text-[#626269]">DEPLOYMENT VELOCITY</h3>
                    <div className="flex gap-4 text-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                        SUCCESS
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#FF4444]" />
                        FAILED
                      </div>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={statsData}>
                        <defs>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F27D26" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1C1C1F" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#626269" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#626269" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0D0D0E', border: '1px solid #1C1C1F', fontSize: '10px' }}
                          itemStyle={{ color: '#E1E1E6' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="success" 
                          stroke="#F27D26" 
                          fillOpacity={1} 
                          fill="url(#colorSuccess)" 
                          strokeWidth={2}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="failed" 
                          stroke="#FF4444" 
                          fill="transparent" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <DeploymentHistory deployments={deployments} />

                {/* Recent Activity */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269] flex items-center">
                    LIVE PIPELINE STATUS
                    <FeatureTooltip title="Terminal" description="Real-time log stream and deployment pipeline status monitoring." />
                  </h3>
                  <div className="space-y-2">
                    {deployments.slice(0, 5).map((dep) => (
                      <div key={dep.id} className="bg-[#0D0D0E] border border-[#1C1C1F] p-4 flex items-center justify-between hover:border-[#F27D26]/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <StatusIcon status={dep.status} />
                          <div>
                            <div className="text-xs font-bold">{dep.id} <span className="text-[#626269] font-normal ml-2">{dep.version}</span></div>
                            <div className="text-[10px] text-[#626269] uppercase">{dep.env} • {new Date(dep.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[#F27D26]">{dep.duration}</div>
                          <div className="text-[10px] text-[#626269] uppercase">DURATION</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'repos' && currentUser.role !== 'CLOUD_ENGINEER' && (
              <motion.div 
                key="repos"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269] flex items-center">
                    UNIVERSAL REPOSITORY CONTROL
                    <FeatureTooltip 
                      title="Repositories" 
                      description="Manage connected source code repositories and view source intelligence." 
                      restricted={currentUser.role === 'APPROVER'}
                    />
                  </h3>
                  <div className="text-[10px] text-[#626269]">CONNECTED: {repositories.length}</div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {repositories.map(repo => (
                    <div key={repo.id} className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg hover:border-[#F27D26]/50 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#1C1C1F] rounded flex items-center justify-center">
                            <Server className="w-5 h-5 text-[#626269] group-hover:text-[#F27D26] transition-colors" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#E1E1E6]">{repo.name}</div>
                            <div className="text-[10px] text-[#626269] uppercase">{repo.platform} • {repo.url}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[#F27D26]">SOURCE_INTELLIGENCE</div>
                          <div className="text-[9px] text-[#626269]">LAST_SCAN: {new Date(repo.intelligence.lastScan).toLocaleTimeString()}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#1C1C1F]">
                        <div>
                          <div className="text-[9px] font-bold text-[#323236] mb-2 uppercase tracking-widest">Tech Stack</div>
                          <div className="flex flex-wrap gap-2">
                            {repo.intelligence.techStack.map(tech => (
                              <span key={tech} className="px-2 py-0.5 bg-[#1C1C1F] text-[#E1E1E6] text-[9px] rounded border border-[#323236]">{tech}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-[#323236] mb-2 uppercase tracking-widest">Vulnerabilities</div>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "text-sm font-bold",
                              repo.intelligence.vulnerabilities > 0 ? "text-red-500" : "text-green-500"
                            )}>
                              {repo.intelligence.vulnerabilities} DETECTED
                            </div>
                            {repo.intelligence.vulnerabilities > 0 && (
                              <ShieldCheck className="w-4 h-4 text-red-500 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full py-4 border border-dashed border-[#1C1C1F] text-[#626269] text-[10px] font-bold tracking-widest rounded hover:border-[#F27D26]/50 hover:text-[#F27D26] transition-all">
                  + CONNECT NEW REPOSITORY
                </button>
              </motion.div>
            )}

            {activeTab === 'audit' && (currentUser.role === 'SYSTEM_ADMIN' || currentUser.role === 'APPROVER') && (
              <motion.div 
                key="audit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AuditLogsView logs={auditLogs} />
              </motion.div>
            )}
            {activeTab === 'architecture' && (
              <motion.div 
                key="architecture"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269] flex items-center">
                    INFRASTRUCTURE ARCHITECTURE DISCOVERY
                    <FeatureTooltip title="Architecture" description="Visual representation of cloud infrastructure nodes and their relationships." />
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex bg-[#0D0D0E] border border-[#1C1C1F] rounded p-1">
                      <button 
                        onClick={() => setArchitectureViewMode('structured')}
                        className={cn(
                          "px-3 py-1 text-[9px] font-bold rounded transition-all",
                          architectureViewMode === 'structured' ? "bg-[#F27D26] text-white" : "text-[#626269] hover:text-[#E1E1E6]"
                        )}
                      >
                        STRUCTURED
                      </button>
                      <button 
                        onClick={() => setArchitectureViewMode('archetypes')}
                        className={cn(
                          "px-3 py-1 text-[9px] font-bold rounded transition-all",
                          architectureViewMode === 'archetypes' ? "bg-[#F27D26] text-white" : "text-[#626269] hover:text-[#E1E1E6]"
                        )}
                      >
                        ARCHETYPES
                      </button>
                      <button 
                        onClick={() => setArchitectureViewMode('graph')}
                        className={cn(
                          "px-3 py-1 text-[9px] font-bold rounded transition-all",
                          architectureViewMode === 'graph' ? "bg-[#F27D26] text-white" : "text-[#626269] hover:text-[#E1E1E6]"
                        )}
                      >
                        GRAPH
                      </button>
                    </div>
                    <div className="text-[10px] text-[#626269]">NODES: {architectureData.nodes.length} | LINKS: {architectureData.links.length}</div>
                  </div>
                </div>
                
                {architectureViewMode === 'graph' ? (
                  <ArchitectureGraph data={architectureData} onExport={exportArchitecture} />
                ) : architectureViewMode === 'archetypes' ? (
                  <ArchetypeArchitectureView />
                ) : (
                  <StructuredArchitectureView data={architectureData} />
                )}
                
                <div className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-6 mt-8",
                  architectureViewMode !== 'archetypes' && "hidden"
                )}>
                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#F27D26] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Deployment Archetype Strategy
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">01</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Zonal: Cost-Efficient</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Ideal for internal tools or batch processing where occasional downtime is acceptable. Minimizes inter-zonal egress costs.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">02</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Regional: High Availability</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Standard for production web apps. Protects against single-zone failures using Managed Instance Groups (MIGs) across 3 zones.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">03</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Multi-Regional: Disaster Recovery</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Critical for global services. Uses Spanner or Cloud Storage multi-region buckets for data consistency across continents.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#F27D26] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Advanced Connectivity Patterns
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">04</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Global: Edge Acceleration</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Uses Cloud CDN and Anycast IP to serve content from the nearest Google Edge location, reducing latency to less than 30ms globally.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">05</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Hybrid: Secure Extension</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Extends on-prem networks into GCP using Dedicated Interconnect (10/100 Gbps) for low-latency private database access.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">06</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Multicloud: Anthos Orchestration</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Unified management of GKE clusters across GCP, AWS, and Azure. Enforces consistent security and config policies via GitOps.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-6 mt-8",
                  architectureViewMode === 'archetypes' && "hidden"
                )}>
                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#F27D26] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Standard Cloud Architecture Design
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">01</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Edge & Ingress Layer</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Global HTTPS Load Balancing with Cloud Armor WAF protection. SSL termination occurs at the edge, routing traffic to regional backends based on proximity and health.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">02</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Compute & Orchestration</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Hybrid compute model using GKE for stateful/complex workloads and Cloud Run for serverless microservices. Auto-scaling is driven by real-time request demand and CPU utilization.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#626269]">03</span>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-[#E1E1E6] mb-1">Data Persistence Tier</div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">
                            Cloud SQL provides managed relational storage with High Availability (HA) failover. Cloud Storage handles unstructured assets with lifecycle policies for cost optimization.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      System Flow & Integration
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-[#050505] border border-[#1C1C1F] rounded">
                        <div className="text-[9px] font-bold text-[#626269] uppercase mb-2">Event-Driven Pipeline</div>
                        <div className="flex items-center gap-3">
                          <div className="text-[10px] text-[#E1E1E6]">Pub/Sub</div>
                          <ArrowRight className="w-3 h-3 text-[#626269]" />
                          <div className="text-[10px] text-[#E1E1E6]">Cloud Functions</div>
                          <ArrowRight className="w-3 h-3 text-[#626269]" />
                          <div className="text-[10px] text-[#E1E1E6]">BigQuery</div>
                        </div>
                        <p className="text-[9px] text-[#626269] mt-2 italic">Real-time telemetry ingestion and analytical processing flow.</p>
                      </div>
                      <div className="p-4 bg-[#050505] border border-[#1C1C1F] rounded">
                        <div className="text-[9px] font-bold text-[#626269] uppercase mb-2">CI/CD Deployment Flow</div>
                        <div className="flex items-center gap-3">
                          <div className="text-[10px] text-[#E1E1E6]">GitHub</div>
                          <ArrowRight className="w-3 h-3 text-[#626269]" />
                          <div className="text-[10px] text-[#E1E1E6]">Cloud Build</div>
                          <ArrowRight className="w-3 h-3 text-[#626269]" />
                          <div className="text-[10px] text-[#E1E1E6]">Artifact Registry</div>
                        </div>
                        <p className="text-[9px] text-[#626269] mt-2 italic">Automated containerization and deployment to production clusters.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-[#0D0D0E] border border-[#1C1C1F] rounded">
                    <div className="text-[9px] font-bold text-[#626269] uppercase mb-2">Discovery Source</div>
                    <div className="text-xs font-bold text-[#E1E1E6]">Terraform + K8s YAML</div>
                  </div>
                  <div className="p-4 bg-[#0D0D0E] border border-[#1C1C1F] rounded">
                    <div className="text-[9px] font-bold text-[#626269] uppercase mb-2">Mapping Status</div>
                    <div className="text-xs font-bold text-green-500">SYNCHRONIZED</div>
                  </div>
                  <div className="p-4 bg-[#0D0D0E] border border-[#1C1C1F] rounded">
                    <div className="text-[9px] font-bold text-[#626269] uppercase mb-2">Live Telemetry</div>
                    <div className="text-xs font-bold text-[#F27D26]">ACTIVE_STREAM</div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'chat' && currentUser.role !== 'CLOUD_ENGINEER' && currentUser.role !== 'APPROVER' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[calc(100vh-12rem)] flex bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden"
              >
                <HistorySidebar 
                  sessions={chatSessions}
                  activeId={activeSessionId}
                  onSelect={setActiveSessionId}
                  onNewChat={() => {
                    setActiveSessionId(null);
                    setMessages([{ role: 'model', content: 'ADDB System Online. Awaiting instructions.', timestamp: new Date().toISOString() }]);
                  }}
                  isOpen={isHistorySidebarOpen}
                  onToggle={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
                />

                <div className="flex-1 flex flex-col min-w-0">
                  <div className="p-4 border-b border-[#1C1C1F] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
                        className="p-1 text-[#626269] hover:text-[#F27D26] transition-colors"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                      <span className="text-[10px] font-bold tracking-widest flex items-center">
                        ADDB AGENT INTERFACE
                        <FeatureTooltip title="Agent Chat" description="Interactive terminal for system commands and AI-assisted infrastructure management." />
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {typeof window !== 'undefined' && (window as any).aistudio && (
                        <button 
                          onClick={async () => {
                            try {
                              await (window as any).aistudio.openSelectKey();
                              window.location.reload();
                            } catch (err) {
                              console.error("Failed to open key selection:", err);
                            }
                          }}
                          className="flex items-center gap-1.5 text-[9px] font-bold text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded hover:bg-yellow-500/10 transition-all"
                          title="Select Gemini API Key"
                        >
                          <Zap className="w-3 h-3" />
                          SELECT_API_KEY
                        </button>
                      )}
                      
                      {isAuthReady ? (
                        <div className="flex items-center gap-3 pl-3 border-l border-[#1C1C1F]">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-[#E1E1E6] uppercase tracking-tighter">{currentUser.name}</span>
                            <span className="text-[8px] text-[#626269] tracking-widest">{currentUser.role}</span>
                          </div>
                          <button 
                            onClick={() => auth.signOut()}
                            className="p-1 text-[#626269] hover:text-red-500 transition-colors"
                            title="Sign Out"
                          >
                            <LogOut className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                          className="text-[9px] font-bold text-[#F27D26] border border-[#F27D26]/30 px-2 py-1 rounded hover:bg-[#F27D26]/10 flex items-center gap-1.5"
                        >
                          <Users className="w-3 h-3" />
                          SIGN_IN
                        </button>
                      )}
                      <span className="text-[10px] text-[#626269] hidden sm:inline">SECURE CHANNEL 01</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.role === 'user' ? "ml-auto items-end" : "items-start"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] text-[#626269] uppercase">
                          {msg.role === 'user' ? 'OPERATOR' : 'ADDB_CORE'}
                        </span>
                        <span className="text-[9px] text-[#323236]">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className={cn(
                        "px-4 py-3 text-xs leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-[#F27D26] text-black font-bold rounded-l-lg rounded-tr-lg" 
                          : "bg-[#1C1C1F] text-[#E1E1E6] rounded-r-lg rounded-tl-lg border border-[#323236]"
                      )}>
                        {msg.content}
                        {msg.role === 'model' && msg.content.includes('API key') && (
                          <div className="mt-3 pt-3 border-t border-[#323236]">
                            <button 
                              onClick={async () => {
                                try {
                                  await (window as any).aistudio.openSelectKey();
                                  window.location.reload();
                                } catch (err) {
                                  console.error("Failed to open key selection:", err);
                                }
                              }}
                              className="flex items-center gap-2 bg-[#F27D26] text-black px-3 py-1.5 rounded font-bold text-[10px] hover:bg-[#E16D16] transition-all"
                            >
                              <Zap className="w-3 h-3" />
                              RECONNECT ADDB CORE
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] text-[#626269] uppercase">ADDB_CORE</span>
                      </div>
                      <div className="bg-[#1C1C1F] px-4 py-3 rounded-r-lg rounded-tl-lg border border-[#323236]">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-[#F27D26] rounded-full animate-bounce" />
                          <div className="w-1 h-1 bg-[#F27D26] rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1 h-1 bg-[#F27D26] rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-[#1C1C1F] bg-[#0A0A0B]">
                  {!currentUser.id ? (
                    <div className="flex items-center justify-center py-4 bg-[#1C1C1F]/50 rounded border border-dashed border-[#323236]">
                      <button 
                        onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                        className="flex items-center gap-2 text-[10px] font-bold text-[#F27D26] hover:underline"
                      >
                        <Lock className="w-3 h-3" />
                        SIGN IN TO INTERACT WITH AGENT
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Enter command or query..."
                        className="w-full bg-[#1C1C1F] border border-[#323236] rounded-md py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-[#F27D26] transition-colors placeholder:text-[#323236]"
                      />
                      <button 
                        onClick={handleSend}
                        disabled={isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#626269] hover:text-[#F27D26] transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {currentUser.id && (
                    <div className="mt-2 flex gap-4">
                      <QuickCommand label="STATUS" onClick={() => setInput('What is the current deployment status?')} />
                      <QuickCommand label="DEPLOY STAGING" onClick={() => setInput('Deploy v1.2.5 to staging')} />
                      <QuickCommand label="HELP" onClick={() => setInput('What can you do?')} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269]">FULL DEPLOYMENT ARCHIVE</h3>
                  <div className="text-[10px] text-[#626269]">SHOWING {deployments.length} RECORDS</div>
                </div>
                
                {currentUser.role === 'APPROVER' ? (
                  <SimplifiedStatusFeed deployments={deployments} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1C1C1F] text-[10px] text-[#626269] uppercase tracking-widest">
                          <th className="pb-4 font-normal">ID</th>
                          <th className="pb-4 font-normal">ENVIRONMENT</th>
                          <th className="pb-4 font-normal">VERSION</th>
                          <th className="pb-4 font-normal">STATUS</th>
                          <th className="pb-4 font-normal">TIMESTAMP</th>
                          <th className="pb-4 font-normal">DURATION</th>
                          <th className="pb-4 font-normal text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {deployments.map((dep) => (
                          <tr key={dep.id} className="border-b border-[#1C1C1F]/50 hover:bg-[#1C1C1F]/20 transition-colors group">
                            <td className="py-4 font-bold text-[#F27D26]">{dep.id}</td>
                            <td className="py-4 uppercase">{dep.env}</td>
                            <td className="py-4 text-[#626269]">{dep.version}</td>
                            <td className="py-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase",
                                dep.status === 'success' ? "bg-green-500/10 text-green-500" : 
                                dep.status === 'failed' ? "bg-red-500/10 text-red-500" :
                                "bg-yellow-500/10 text-yellow-500"
                              )}>
                                {dep.status}
                              </span>
                            </td>
                            <td className="py-4 text-[#626269]">{new Date(dep.timestamp).toLocaleString()}</td>
                            <td className="py-4 text-[#626269]">{dep.duration}</td>
                            <td className="py-4 text-right">
                              <button 
                                onClick={() => setSelectedDeployment(dep)}
                                className="p-1.5 text-[#626269] hover:text-[#F27D26] hover:bg-[#1C1C1F] rounded transition-all"
                                title="View Logs"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Log Viewer Modal */}
                <AnimatePresence>
                  {selectedDeployment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl"
                      >
                        <div className="p-4 border-b border-[#1C1C1F] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                            <h3 className="text-xs font-bold tracking-widest">LOG_STREAM: {selectedDeployment.id}</h3>
                          </div>
                          <button 
                            onClick={() => setSelectedDeployment(null)}
                            className="p-1 text-[#626269] hover:text-[#E1E1E6] transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-[#050505] font-mono text-[11px] space-y-1">
                          <div className="text-[#626269] mb-4 border-b border-[#1C1C1F] pb-2">
                            <div>DEPLOYMENT_ID: {selectedDeployment.id}</div>
                            <div>ENVIRONMENT: {selectedDeployment.env.toUpperCase()}</div>
                            <div>VERSION: {selectedDeployment.version}</div>
                            <div>STATUS: {selectedDeployment.status.toUpperCase()}</div>
                            {isTerminalResumed && (
                              <div className="mt-2 text-green-500 font-bold animate-pulse">
                                [SYSTEM] APPROVAL RECEIVED. RESUMING EXECUTION...
                              </div>
                            )}
                            {selectedDeployment.status === 'pending-approval' && !isTerminalResumed && (
                              <div className="mt-4 p-4 border border-yellow-500/30 bg-yellow-500/5 rounded">
                                <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                                  <Lock className="w-4 h-4" />
                                  TERMINAL_LOCKED: PENDING_APPROVAL
                                </div>
                                <div className="text-[10px] text-yellow-500/70 mb-3">
                                  A major infrastructure change has been detected. Execution is paused until an Approver reviews the PLAN.md.
                                </div>
                                {currentUser.role === 'APPROVER' || currentUser.role === 'SYSTEM_ADMIN' ? (
                                  <button 
                                    onClick={() => {
                                      const approval = approvals.find(a => a.deploymentId === selectedDeployment.id);
                                      if (approval) setSelectedApproval(approval);
                                    }}
                                    className="px-4 py-2 bg-yellow-500 text-black text-[10px] font-bold rounded hover:bg-yellow-400"
                                  >
                                    REVIEW_PLAN_NOW
                                  </button>
                                ) : (
                                  <div className="text-[9px] text-[#626269] italic">
                                    Waiting for system administrator or authorized approver...
                                  </div>
                                )}
                              </div>
                            )}
                            {selectedDeployment.issueIdentified && (
                              <div className="mt-2 p-2 bg-[#F27D26]/10 border border-[#F27D26]/30 rounded">
                                <div className="text-[#F27D26] font-bold">AI_ANALYSIS:</div>
                                <div className="text-[#E1E1E6] mt-1">
                                  <span className="text-[#626269]">ISSUE:</span> {selectedDeployment.issueIdentified}
                                </div>
                                <div className="text-[#E1E1E6]">
                                  <span className="text-[#626269]">SUGGESTED_FIX:</span> {selectedDeployment.fixApplied}
                                </div>
                              </div>
                            )}
                            {selectedDeployment.error && !selectedDeployment.issueIdentified && (
                              <div className="text-red-500 mt-1">ERROR: {selectedDeployment.error}</div>
                            )}
                          </div>
                          
                          {selectedDeployment.logs?.map((log, i) => (
                            <div key={i} className={cn(
                              "py-0.5",
                              log.includes('[ERROR]') ? "text-red-400" : 
                              log.includes('[SUCCESS]') ? "text-green-400" : 
                              "text-[#A1A1A6]"
                            )}>
                              <span className="text-[#323236] mr-3">[{i.toString().padStart(3, '0')}]</span>
                              {log}
                            </div>
                          ))}
                          
                          {selectedDeployment.status === 'in-progress' && (
                            <div className="flex items-center gap-2 text-[#F27D26] animate-pulse mt-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              STREAMING_LIVE_LOGS...
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4 border-t border-[#1C1C1F] bg-[#0D0D0E] flex justify-between items-center">
                          {selectedDeployment.status === 'success' && (
                            <button 
                              onClick={() => {
                                const feedback = prompt("Please provide feedback for this [MAJOR] change:");
                                if (feedback) submitFeedback(selectedDeployment.id, feedback);
                              }}
                              className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-500 text-[10px] font-bold tracking-widest rounded hover:bg-blue-500/20 transition-all flex items-center gap-2"
                            >
                              <MessageSquare className="w-3 h-3" />
                              PROVIDE_FEEDBACK
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedDeployment(null)}
                            className="px-4 py-2 bg-[#1C1C1F] hover:bg-[#323236] text-[10px] font-bold tracking-widest rounded transition-colors ml-auto"
                          >
                            CLOSE_TERMINAL
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {activeTab === 'team' && currentUser.role === 'SYSTEM_ADMIN' && (
              <motion.div 
                key="team"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269]">STAKEHOLDER MANAGEMENT</h3>
                  <button 
                    onClick={() => setIsInviteModalOpen(true)}
                    className="px-4 py-2 bg-[#F27D26] text-black text-[10px] font-bold rounded hover:bg-[#E16D16] transition-colors flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    INVITE STAKEHOLDER
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {teamMembers.map(member => (
                    <div key={member.id} className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#1C1C1F] rounded-full flex items-center justify-center border border-[#323236]">
                          <Users className="w-5 h-5 text-[#626269]" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#E1E1E6]">{member.name}</div>
                          <div className="text-[10px] text-[#626269]">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[#F27D26]">ROLE</div>
                          <div className="text-[10px] text-[#E1E1E6]">{member.role}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[#626269]">SCOPE</div>
                          <div className="text-[10px] text-[#E1E1E6]">
                            {member.scope[0].tenantId === '*' ? 'GLOBAL' : member.scope[0].tenantId}
                          </div>
                        </div>
                        <button className="p-2 text-[#626269] hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'evolution' && currentUser.role === 'SYSTEM_ADMIN' && (
              <motion.div 
                key="evolution"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Double-Factor Validation Input */}
                <div className="p-6 bg-[#0D0D0E] border border-red-500/30 bg-red-500/5 rounded-lg shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-red-500" />
                    <h3 className="text-xs font-bold tracking-widest uppercase text-red-400">Double-Factor Validation Required</h3>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-4">
                    Enter the Admin Secret Key to authorize system lifecycle and evolution actions. This key is required for all sensitive operations.
                  </p>
                  <div className="flex gap-4">
                    <input
                      type="password"
                      placeholder="Enter Admin Secret Key..."
                      className="flex-1 bg-black border border-gray-800 rounded px-4 py-3 text-xs font-mono focus:border-red-500/50 outline-none text-white"
                      value={adminSecretKey}
                      onChange={(e) => setAdminSecretKey(e.target.value)}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />
                      SECURE_CHANNEL_ACTIVE
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Master Control Widget */}
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                        <h3 className="text-xs font-bold tracking-widest uppercase">Master Control Widget</h3>
                      </div>
                      <div className="text-[10px] text-[#626269] font-mono">SYSTEM_ADMIN_ONLY</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleSystemAction('START')}
                        disabled={systemStatus === 'RUNNING'}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1C1C1F] border border-[#323236] rounded hover:bg-green-500/10 hover:border-green-500/50 transition-all group disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold tracking-widest">START</span>
                      </button>
                      <button 
                        onClick={() => handleSystemAction('RESTART')}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1C1C1F] border border-[#323236] rounded hover:bg-blue-500/10 hover:border-blue-500/50 transition-all group"
                      >
                        <Loader2 className="w-6 h-6 text-blue-500 group-hover:rotate-180 transition-transform" />
                        <span className="text-[10px] font-bold tracking-widest">RESTART</span>
                      </button>
                      <button 
                        onClick={() => handleSystemAction('SHUTDOWN')}
                        disabled={systemStatus === 'STOPPED'}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1C1C1F] border border-[#323236] rounded hover:bg-red-500/10 hover:border-red-500/50 transition-all group disabled:opacity-50"
                      >
                        <XCircle className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold tracking-widest">SHUTDOWN</span>
                      </button>
                      <button 
                        onClick={() => handleSystemAction('SELF-UPDATE')}
                        disabled={systemStatus === 'UPDATING'}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-[#F27D26]/10 border border-[#F27D26]/30 rounded hover:bg-[#F27D26]/20 hover:border-[#F27D26] transition-all group disabled:opacity-50"
                      >
                        <Zap className="w-6 h-6 text-[#F27D26] group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold tracking-widest">SELF-UPDATE</span>
                      </button>
                    </div>
                    
                    <div className="mt-6 p-4 bg-[#050505] border border-[#1C1C1F] rounded font-mono text-[9px] text-[#626269] space-y-1">
                      <div>[SYSTEM] CURRENT_VERSION: {systemVersion}</div>
                      <div>[SYSTEM] STATUS: {systemStatus}</div>
                      <div>[SYSTEM] LAST_UPDATE: {releases[0]?.timestamp || 'NEVER'}</div>
                    </div>
                  </div>

                  {/* Security Audit & Leak Detection */}
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <h3 className="text-xs font-bold tracking-widest uppercase">Security Audit & Leak Detection</h3>
                      </div>
                      <div className="text-[10px] text-[#626269] font-mono">INTERNAL_SCANNER</div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded">
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          The ADDB Security Engine scans all connected repositories, environment variables, and build configurations for potential data leaks (API keys, secrets, PII).
                        </p>
                      </div>
                      <button 
                        onClick={runLeakScan}
                        className="w-full py-4 bg-[#1C1C1F] border border-yellow-500/30 text-yellow-500 text-[10px] font-bold tracking-widest rounded hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all flex items-center justify-center gap-3 group"
                      >
                        <ShieldAlert className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        RUN_LEAK_DETECTION_SCAN
                      </button>
                    </div>
                  </div>

                  {/* Ticket Queue */}
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h3 className="text-xs font-bold tracking-widest uppercase">Agentic Ticket Queue</h3>
                      </div>
                      <div className="text-[10px] text-[#626269] font-mono">OPEN_REQUESTS: {tickets.filter(t => t.status === 'OPEN').length}</div>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {tickets.map(ticket => (
                        <div key={ticket.id} className="p-4 bg-[#1C1C1F] border border-[#323236] rounded space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#F27D26]">{ticket.id}</span>
                            <span className={cn(
                              "text-[8px] px-2 py-0.5 rounded font-bold uppercase",
                              ticket.status === 'OPEN' ? "bg-blue-500/10 text-blue-500" :
                              ticket.status === 'IN_PROGRESS' ? "bg-yellow-500/10 text-yellow-500" :
                              "bg-green-500/10 text-green-500"
                            )}>{ticket.status}</span>
                          </div>
                          <p className="text-[11px] text-[#E1E1E6] italic leading-relaxed">"{ticket.userMessage}"</p>
                          <div className="flex items-center justify-between pt-2 border-t border-[#323236]">
                            <span className="text-[9px] text-[#626269]">{new Date(ticket.timestamp).toLocaleString()}</span>
                            <div className="flex gap-2">
                              {ticket.status === 'OPEN' && (
                                <button 
                                  onClick={() => proposeEvolution(ticket.id)}
                                  className="px-3 py-1 bg-[#F27D26] text-black text-[9px] font-bold rounded hover:bg-[#F27D26]/80 transition-all"
                                >
                                  PROPOSE EVOLUTION
                                </button>
                              )}
                              {ticket.status === 'IN_PROGRESS' && (
                                <button 
                                  onClick={() => resolveTicket(ticket.id)}
                                  className="px-3 py-1 bg-green-500 text-black text-[9px] font-bold rounded hover:bg-green-400 transition-all"
                                >
                                  RESOLVE & DEPLOY
                                </button>
                              )}
                            </div>
                          </div>
                          {ticket.evolutionProposal && (
                            <div className="mt-3 p-3 bg-[#050505] border border-blue-500/20 rounded font-mono text-[9px] text-blue-400/80 overflow-x-auto">
                              <pre>{ticket.evolutionProposal}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Feedback & Correction Loop */}
                <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <h3 className="text-xs font-bold tracking-widest uppercase">Feedback & Correction Loop</h3>
                    </div>
                    <div className="text-[10px] text-[#626269] font-mono">PENDING_CORRECTIONS: {feedbacks.length}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {feedbacks.map(feedback => (
                      <div key={feedback.id} className="p-4 bg-[#1C1C1F] border border-red-500/20 rounded space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-red-500">CORRECTION_PROPOSAL</span>
                          <span className="text-[9px] text-[#626269]">{feedback.deploymentId}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[9px] text-[#626269] uppercase font-bold">User Feedback:</div>
                          <p className="text-[11px] text-[#E1E1E6] italic">"{feedback.feedback}"</p>
                        </div>
                        <div className="pt-4 border-t border-[#323236] flex gap-2">
                          <button 
                            onClick={() => askBotToFix(feedback.id)}
                            className="flex-1 py-2 bg-red-500 text-black text-[10px] font-bold rounded hover:bg-red-400 transition-all flex items-center justify-center gap-2"
                          >
                            <Zap className="w-3 h-3" />
                            ASK BOT TO FIX
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-bold tracking-widest text-[#626269] flex items-center">
                    SYSTEM EVOLUTION & BOT CONTROL
                    <FeatureTooltip title="System Evolution" description="Configure autonomous bot behavior and apply infrastructure improvements." />
                  </h3>
                </div>

                <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-8 rounded-lg relative overflow-hidden">
                  {botBehavior === 'AUTONOMOUS' && (
                    <div className="absolute inset-0 bg-[#F27D26]/5 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center border border-[#F27D26]/30">
                      <div className="flex items-center gap-3 mb-2">
                        <Cpu className="w-8 h-8 text-[#F27D26] animate-pulse" />
                        <span className="text-sm font-bold text-[#F27D26] tracking-widest uppercase">Autonomous Mode Active</span>
                      </div>
                      <p className="text-[10px] text-[#626269] max-w-md text-center px-6">
                        The ADDB Autonomous Engine is currently managing system lifecycle, evolution, and self-correction. Manual overrides are restricted to prevent synchronization conflicts.
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-ping" />
                        <span className="text-[9px] font-mono text-[#00FF00]">BOT_IN_CONTROL: {new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#F27D26]/10 rounded flex items-center justify-center">
                        <Cpu className="w-6 h-6 text-[#F27D26]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#E1E1E6]">Bot Behavior Control</div>
                        <div className="text-[10px] text-[#626269] uppercase tracking-widest">Autonomous Operations Engine</div>
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      {botBehavior !== 'AUTONOMOUS' && (
                        <button 
                          disabled={isEvolving}
                          onClick={async () => {
                            console.log('[AUTONOMOUS] Manual evolution trigger...');
                            setEvolutionStatus('Generating suggestions...');
                            setIsEvolving(true);
                            try {
                              const suggestions = await generateSuggestions(architectureData.nodes, deployments, projectId);
                              if (suggestions && suggestions.length > 0) {
                                setEvolutionStatus(`Found ${suggestions.length} suggestions. Applying...`);
                                for (const suggestion of suggestions) {
                                  // Save to Firestore first
                                  await setDoc(doc(db, 'system_suggestions', suggestion.id), suggestion, { merge: true });
                                  await applySystemEvolution(suggestion.id, suggestion);
                                }
                              } else {
                                setEvolutionStatus('No new suggestions found.');
                                setTimeout(() => setEvolutionStatus(null), 3000);
                              }
                            } catch (err) {
                              console.error('[AUTONOMOUS] Manual evolution failed', err);
                              setEvolutionStatus('Evolution failed.');
                              setTimeout(() => setEvolutionStatus(null), 3000);
                            } finally {
                              setIsEvolving(false);
                            }
                          }}
                          className={cn(
                            "px-4 py-2 bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] text-[10px] font-bold tracking-widest rounded hover:bg-[#00FF00]/20 transition-all flex items-center gap-2",
                            isEvolving && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Zap className={cn("w-3.5 h-3.5", isEvolving && "animate-pulse")} />
                          {isEvolving ? 'EVOLVING...' : 'TRIGGER_EVOLUTION'}
                        </button>
                      )}
                      
                      {(evolutionStatus || botBehavior === 'AUTONOMOUS') && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[10px] font-mono text-[#00FF00] animate-pulse flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-ping" />
                          {botBehavior === 'AUTONOMOUS' ? (evolutionStatus || 'AUTONOMOUS_ENGINE_ACTIVE') : evolutionStatus}
                        </motion.div>
                      )}

                      {needsRelease && (
                        <motion.button 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setNeedsRelease(false);
                            setSystemVersion(`v1.1.${Math.floor(Math.random() * 100)}-evo`);
                            setMessages(prev => [...prev, {
                              role: 'model',
                              content: `System update released successfully. All autonomous improvements have been integrated into the production environment.`,
                              timestamp: new Date().toISOString()
                            }]);
                          }}
                          className="px-4 py-2 bg-[#F27D26] text-black text-[10px] font-bold tracking-widest rounded shadow-[0_0_15px_rgba(242,125,38,0.3)] flex items-center gap-2"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          RELEASE_UPDATE
                        </motion.button>
                      )}
                      <button 
                        onClick={async () => {
                          try {
                            const response = await safeFetch('/api/system/simulate-failure', { method: 'POST' });
                            if (response.success) {
                              // Notification will be broadcasted from backend
                            }
                          } catch (err) {
                            console.error("Failed to simulate failure", err);
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-bold tracking-widest rounded hover:bg-red-500/20 transition-all flex items-center gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        SIMULATE_FAILURE
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    {(['PASSIVE', 'ACTIVE', 'AUTONOMOUS'] as BotBehavior[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setBotBehavior(mode)}
                        className={cn(
                          "p-6 border rounded-lg transition-all text-left group",
                          botBehavior === mode 
                            ? "bg-[#F27D26]/10 border-[#F27D26] shadow-[0_0_20px_rgba(242,125,38,0.1)]" 
                            : "bg-[#050505] border-[#1C1C1F] hover:border-[#323236]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn(
                            "w-8 h-8 rounded flex items-center justify-center",
                            botBehavior === mode ? "bg-[#F27D26] text-black" : "bg-[#1C1C1F] text-[#626269]"
                          )}>
                            {mode === 'PASSIVE' ? <Eye className="w-4 h-4" /> : mode === 'ACTIVE' ? <Zap className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </div>
                          {botBehavior === mode && <CheckCircle2 className="w-4 h-4 text-[#F27D26]" />}
                        </div>
                        <div className={cn(
                          "text-xs font-bold mb-1",
                          botBehavior === mode ? "text-[#F27D26]" : "text-[#E1E1E6]"
                        )}>{mode}</div>
                        <p className="text-[9px] text-[#626269] leading-relaxed">
                          {mode === 'PASSIVE' && "Bot only monitors and alerts. No automated actions taken."}
                          {mode === 'ACTIVE' && "Bot auto-fixes [MINOR] issues but asks for [MAJOR] approval."}
                          {mode === 'AUTONOMOUS' && "Bot fixes all issues and logs them automatically."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#626269] tracking-widest uppercase mb-4">Pending Suggestions</h4>
                    <div className="space-y-4">
                      {systemSuggestions.map(s => (
                        <div key={s.id} className="p-4 bg-[#050505] border border-[#1C1C1F] rounded space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#E1E1E6]">{s.title}</span>
                            <span className={cn(
                              "text-[8px] px-1.5 py-0.5 rounded uppercase font-bold",
                              s.impact === 'high' ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                            )}>{s.impact} IMPACT</span>
                          </div>
                          <p className="text-[10px] text-[#626269] leading-relaxed">{s.description}</p>
                          <button 
                            onClick={() => applySystemEvolution(s.id)}
                            className="w-full py-2 bg-[#1C1C1F] hover:bg-[#F27D26] hover:text-black text-[10px] font-bold rounded transition-all"
                          >
                            APPLY_EVOLUTION_PATCH
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#626269] tracking-widest uppercase mb-4">System Restoration</h4>
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded mb-4">
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        Restore the core system to a previously stable version. This action will revert all evolution patches and system configurations.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {releases.slice(1, 4).map(release => (
                        <div key={release.id} className="flex items-center justify-between p-3 bg-[#050505] border border-[#1C1C1F] rounded group hover:border-red-500/30 transition-all">
                          <div className="flex items-center gap-3">
                            <History className="w-3.5 h-3.5 text-[#626269]" />
                            <div>
                              <div className="text-[10px] font-bold text-[#E1E1E6]">{release.version}</div>
                              <div className="text-[8px] text-[#323236]">{new Date(release.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to restore to version ${release.version}?`)) {
                                handleRestoreVersion(release.version);
                              }
                            }}
                            className="px-3 py-1 bg-red-500/10 text-red-500 text-[9px] font-bold rounded border border-red-500/30 hover:bg-red-500 hover:text-black transition-all"
                          >
                            RESTORE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg">
                    <h4 className="text-[10px] font-bold text-[#626269] tracking-widest uppercase mb-4">Evolution History</h4>
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between p-3 border-b border-[#1C1C1F] last:border-0">
                          <div className="flex items-center gap-3">
                            <Wrench className="w-3.5 h-3.5 text-green-500" />
                            <div>
                              <div className="text-[10px] font-bold text-[#E1E1E6]">PATCH_APPLIED_{i}</div>
                              <div className="text-[8px] text-[#323236]">2026-03-2{8-i} 14:22:01</div>
                            </div>
                          </div>
                          <span className="text-[9px] text-[#626269]">SUCCESS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-[#0D0D0E] border border-[#1C1C1F] p-8 rounded-lg">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-500/10 rounded flex items-center justify-center">
                      <GitBranch className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#E1E1E6]">Git Production Link</div>
                      <div className="text-[10px] text-[#626269] uppercase tracking-widest">Internal Git Handover Module</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Repository URL</label>
                        <input
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/user/repo.git"
                          className="w-full bg-[#050505] border border-[#1C1C1F] rounded p-3 text-xs text-[#E1E1E6] focus:border-[#F27D26] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Personal Access Token (PAT)</label>
                        <input
                          type="password"
                          value={pat}
                          onChange={(e) => setPat(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-[#050505] border border-[#1C1C1F] rounded p-3 text-xs text-[#E1E1E6] focus:border-[#F27D26] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Double-Factor Validation (ADMIN_SECRET_KEY)</label>
                        <input
                          type="password"
                          value={adminSecretKey}
                          onChange={(e) => setAdminSecretKey(e.target.value)}
                          placeholder="Enter Secret Key"
                          className="w-full bg-[#050505] border border-[#1C1C1F] rounded p-3 text-xs text-[#E1E1E6] focus:border-[#F27D26] outline-none transition-all"
                        />
                      </div>
                      <button
                        onClick={handleGitPush}
                        disabled={isPushing || !repoUrl || !pat || !adminSecretKey}
                        className={cn(
                          "w-full py-4 rounded font-bold tracking-widest text-xs transition-all flex items-center justify-center gap-3",
                          isPushing ? "bg-[#1C1C1F] text-[#626269]" : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                        )}
                      >
                        {isPushing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            INITIALIZING_HANDOVER...
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4" />
                            EXECUTE_PRODUCTION_PUSH_V1.0.0
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {pushStatus && (
                    <div className={cn(
                      "mt-6 p-4 rounded border flex items-center gap-3",
                      pushStatus.type === 'success' ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-red-500/10 border-red-500/30 text-red-500"
                    )}>
                      {pushStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest">{pushStatus.message}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'governance' && currentUser.role === 'SYSTEM_ADMIN' && (
              <motion.div 
                key="governance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Scale className="w-6 h-6 text-[#F27D26]" />
                    <h2 className="text-2xl font-bold tracking-tighter text-[#E1E1E6]">SYSTEM_GOVERNANCE</h2>
                  </div>
                  <div className="text-[10px] text-[#626269] font-mono tracking-widest uppercase">Policy Enforcement Engine v2.4</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                      <span className="text-[10px] font-bold text-green-500 uppercase">Active</span>
                    </div>
                    <h3 className="text-xs font-bold text-[#E1E1E6]">RBAC_ENFORCEMENT</h3>
                    <p className="text-[10px] text-[#626269] leading-relaxed">Strict role-based access control for all system resources and deployment triggers.</p>
                  </div>
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <Lock className="w-5 h-5 text-blue-500" />
                      <span className="text-[10px] font-bold text-blue-500 uppercase">Active</span>
                    </div>
                    <h3 className="text-xs font-bold text-[#E1E1E6]">SECRET_ROTATION</h3>
                    <p className="text-[10px] text-[#626269] leading-relaxed">Automated rotation of API keys and service account credentials every 30 days.</p>
                  </div>
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <Gavel className="w-5 h-5 text-yellow-500" />
                      <span className="text-[10px] font-bold text-yellow-500 uppercase">Monitoring</span>
                    </div>
                    <h3 className="text-xs font-bold text-[#E1E1E6]">COMPLIANCE_DRIFT</h3>
                    <p className="text-[10px] text-[#626269] leading-relaxed">Real-time detection of infrastructure changes that deviate from defined security policies.</p>
                  </div>
                </div>

                <div className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-[#1C1C1F] bg-[#1C1C1F]/30 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold tracking-widest uppercase">Active Governance Policies</h3>
                    <button className="text-[9px] font-bold text-[#F27D26] hover:underline">ADD_NEW_POLICY</button>
                  </div>
                  <div className="divide-y divide-[#1C1C1F]">
                    {governancePolicies.map(policy => (
                      <div key={policy.id} className="p-4 flex items-center justify-between hover:bg-[#1C1C1F]/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            policy.severity === 'CRITICAL' ? "bg-red-500" : policy.severity === 'HIGH' ? "bg-orange-500" : "bg-yellow-500"
                          )} />
                          <div>
                            <div className="text-xs font-bold text-[#E1E1E6]">{policy.name}</div>
                            <div className="text-[9px] text-[#626269]">{policy.id} • {policy.severity}</div>
                            <div className="text-[8px] text-[#323236] mt-0.5">{policy.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "text-[8px] px-2 py-0.5 rounded font-bold uppercase",
                            policy.status === 'ENFORCED' ? "bg-green-500/10 text-green-500" :
                            policy.status === 'BLOCKING' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                          )}>{policy.status}</span>
                          <button className="p-1 text-[#626269] hover:text-[#E1E1E6]">
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'cost-intel' && currentUser.role === 'SYSTEM_ADMIN' && (
              <motion.div 
                key="cost-intel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-green-500" />
                    <h2 className="text-2xl font-bold tracking-tighter text-[#E1E1E6]">COST_INTELLIGENCE</h2>
                  </div>
                  <div className="text-[10px] text-[#626269] font-mono tracking-widest uppercase">Cloud Spend Optimizer v1.1</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard label="MTD_SPEND" value="$12,450.00" sub="+12% trend up" />
                  <StatCard label="PROJECTED_EOY" value="$152,000.00" sub="-5% trend down" />
                  <StatCard label="IDLE_RESOURCES" value="42" sub="15% trend up" />
                  <StatCard label="POTENTIAL_SAVINGS" value="$3,200.00" sub="NEW trend up" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                    <h3 className="text-xs font-bold tracking-widest uppercase mb-6">Spend by Cloud Provider</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: 'Jan', gcp: 4000, aws: 2400, azure: 2400 },
                          { name: 'Feb', gcp: 3000, aws: 1398, azure: 2210 },
                          { name: 'Mar', gcp: 2000, aws: 9800, azure: 2290 },
                          { name: 'Apr', gcp: 2780, aws: 3908, azure: 2000 },
                          { name: 'May', gcp: 1890, aws: 4800, azure: 2181 },
                          { name: 'Jun', gcp: 2390, aws: 3800, azure: 2500 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1C1C1F" />
                          <XAxis dataKey="name" stroke="#626269" fontSize={10} />
                          <YAxis stroke="#626269" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0D0D0E', border: '1px solid #1C1C1F' }}
                            itemStyle={{ fontSize: '10px' }}
                          />
                          <Area type="monotone" dataKey="gcp" stackId="1" stroke="#4285F4" fill="#4285F4" fillOpacity={0.1} />
                          <Area type="monotone" dataKey="aws" stackId="1" stroke="#FF9900" fill="#FF9900" fillOpacity={0.1} />
                          <Area type="monotone" dataKey="azure" stackId="1" stroke="#0089D6" fill="#0089D6" fillOpacity={0.1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-2xl">
                    <h3 className="text-xs font-bold tracking-widest uppercase mb-6">Optimization Recommendations</h3>
                    <div className="space-y-4">
                      {costRecommendations.map((rec, i) => (
                        <div key={i} className="p-4 bg-[#050505] border border-[#1C1C1F] rounded flex items-center justify-between group hover:border-[#F27D26]/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-[#1C1C1F] rounded flex items-center justify-center text-[10px] font-bold text-[#626269]">
                              {rec.provider}
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-[#E1E1E6]">{rec.title}</div>
                              <div className="text-[9px] text-green-500 font-bold">Estimated Savings: {rec.savings}</div>
                            </div>
                          </div>
                          <button className="px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] text-[9px] font-bold rounded border border-[#F27D26]/30 hover:bg-[#F27D26] hover:text-black transition-all">
                            OPTIMIZE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'help' && (
              <motion.div 
                key="help"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12"
              >
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <HelpCircle className="w-6 h-6 text-[#F27D26]" />
                    <h2 className="text-2xl font-bold tracking-tighter text-[#E1E1E6]">SYSTEM_DOCUMENTATION</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg">
                      <h3 className="text-[#F27D26] text-xs font-bold tracking-widest uppercase mb-4">TECH_STACK</h3>
                      <ul className="space-y-3 text-[11px] text-[#626269]">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
                          <span className="text-[#E1E1E6]">Next.js 16</span> - Frontend Framework
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
                          <span className="text-[#E1E1E6]">Go</span> - Backend Microservices
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
                          <span className="text-[#E1E1E6]">Gemini 1.5 Pro</span> - AI Intelligence Engine
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26]" />
                          <span className="text-[#E1E1E6]">WebSockets</span> - Real-time Telemetry
                        </li>
                      </ul>
                    </div>
                    <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg">
                      <h3 className="text-[#F27D26] text-xs font-bold tracking-widest uppercase mb-4">OPERATIONAL_MODES</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-[10px] font-bold text-[#E1E1E6] mb-1">PASSIVE</div>
                          <div className="text-[9px] text-[#626269]">Monitoring and alerting only. No automated changes.</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#E1E1E6] mb-1">ACTIVE</div>
                          <div className="text-[9px] text-[#626269]">Auto-fixes minor issues. Requests approval for major changes.</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-[#E1E1E6] mb-1">AUTONOMOUS</div>
                          <div className="text-[9px] text-[#626269]">Full AI control. All issues fixed and logged automatically.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'whats-new' && (
              <motion.div 
                key="whats-new"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto space-y-12 py-8"
              >
                <div className="text-center space-y-4 mb-12">
                  <h2 className="text-2xl font-bold tracking-tighter text-[#E1E1E6]">SYSTEM_RELEASE_TIMELINE</h2>
                  <p className="text-xs text-[#626269] tracking-widest uppercase">Tracking the evolution of ADDB in mexico-gec</p>
                </div>

                <div className="relative space-y-12">
                  <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-[#1C1C1F]" />
                  
                  {releases.map((release, i) => (
                    <div key={release.id} className="relative pl-12">
                      <div className={cn(
                        "absolute left-0 top-1 w-8 h-8 rounded-full border-4 border-[#0A0A0B] flex items-center justify-center z-10",
                        release.type === 'SYSTEM_UPDATE' ? "bg-[#F27D26]" :
                        release.type === 'FEATURE' ? "bg-blue-500" : "bg-green-500"
                      )}>
                        {release.type === 'SYSTEM_UPDATE' ? <Zap className="w-4 h-4 text-black" /> : 
                         release.type === 'FEATURE' ? <Activity className="w-4 h-4 text-black" /> : 
                         <Wrench className="w-4 h-4 text-black" />}
                      </div>
                      
                      <div className="p-6 bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-[#E1E1E6]">{release.version}</span>
                            <span className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">{release.type}</span>
                          </div>
                          <span className="text-[10px] text-[#626269]">{new Date(release.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-[#A1A1A6] leading-relaxed">{release.summary}</p>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-[#323236] uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified by ADDB_CORE
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {selectedApproval && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]"
              >
                <div className="p-4 border-b border-[#1C1C1F] flex items-center justify-between bg-[#1C1C1F]/30">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-yellow-500" />
                    <div>
                      <h3 className="text-xs font-bold tracking-widest">MAJOR_CHANGE_APPROVAL: {selectedApproval.deploymentId}</h3>
                      <p className="text-[9px] text-[#626269] uppercase">Requested by: {selectedApproval.requestedBy}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedApproval(null)} className="text-[#626269] hover:text-[#E1E1E6]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-[#050505] font-mono text-[11px] space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-[#1C1C1F]/30 border border-[#1C1C1F] rounded">
                      <div className="text-[8px] text-[#626269] uppercase mb-1">Severity</div>
                      <div className="text-xs font-bold text-red-500">MAJOR</div>
                    </div>
                    <div className="p-3 bg-[#1C1C1F]/30 border border-[#1C1C1F] rounded relative group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[8px] text-[#626269] uppercase">Estimated Cost</div>
                        <Lock className="w-2.5 h-2.5 text-[#323236]" />
                      </div>
                      <div className="text-xs font-bold text-[#F27D26]">${deployments.find(d => d.id === selectedApproval.deploymentId)?.costEstimate || 0}/mo</div>
                      <div className="absolute -top-6 left-0 bg-[#1C1C1F] text-[8px] text-[#626269] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-[#323236]">
                        RESOURCE_BASED_COST_PROJECTION: LOCKED (METADATA_ONLY)
                      </div>
                    </div>
                    <div className="p-3 bg-[#1C1C1F]/30 border border-[#1C1C1F] rounded">
                      <div className="text-[8px] text-[#626269] uppercase mb-1">Environment</div>
                      <div className="text-xs font-bold text-white uppercase">{deployments.find(d => d.id === selectedApproval.deploymentId)?.env}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Proposed Changes (Diff)</div>
                    <CodeDiffViewer 
                      before={deployments.find(d => d.id === selectedApproval.deploymentId)?.diff?.before || ""} 
                      after={deployments.find(d => d.id === selectedApproval.deploymentId)?.diff?.after || ""} 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">PLAN.md</div>
                    <pre className="p-4 bg-[#0D0D0E] border border-[#1C1C1F] rounded text-[#A1A1A6] whitespace-pre-wrap leading-relaxed">
                      {selectedApproval.planContent}
                    </pre>
                  </div>
                </div>

                <div className="p-4 border-t border-[#1C1C1F] bg-[#0D0D0E] flex justify-end gap-3">
                  <button 
                    onClick={() => setSelectedApproval(null)}
                    className="px-4 py-2 text-[10px] font-bold text-[#626269] hover:text-[#E1E1E6]"
                  >
                    REJECT_PLAN
                  </button>
                  <button 
                    onClick={() => approveDeployment(selectedApproval.id)}
                    className="px-6 py-2 bg-[#F27D26] text-black text-[10px] font-bold rounded hover:bg-[#E16D16] transition-all flex items-center gap-2"
                  >
                    <FileCheck className="w-4 h-4" />
                    SIGN & APPROVE
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isInviteModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg w-full max-w-md p-8 space-y-6 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-[#F27D26]" />
                  <h3 className="text-sm font-bold tracking-widest">INVITE_STAKEHOLDER</h3>
                </div>

                {!generatedInviteUrl ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Email Address</label>
                      <input 
                        type="email" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="stakeholder@mexico-gec.io"
                        className="w-full bg-[#1C1C1F] border border-[#323236] rounded p-3 text-xs focus:outline-none focus:border-[#F27D26]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Assign Role</label>
                      <select 
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                        className="w-full bg-[#1C1C1F] border border-[#323236] rounded p-3 text-xs focus:outline-none focus:border-[#F27D26]"
                      >
                        <option value="CLOUD_ENGINEER">CLOUD_ENGINEER</option>
                        <option value="DEVOPS_ENGINEER">DEVOPS_ENGINEER</option>
                        <option value="APPROVER">APPROVER</option>
                        <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                      </select>
                    </div>
                    <button 
                      onClick={inviteStakeholder}
                      className="w-full py-3 bg-[#F27D26] text-black text-[10px] font-bold rounded hover:bg-[#E16D16] transition-colors"
                    >
                      GENERATE INVITE LINK
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded text-green-500 text-[10px] leading-relaxed">
                      Invite generated successfully. Send this unique URL to the stakeholder.
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[#626269] uppercase tracking-widest">Invite URL</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedInviteUrl}
                          className="flex-1 bg-[#1C1C1F] border border-[#323236] rounded p-3 text-[10px] text-[#A1A1A6]"
                        />
                        <button 
                          onClick={() => navigator.clipboard.writeText(generatedInviteUrl)}
                          className="px-4 bg-[#1C1C1F] border border-[#323236] rounded text-[10px] font-bold hover:bg-[#323236]"
                        >
                          COPY
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setGeneratedInviteUrl('');
                        setInviteEmail('');
                      }}
                      className="w-full py-3 border border-[#1C1C1F] text-[#626269] text-[10px] font-bold rounded hover:bg-[#1C1C1F]"
                    >
                      DONE
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOnboardingOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0D0D0E] border border-[#1C1C1F] rounded-lg w-full max-w-xl p-8 space-y-6 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                    <h3 className="text-xs font-bold tracking-widest">CLIENT ONBOARDING: {cloudProvider.name.toUpperCase()}</h3>
                  </div>
                  <button 
                    onClick={() => setIsOnboardingOpen(false)}
                    className="p-1 text-[#626269] hover:text-[#E1E1E6] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] text-[#626269] leading-relaxed">
                    Enter the Client's Project or Account ID to generate the IAM authorization command. This will grant ADDB's service account the necessary permissions to manage deployments in the target tenant.
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#323236] uppercase tracking-widest">Project / Account ID</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={onboardingProjectId}
                        onChange={(e) => setOnboardingProjectId(e.target.value)}
                        placeholder="e.g. client-project-123"
                        className="flex-1 bg-[#1C1C1F] border border-[#323236] rounded px-4 py-2 text-xs focus:outline-none focus:border-[#F27D26] transition-colors"
                      />
                      <button 
                        onClick={() => generateOnboardingCommand(onboardingProjectId)}
                        className="px-4 py-2 bg-[#F27D26] text-black text-[10px] font-bold rounded hover:bg-[#E16D16] transition-colors"
                      >
                        GENERATE
                      </button>
                    </div>
                  </div>

                  {onboardingCommand && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#323236] uppercase tracking-widest">IAM CLI Command</label>
                      <div className="relative group">
                        <pre className="bg-[#050505] border border-[#1C1C1F] p-4 rounded text-[10px] text-[#A1A1A6] whitespace-pre-wrap break-all leading-relaxed">
                          {onboardingCommand}
                        </pre>
                        <button 
                          onClick={() => navigator.clipboard.writeText(onboardingCommand)}
                          className="absolute top-2 right-2 p-1.5 bg-[#1C1C1F] text-[#626269] hover:text-[#F27D26] rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Copy to Clipboard"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-[8px] text-[#323236] italic">
                        * Run this command in your local terminal to authorize ADDB.
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    onClick={() => setIsOnboardingOpen(false)}
                    className="px-6 py-2 bg-[#1C1C1F] hover:bg-[#323236] text-[10px] font-bold tracking-widest rounded transition-colors"
                  >
                    CLOSE_ONBOARDING
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <SystemLegend />
      </main>
    </div>
    </ErrorBoundary>
  );
}

function StatCard({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <div className="bg-[#0D0D0E] border border-[#1C1C1F] p-6 rounded-lg relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#F27D26] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="text-[10px] font-bold tracking-widest text-[#626269] mb-2">{label}</div>
      <div className="text-3xl font-bold tracking-tighter mb-1">{value}</div>
      <div className="text-[10px] text-[#323236] uppercase">{sub}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: Deployment['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />;
  return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
}

function QuickCommand({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-[9px] font-bold text-[#626269] hover:text-[#F27D26] border border-[#1C1C1F] px-2 py-1 rounded hover:border-[#F27D26]/50 transition-all"
    >
      {label}
    </button>
  );
}

function HistorySidebar({ 
  sessions, 
  activeId, 
  onSelect, 
  onNewChat, 
  isOpen, 
  onToggle 
}: { 
  sessions: ChatSession[], 
  activeId: string | null, 
  onSelect: (id: string) => void, 
  onNewChat: () => void,
  isOpen: boolean,
  onToggle: () => void
}) {
  return (
    <motion.div 
      initial={false}
      animate={{ width: isOpen ? 240 : 0 }}
      className="h-full border-r border-[#1C1C1F] bg-[#0D0D0E] flex flex-col overflow-hidden relative shrink-0"
    >
      <div className="p-4 border-b border-[#1C1C1F] flex items-center justify-between min-w-[240px]">
        <span className="text-[10px] font-bold tracking-widest text-[#626269]">SESSION_HISTORY</span>
        <button onClick={onNewChat} className="p-1 text-[#F27D26] hover:bg-[#F27D26]/10 rounded transition-colors">
          <UserPlus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-w-[240px]">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-[10px] text-[#323236] italic">No history found</div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={cn(
                "w-full text-left p-4 border-b border-[#1C1C1F] transition-all hover:bg-[#1C1C1F]/50",
                activeId === session.id ? "bg-[#F27D26]/5 border-l-2 border-l-[#F27D26]" : "border-l-2 border-l-transparent"
              )}
            >
              <div className="text-[11px] font-bold text-[#E1E1E6] truncate mb-1">{session.title}</div>
              <div className="text-[9px] text-[#323236] uppercase">
                {session.updatedAt ? new Date(session.updatedAt.seconds * 1000).toLocaleDateString() : 'Just now'}
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}
