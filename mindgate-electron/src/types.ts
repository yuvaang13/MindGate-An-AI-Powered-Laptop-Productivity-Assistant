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
}

export interface DecisionResult {
  isApproved: boolean | null;
  message: string;
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