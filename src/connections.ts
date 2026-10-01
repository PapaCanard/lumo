// Les IA que l'utilisateur a ajoutées (« connexions »), les modèles d'IA proposés à l'ajout
// (« presets ») et ce que chaque modèle sait faire (« capacités »).

/** Protocole utilisé pour parler à l'IA. `openai` couvre toutes les API compatibles OpenAI. */
export type Kind = "claude" | "gemini" | "copilot" | "openai";

export interface Caps {
  /** Lit les fichiers texte et le code (toujours : ils sont insérés dans le message). */
  files: boolean;
  /** Lit les images (vision). */
  images: boolean;
  /** Lit les PDF. */
  pdf: boolean;
  /** Génère des images. */
  imageGen: boolean;
}

export interface Connection {
  id: string; // aussi le nom de l'identifiant dans le Gestionnaire d'identifiants Windows
  name: string; // nom affiché dans la barre
  preset: string;
  kind: Kind;
  model: string;
  baseUrl?: string; // API compatibles OpenAI
  color: string;
  caps: Caps;
}

export interface Preset {
  id: string;
  label: string;
  group: "cloud" | "local";
  kind: Kind;
  color: string;
  baseUrl?: string;
  editableUrl?: boolean;
  /** « required » : clé obligatoire ; « optional » : serveur local, clé facultative. */
  secret: "required" | "optional";
  secretLabel: string;
  secretHint: string;
  help?: { label: string; url: string };
  note: string;
  defaultModel: string;
  modelHint: string;
}

export const PRESETS: Preset[] = [
  {
    id: "claude", label: "Claude (Anthropic)", group: "cloud", kind: "claude", color: "#e07b53",
    secret: "required", secretLabel: "Clé API Anthropic", secretHint: "sk-ant-…",
    help: { label: "Créer une clé sur console.anthropic.com", url: "https://console.anthropic.com/settings/keys" },
    note: "API officielle Anthropic, facturée à l'usage sur ton compte API (distinct de l'abonnement Claude.ai). Lit les images et les PDF.",
    defaultModel: "claude-sonnet-5-5", modelHint: "ex. claude-sonnet-5-5",
  },
  {
    id: "gemini", label: "Gemini (Google)", group: "cloud", kind: "gemini", color: "#5b8def",
    secret: "required", secretLabel: "Clé API Google AI Studio", secretHint: "AIza…",
    help: { label: "Créer une clé sur aistudio.google.com", url: "https://aistudio.google.com/apikey" },
    note: "API Gemini de Google (AI Studio), avec un quota gratuit selon le modèle. Lit les images et les PDF ; les modèles « …-image » génèrent aussi des images.",
    defaultModel: "gemini-2.5-flash", modelHint: "ex. gemini-2.5-flash",
  },
  {
    id: "copilot", label: "GitHub Copilot", group: "cloud", kind: "copilot", color: "#8b5cf6",
    secret: "required", secretLabel: "Jeton GitHub (fine-grained)", secretHint: "github_pat_…",
    help: { label: "Créer un jeton sur github.com/settings/personal-access-tokens", url: "https://github.com/settings/personal-access-tokens" },
    note: "Passe par la CLI officielle GitHub Copilot (winget install GitHub.Copilot.CLI) avec un jeton fine-grained ayant la permission « Copilot Requests ». Abonnement Copilot requis. Texte uniquement.",
    defaultModel: "", modelHint: "vide = modèle par défaut de Copilot",
  },
  {
    id: "openai", label: "ChatGPT (OpenAI)", group: "cloud", kind: "openai", color: "#10a37f", baseUrl: "https://api.openai.com/v1",
    secret: "required", secretLabel: "Clé API OpenAI", secretHint: "sk-…",
    help: { label: "Créer une clé sur platform.openai.com", url: "https://platform.openai.com/api-keys" },
    note: "API OpenAI, facturée à l'usage (distincte de l'abonnement ChatGPT). Les modèles GPT-4o, GPT-4.1 et GPT-5 lisent les images.",
    defaultModel: "gpt-4.1-mini", modelHint: "ex. gpt-4.1-mini",
  },
  {
    id: "mistral", label: "Mistral AI (Le Chat)", group: "cloud", kind: "openai", color: "#fa520f", baseUrl: "https://api.mistral.ai/v1",
    secret: "required", secretLabel: "Clé API Mistral", secretHint: "clé de console.mistral.ai",
    help: { label: "Créer une clé sur console.mistral.ai", url: "https://console.mistral.ai/api-keys" },
    note: "IA française, hébergée en Europe. Les modèles Pixtral et Mistral Medium/Small récents lisent les images.",
    defaultModel: "mistral-small-latest", modelHint: "ex. mistral-small-latest",
  },
  {
    id: "openrouter", label: "OpenRouter (des centaines de modèles)", group: "cloud", kind: "openai", color: "#6467f2", baseUrl: "https://openrouter.ai/api/v1",
    secret: "required", secretLabel: "Clé API OpenRouter", secretHint: "sk-or-…",
    help: { label: "Créer une clé sur openrouter.ai", url: "https://openrouter.ai/keys" },
    note: "Une seule clé pour des modèles de nombreux éditeurs (format « éditeur/modèle »). Certains sont gratuits (suffixe « :free »).",
    defaultModel: "", modelHint: "ex. meta-llama/llama-3.3-70b-instruct",
  },
  {
    id: "groq", label: "Groq (très rapide)", group: "cloud", kind: "openai", color: "#f55036", baseUrl: "https://api.groq.com/openai/v1",
    secret: "required", secretLabel: "Clé API Groq", secretHint: "gsk_…",
    help: { label: "Créer une clé sur console.groq.com", url: "https://console.groq.com/keys" },
    note: "Modèles ouverts (Llama, Qwen…) servis très vite, avec un quota gratuit.",
    defaultModel: "", modelHint: "ex. llama-3.3-70b-versatile",
  },
  {
    id: "deepseek", label: "DeepSeek", group: "cloud", kind: "openai", color: "#4d6bfe", baseUrl: "https://api.deepseek.com/v1",
    secret: "required", secretLabel: "Clé API DeepSeek", secretHint: "sk-…",
    help: { label: "Créer une clé sur platform.deepseek.com", url: "https://platform.deepseek.com/api_keys" },
    note: "Modèles DeepSeek, peu coûteux. Texte uniquement.",
    defaultModel: "deepseek-chat", modelHint: "ex. deepseek-chat",
  },
  {
    id: "ollama", label: "Ollama (sur ce PC)", group: "local", kind: "openai", color: "#2fae7b", baseUrl: "http://localhost:11434/v1", editableUrl: true,
    secret: "optional", secretLabel: "Clé d'accès (facultative)", secretHint: "laisser vide",
    help: { label: "Installer Ollama (ollama.com)", url: "https://ollama.com/download" },
    note: "Un modèle qui tourne sur ton PC : rien ne quitte ta machine. Lance Ollama, clique sur « Lister les modèles », choisis-en un.",
    defaultModel: "", modelHint: "ex. llama3.2:latest",
  },
  {
    id: "lmstudio", label: "LM Studio (sur ce PC)", group: "local", kind: "openai", color: "#3b82f6", baseUrl: "http://localhost:1234/v1", editableUrl: true,
    secret: "optional", secretLabel: "Clé d'accès (facultative)", secretHint: "laisser vide",
    help: { label: "Installer LM Studio (lmstudio.ai)", url: "https://lmstudio.ai" },
    note: "Démarre le serveur dans LM Studio (onglet Développeur), puis liste les modèles chargés.",
    defaultModel: "", modelHint: "ex. qwen2.5-7b-instruct",
  },
  {
    id: "custom", label: "Autre API compatible OpenAI", group: "local", kind: "openai", color: "#d9a514", baseUrl: "http://localhost:8080/v1", editableUrl: true,
    secret: "optional", secretLabel: "Clé API (si le service en demande une)", secretHint: "facultative",
    note: "llama.cpp, vLLM, LocalAI, Azure OpenAI, un serveur d'entreprise… Toute adresse qui répond à /chat/completions.",
    defaultModel: "", modelHint: "nom du modèle",
  },
];

export const presetOf = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];

/** Ce que sait faire un modèle, déduit de son fournisseur et de son nom. L'utilisateur peut corriger dans les réglages. */
export function guessCaps(preset: string, model: string): Caps {
  const p = presetOf(preset);
  const m = model.toLowerCase();
  switch (p.kind) {
    case "claude": return { files: true, images: true, pdf: true, imageGen: false };
    case "gemini": return { files: true, images: true, pdf: true, imageGen: /image/.test(m) };
    case "copilot": return { files: true, images: false, pdf: false, imageGen: false };
    default: {
      const vision = /gpt-4o|gpt-4\.1|gpt-5|chatgpt-4o|\bo[34]\b|o4-mini|vision|llava|pixtral|mistral-(medium|small)-(2[5-9]|latest)|[-_.]vl\b|-vl-|gemma-?3|llama-?3\.2-vision|llama-?4|minicpm-v|moondream|claude|gemini|qwen.*vl/.test(m);
      return { files: true, images: vision, pdf: false, imageGen: false };
    }
  }
}

export const CAP_LABELS: Record<keyof Caps, string> = {
  files: "Fichiers texte et code",
  images: "Lecture d'images",
  pdf: "Lecture de PDF",
  imageGen: "Génération d'images",
};

export function newId(): string {
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Couleur plus claire pour les yeux de Lumo (ils brillent sur fond sombre). */
export function eyeColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.22);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
