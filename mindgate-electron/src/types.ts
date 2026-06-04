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
  orbBreathingDuration: number;
  orbTransitionDuration: number;
  overlayFadeDuration: number;
}

export interface UIThemeDimensions {
  orbSize: number;
  orbExpandedWidth: number;
  orbExpandedHeight: number;
  chatCornerRadius: number;
  orbXOffset: number;
  orbYOffset: number;
  orbDistractionOffset: number;
}

export interface Configuration {
  settings: AppSettings;
  theme: {
    colors: UIThemeColors;
    animation: UIThemeAnimation;
    dimensions: UIThemeDimensions;
  };
}

export interface DecisionResult {
  isApproved: boolean;
  message: string;
}

export interface ActiveWindowInfo {
  processName: string;
  windowTitle: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}