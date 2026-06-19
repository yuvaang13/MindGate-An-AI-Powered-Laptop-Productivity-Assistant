export interface AppSettings {
  distractingApps: string[];
  restrictedKeywords: string[];
  monitoredBrowsers: string[];
  ollamaURL: string;
  ollamaModel: string;
  accessDurations: number[];
  accessDurationLabels: string[];
  productiveTasks: string[];
  productiveApps: string[];
  justificationCountdownDuration: number;
}

export interface UIThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  error: string;
  warning: string;
}

export interface UIThemeAnimation {
  transitionDuration: number;
  overlayFadeDuration: number;
}

export interface UIThemeDimensions {
  overlayWidth: number;
  overlayHeight: number;
  chatCornerRadius: number;
  overlayXOffset?: number;
  overlayYOffset?: number;
}

export interface Configuration {
  settings: AppSettings;
  theme: {
    colors: UIThemeColors;
    animation: UIThemeAnimation;
    dimensions: UIThemeDimensions;
  };
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  message: string;
  isApproved: boolean | null;
  durationMinutes?: number;
  readiness?: AIReadinessStatus;
}

export interface DecisionResult {
  isApproved: boolean | null;
  message: string;
}

export interface OllamaConnectionStatus {
  connected: boolean;
  message: string;
  origin: string;
  configuredModel: string;
  activeModel: string;
  modelAvailable: boolean;
  availableModels: string[];
  error?: string;
}

export interface AIReadinessStatus {
  ready: boolean;
  bridgeReady: boolean;
  ollamaReachable: boolean;
  modelReady: boolean;
  warmupReady: boolean;
  message: string;
  elapsedMs: number;
  startedAt: number;
  origin: string;
  configuredModel: string;
  activeModel: string;
}

export interface BridgeStatus {
  ready: boolean;
  configuration: boolean;
  decisionEngine: boolean;
  windowManager: boolean;
  workspaceMonitor: boolean;
  aiReady: boolean;
  ai: AIReadinessStatus;
}

export interface ActiveWindowInfo {
  processName: string;
  windowTitle: string;
  bundleID?: string;
  exeName?: string;
  browserURL?: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
