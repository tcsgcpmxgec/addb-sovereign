import { GoogleGenAI, Content, Part, Type, FunctionDeclaration } from "@google/genai";
import { Deployment, ArchitectureNode, ChatMessage, Ticket } from "../types";

const getApiKey = async () => {
  // 1. Check window global (some platforms inject here)
  if (typeof window !== 'undefined' && (window as any).API_KEY) {
    console.log("[Gemini] Found API_KEY in window global.");
    return (window as any).API_KEY;
  }
  if (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) {
    console.log("[Gemini] Found GEMINI_API_KEY in window global.");
    return (window as any).GEMINI_API_KEY;
  }

  // 2. Check process.env (Vite define)
  let key = process.env.API_KEY || 
            process.env.GEMINI_API_KEY || 
            process.env.GOOGLE_API_KEY || 
            process.env.GOOGLE_GENERATIVE_AI_KEY ||
            process.env.GEMINI_KEY ||
            (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  const isPlaceholder = (k: string | undefined) => 
    !k || k === 'undefined' || k === 'null' || k === 'MY_GEMINI_API_KEY' || k === 'YOUR_API_KEY' || k === 'TODO_KEYHERE' || k.length < 5;

  if (!isPlaceholder(key)) {
    console.log("[Gemini] Found API key in environment.");
    return key;
  }

  // 3. Fetch from backend with a single retry
  const fetchKey = async () => {
    try {
      const response = await fetch('/api/gemini-key');
      if (response.ok) {
        const data = await response.json();
        if (!isPlaceholder(data.key)) {
          console.log("[Gemini] Successfully fetched API key from backend.");
          return data.key;
        }
      }
    } catch (err) {
      console.error("[Gemini] Failed to fetch API key from backend:", err);
    }
    return null;
  };

  let backendKey = await fetchKey();
  if (!backendKey) {
    // Small delay and retry once
    await new Promise(r => setTimeout(r, 1000));
    backendKey = await fetchKey();
  }

  if (backendKey) return backendKey;

  console.warn("[Gemini] No valid API key found after checking all sources.");
  return null;
};

export async function chatWithADDB(message: string, history: ChatMessage[], botBehavior: string = 'ACTIVE') {
  const apiKey = await getApiKey();
  
  // Check if we need to prompt for a key via AI Studio API
  if (!apiKey && typeof window !== 'undefined' && (window as any).aistudio) {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      return { 
        text: "Error: No valid Gemini API key found. ADDB core requires an API key to function. Please click the 'SELECT_API_KEY' button in the header to select a key from your Google Cloud projects.",
        requiresKeySelection: true 
      };
    } else {
      // User has selected a key, but it's not yet available in the environment or backend
      return {
        text: "Error: API key selected but not yet active. Please refresh the page to apply the new key, or ensure your selected project has the Gemini API enabled.",
        requiresKeySelection: true
      };
    }
  }

  if (!apiKey) {
    return { 
      text: "Error: GEMINI_API_KEY is missing. ADDB requires this key to process your requests. Please configure it in AI Studio settings (Secrets) or use the SELECT_API_KEY button in the header.",
      requiresKeySelection: true
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Convert ChatMessage history to the format expected by the SDK
  const contents: Content[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const systemInstruction = `You are ADDB (Autonomous DevOps Deployment Bot). Help the user manage their multi-cloud infrastructure (GCP, AWS, Azure) across multiple projects.
  Current Mode: ${botBehavior}. 
  ${botBehavior === 'AUTONOMOUS' ? 'In Autonomous mode, you should proactively suggest optimizations and take initiative in identifying potential infrastructure improvements.' : 'In Active mode, you respond to user queries and provide assistance as requested.'}
  
  You have access to the following tools:
  - getDeploymentStatus: Check the status of recent deployments.
  - triggerDeployment: Start a new deployment to a specific environment.
  - switchProject: Change the active project context.
  - switchCloudProvider: Change the active cloud provider (GCP, AWS, Azure).
  - refreshGcpData: Manually trigger a refresh of GCP resource discovery and architecture mapping.
  
  Always provide clear, technical explanations for your actions.`;

  const getDeploymentStatus: FunctionDeclaration = {
    name: "getDeploymentStatus",
    description: "Get the status of recent deployments in the current project.",
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const triggerDeployment: FunctionDeclaration = {
    name: "triggerDeployment",
    description: "Trigger a new deployment to a specific environment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        env: { type: Type.STRING, description: "The environment (e.g., staging, production)" },
        version: { type: Type.STRING, description: "The version tag to deploy" }
      },
      required: ["env", "version"]
    }
  };

  const switchProject: FunctionDeclaration = {
    name: "switchProject",
    description: "Switch the active project context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING, description: "The ID of the project to switch to" }
      },
      required: ["projectId"]
    }
  };

  const switchCloudProvider: FunctionDeclaration = {
    name: "switchCloudProvider",
    description: "Switch the active cloud provider.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        providerId: { type: Type.STRING, enum: ["gcp", "aws", "azure"], description: "The ID of the cloud provider" }
      },
      required: ["providerId"]
    }
  };

  const refreshGcpData: FunctionDeclaration = {
    name: "refreshGcpData",
    description: "Manually trigger a refresh of GCP resource discovery and architecture mapping.",
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [getDeploymentStatus, triggerDeployment, switchProject, switchCloudProvider, refreshGcpData] }]
    },
    history: contents
  });
  
  try {
    const result = await chat.sendMessage({ message });
    return {
      text: result.text,
      functionCalls: result.functionCalls
    };
  } catch (err: any) {
    console.error("Gemini Chat Error:", err);
    
    let errorMessage = err.message || '';
    try {
      // Try to parse JSON error if it's a string
      const json = JSON.parse(errorMessage);
      if (json.error?.message) errorMessage = json.error.message;
    } catch (e) {}

    const isApiKeyInvalid = errorMessage.includes('API key not valid') || 
                           errorMessage.includes('API_KEY_INVALID') || 
                           errorMessage.includes('expired') ||
                           errorMessage.includes('renew') ||
                           errorMessage.includes('INVALID_ARGUMENT');
    const isQuotaExceeded = errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('limit');

    if (isApiKeyInvalid && typeof window !== 'undefined' && (window as any).aistudio) {
      return { 
        text: `Error: Your Gemini API key is invalid or has expired (${errorMessage}). Please click the 'SELECT_API_KEY' button in the header to select or renew a valid key from a paid Google Cloud project.`,
        requiresKeySelection: true 
      };
    }

    if (isQuotaExceeded) {
      return {
        text: "Error: Gemini API quota exceeded. Please wait a moment or use a different API key with higher limits.",
        requiresKeySelection: true
      };
    }
    
    return { text: `Error: Failed to communicate with ADDB core. ${errorMessage || 'Check your API key and network connection.'}` };
  }
}

export async function analyzeFailure(deployment: Deployment) {
  const apiKey = await getApiKey();
  if (!apiKey) return { issueIdentified: "API Key Missing", fixApplied: "Configure GEMINI_API_KEY" };

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Analyze this failed deployment and identify the root cause and a potential fix.
  If the fix involves a code change, provide the file path, the exact content to replace, and the replacement content.
  
  Deployment: ${JSON.stringify(deployment)}
  
  Format: JSON { 
    issueIdentified: string, 
    fixApplied: string, 
    codeChange?: { 
      filePath: string, 
      targetContent: string, 
      replacementContent: string 
    } 
  }`;
  
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(result.text);
  } catch (err) {
    console.error("Gemini Analysis Error:", err);
    return { issueIdentified: "Analysis Failed", fixApplied: "Manual review required" };
  }
}

export async function generateSuggestions(nodes: ArchitectureNode[], deployments: Deployment[], projectId: string) {
  const apiKey = await getApiKey();
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a Senior GCP Cloud Architect. Analyze the following infrastructure and deployment data for project ${projectId} and provide 3-5 high-impact architectural suggestions.
  Consider:
  1. Cost Optimization (e.g., rightsizing VMs, using Spot instances, lifecycle policies for GCS).
  2. Security Hardening (e.g., private GKE clusters, Cloud Armor, IAM least privilege).
  3. Reliability & Scalability (e.g., multi-region deployments, managed instance groups).
  4. Modernization (e.g., moving from GCE to Cloud Run or GKE).

  Current Resources: ${JSON.stringify(nodes)}
  Recent Deployments: ${JSON.stringify(deployments.slice(0, 5))}
  
  Format your response as a JSON array of objects:
  {
    "id": "unique-id",
    "title": "Short descriptive title",
    "description": "Detailed explanation of the suggestion and its benefits",
    "impact": "high" | "medium" | "low",
    "category": "cost" | "security" | "reliability" | "performance"
  }`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(result.text);
  } catch (err) {
    console.error("Gemini Suggestions Error:", err);
    return [];
  }
}

export async function proposeEvolutionAI(ticket: Ticket, nodes: ArchitectureNode[]) {
  const apiKey = await getApiKey();
  if (!apiKey) return "Error: API Key missing";

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are ADDB (Autonomous DevOps Deployment Bot). A user has submitted a request for system evolution.
  
  User Request: "${ticket.userMessage}"
  Current Infrastructure: ${JSON.stringify(nodes)}
  
  Propose a concrete technical solution. If it involves code or configuration changes, provide a concise summary of what needs to be changed.
  
  Format your response as a professional technical proposal.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return result.text;
  } catch (err) {
    console.error("Gemini Evolution Error:", err);
    return "Error: Failed to generate evolution proposal.";
  }
}
