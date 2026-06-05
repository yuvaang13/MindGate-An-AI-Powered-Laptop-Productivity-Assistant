import { OllamaService } from './ollamaService';
import { ActiveWindowInfo, DecisionResult, Configuration } from '../types';

export class DecisionEngine {
  private ollamaService: OllamaService;
  private currentApp: ActiveWindowInfo | null = null;
  private accessTimer: NodeJS.Timeout | null = null;
  private grantedAppIdentifier: string | null = null;
  private accessExpiresAt: number | null = null;

  constructor(private configuration: Configuration) {
    this.ollamaService = new OllamaService(
      configuration.settings.ollamaURL,
      configuration.settings.ollamaModel
    );
  }

  setCurrentApp(app: ActiveWindowInfo): void {
    this.currentApp = app;
  }

  async checkOllamaConnection(): Promise<boolean> {
    return this.ollamaService.checkConnection();
  }

  async evaluateRequest(userInput: string): Promise<DecisionResult> {
    const systemPrompt = `
You are a highly advanced, strict productivity mentor. The user is trying to access a distracting app. Their reason is: '${userInput}'.
If this is genuinely essential for immediate work, task tracking, or safety, respond only with the word 'YES'.
If it is an excuse, mindless scrolling, or procrastination, reply only with the word 'NO'.

Current productive tasks: ${this.configuration.settings.productiveTasks.join(', ')}
Current productive apps: ${this.configuration.settings.productiveApps.join(', ')}
`;

    try {
      const response = await this.ollamaService.generateRawResponse(systemPrompt);
      const isApproved = this.parseApproval(response);
      const message = isApproved
        ? 'Access approved. Please select a duration.'
        : 'Access denied. Stay focused on your work.';

      return { isApproved, message };
    } catch (error) {
      return {
        isApproved: false,
        message: 'AI service unavailable. Access denied.'
      };
    }
  }

  private parseApproval(response: string): boolean {
    const normalized = response.trim().toUpperCase();
    return normalized.startsWith('YES');
  }

  grantAccess(duration: number): void {
    this.accessTimer && clearTimeout(this.accessTimer);
    this.grantedAppIdentifier = this.currentApp ? this.getAppIdentifier(this.currentApp) : null;
    this.accessExpiresAt = Date.now() + (duration * 1000);

    this.accessTimer = setTimeout(() => {
      this.revokeAccessAndReappear();
    }, duration * 1000);
  }

  private revokeAccessAndReappear(): void {
    this.accessTimer = null;
    const expiredIdentifier = this.grantedAppIdentifier;
    this.grantedAppIdentifier = null;
    this.accessExpiresAt = null;
    this.onAccessExpired?.(expiredIdentifier);
  }

  private revokeAccess(): void {
    this.accessTimer && clearTimeout(this.accessTimer);
    this.accessTimer = null;
    this.grantedAppIdentifier = null;
    this.accessExpiresAt = null;
  }

  hasActiveAccess(app: ActiveWindowInfo): boolean {
    if (!this.grantedAppIdentifier || !this.accessExpiresAt) {
      return false;
    }

    if (this.accessExpiresAt <= Date.now()) {
      this.revokeAccessAndReappear();
      return false;
    }

    return this.grantedAppIdentifier === this.getAppIdentifier(app);
  }

  cancelAccessTimer(): void {
    this.accessTimer && clearTimeout(this.accessTimer);
    this.accessTimer = null;
    this.grantedAppIdentifier = null;
    this.accessExpiresAt = null;
  }

  isAccessExpired(): boolean {
    return this.accessExpiresAt !== null && this.accessExpiresAt <= Date.now();
  }

  getRemainingTime(): number {
    if (!this.accessExpiresAt) return 0;
    return Math.max(0, Math.ceil((this.accessExpiresAt - Date.now()) / 1000));
  }

  private getAppIdentifier(app: ActiveWindowInfo): string {
    return app.bundleID || app.exeName || app.processName;
  }

  getConfiguration(): Configuration {
    return this.configuration;
  }

  updateConfiguration(config: Configuration) {
    this.configuration = config;
  }

  onAccessExpired?: (appIdentifier: string | null) => void;
}