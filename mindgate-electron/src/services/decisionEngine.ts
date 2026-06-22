import { OllamaService } from './ollamaService.js';
import { ActiveWindowInfo, AIReadinessStatus, ChatMessage, ChatResponse, Configuration, OllamaConnectionStatus } from '../types.js';

const MAX_CHAT_HISTORY = 40;

function getOllamaOrigin(baseURL: string): string {
  try {
    return new URL(baseURL).origin;
  } catch {
    return baseURL.replace(/\/api\/generate\/?$/, '').replace(/\/$/, '');
  }
}

export class DecisionEngine {
  private ollamaService: OllamaService;
  private currentApp: ActiveWindowInfo | null = null;
  private accessTimer: NodeJS.Timeout | null = null;
  private grantedAppIdentifier: string | null = null;
  private accessExpiresAt: number | null = null;
  private chatHistory: ChatMessage[] = [];
  private aiReadinessStatus: AIReadinessStatus;
  private aiReadinessPromise: Promise<AIReadinessStatus> | null = null;

  constructor(private configuration: Configuration) {
    this.ollamaService = new OllamaService(
      configuration.settings.ollamaURL,
      configuration.settings.ollamaModel
    );
    this.aiReadinessStatus = this.createReadinessStatus({
      ready: false,
      bridgeReady: false,
      ollamaReachable: false,
      modelReady: false,
      warmupReady: false,
      message: 'MindGate AI is starting.',
    });
  }

  setCurrentApp(app: ActiveWindowInfo): void {
    this.currentApp = app;
  }

  async checkOllamaConnection(): Promise<boolean> {
    return this.ollamaService.checkConnection();
  }

  async getOllamaConnectionStatus(): Promise<OllamaConnectionStatus> {
    return this.ollamaService.getConnectionStatus();
  }

  async getAvailableModels(): Promise<string[]> {
    return this.ollamaService.getAvailableModels();
  }

  initializeForLaunch(timeoutMs = 5000): Promise<AIReadinessStatus> {
    if (this.aiReadinessPromise) {
      return this.aiReadinessPromise;
    }

    this.aiReadinessPromise = this.runLaunchReadiness(timeoutMs)
      .finally(() => {
        this.aiReadinessPromise = null;
      });

    return this.aiReadinessPromise;
  }

  getAIReadinessStatus(bridgeReady: boolean): AIReadinessStatus {
    return {
      ...this.aiReadinessStatus,
      bridgeReady,
      ready: bridgeReady && this.aiReadinessStatus.ready,
    };
  }

  isAIReady(bridgeReady: boolean): boolean {
    return bridgeReady && this.aiReadinessStatus.ready;
  }

  private async runLaunchReadiness(timeoutMs: number): Promise<AIReadinessStatus> {
    const startedAt = Date.now();
    this.aiReadinessStatus = this.createReadinessStatus({
      elapsedMs: 0,
      message: 'Checking Ollama connection.',
      startedAt,
    });
    console.log('[DecisionEngine] Checking Ollama connection...');

    try {
      const connected = await this.ollamaService.waitForConnection(timeoutMs);

      if (!connected) {
        this.aiReadinessStatus = this.createReadinessStatus({
          elapsedMs: Date.now() - startedAt,
          message: 'Ollama is not reachable within 5 seconds. Start Ollama and make sure it is listening.',
          startedAt,
        });
        console.warn('[DecisionEngine] AI readiness blocked:', this.aiReadinessStatus.message);
        return this.aiReadinessStatus;
      }

      const ollamaStatus = await this.ollamaService.getConnectionStatus();

      this.aiReadinessStatus = this.createReadinessStatus({
        elapsedMs: Date.now() - startedAt,
        ollamaReachable: ollamaStatus.connected,
        modelReady: ollamaStatus.modelAvailable,
        message: ollamaStatus.message,
        origin: ollamaStatus.origin,
        activeModel: ollamaStatus.activeModel,
        startedAt,
      });
      console.log('[DecisionEngine] Ollama status:', ollamaStatus.message);

      if (!ollamaStatus.connected) {
        console.warn('[DecisionEngine] AI readiness blocked:', this.aiReadinessStatus.message);
        return this.aiReadinessStatus;
      }

      this.aiReadinessStatus = this.createReadinessStatus({
        ready: true,
        bridgeReady: false,
        elapsedMs: Date.now() - startedAt,
        ollamaReachable: true,
        modelReady: true,
        warmupReady: true, // Start warmup immediately, mark as ready
        message: 'MindGate AI is ready.',
        origin: ollamaStatus.origin,
        activeModel: ollamaStatus.activeModel,
        startedAt,
      });
      console.log('[DecisionEngine] AI readiness complete:', this.aiReadinessStatus.message);
      
      // Start warming up model in background to ensure it's ready
      this.warmUpModelInBackground();

      return this.aiReadinessStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.aiReadinessStatus = this.createReadinessStatus({
        elapsedMs: Date.now() - startedAt,
        message: `AI startup failed: ${message}`,
        startedAt,
      });
      console.error('[DecisionEngine] AI readiness failed:', message);
      return this.aiReadinessStatus;
    }
  }

  private warmUpModelInBackground(): void {
    this.ollamaService.warmUpModel()
      .then(() => {
        this.aiReadinessStatus = this.createReadinessStatus({
          ...this.aiReadinessStatus,
          warmupReady: true,
          elapsedMs: Date.now() - this.aiReadinessStatus.startedAt,
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[DecisionEngine] Background model warmup failed:', message);
      });
  }

  private createReadinessStatus(overrides: Partial<AIReadinessStatus>): AIReadinessStatus {
    const startedAt = overrides.startedAt ?? Date.now();
    const elapsedMs = overrides.elapsedMs ?? Math.max(0, Date.now() - startedAt);

    return {
      ready: false,
      bridgeReady: false,
      ollamaReachable: false,
      modelReady: false,
      warmupReady: false,
      message: 'MindGate AI is starting.',
      elapsedMs,
      startedAt,
      origin: getOllamaOrigin(this.configuration.settings.ollamaURL),
      configuredModel: this.configuration.settings.ollamaModel,
      activeModel: this.configuration.settings.ollamaModel,
      ...overrides,
    };
  }

  private getDistractionContext(): string {
    if (!this.currentApp) return 'Accessing a distracting website or app';
    const parts: string[] = [];
    if (this.currentApp.browserURL) {
      try {
        const url = new URL(this.currentApp.browserURL);
        parts.push(`Website: ${url.hostname}${url.pathname}`);
      } catch {
        parts.push(`URL: ${this.currentApp.browserURL}`);
      }
    }
    if (this.currentApp.windowTitle) {
      parts.push(`Window: ${this.currentApp.windowTitle}`);
    }
    parts.push(`App: ${this.currentApp.processName}`);
    return parts.join(' | ');
  }

  async generateFirstMessage(): Promise<string> {
    this.chatHistory = [];
    const context = this.getDistractionContext();
    const firstPrompt = `You are MindGate, a strict but fair productivity AI mentor. The user is trying to access: ${context}

Your first message to them should be a brief, firm question asking why they need access. Keep it to one sentence. Be direct but not rude. Start your response with "MindGate:".`;
    const response = await this.ollamaService.generateRawResponse(firstPrompt);
    const clean = response.replace(/^MindGate:\s*/i, '').trim();
    this.chatHistory.push({ role: 'ai', content: clean, timestamp: Date.now() });
    return clean;
  }

  async sendChatMessage(userInput: string): Promise<ChatResponse> {
    if (!this.aiReadinessStatus.ready) {
      const readiness = this.getAIReadinessStatus(true);
      return {
        message: readiness.message,
        isApproved: null,
        readiness,
      };
    }

    this.chatHistory.push({ role: 'user', content: userInput, timestamp: Date.now() });
    this.trimChatHistory();

    const ollamaStatus = await this.getOllamaConnectionStatus();
    if (!ollamaStatus.connected) {
      return {
        message: ollamaStatus.message,
        isApproved: null,
      };
    }

    const context = this.getDistractionContext();
    let response: string;
    try {
      response = await this.ollamaService.chat(this.chatHistory, context);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        message: `MindGate AI error: ${errorMsg}`,
        isApproved: null,
      };
    }
    const cleanResponse = response.replace(/^MindGate:\s*/i, '').trim();

    this.chatHistory.push({ role: 'ai', content: cleanResponse, timestamp: Date.now() });
    this.trimChatHistory();

    if (this.parseKeyword(cleanResponse, 'APPROVED')) {
      const mins = this.parseDurationMinutes(cleanResponse);
      return { message: cleanResponse, isApproved: true, durationMinutes: mins };
    }

    if (this.parseKeyword(cleanResponse, 'DENIED')) {
      return { message: cleanResponse, isApproved: false };
    }

    return { message: cleanResponse, isApproved: null };
  }

  private trimChatHistory(): void {
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY);
    }
  }

  private parseKeyword(response: string, keyword: string): boolean {
    return response.toUpperCase().includes(keyword);
  }

  private parseDurationMinutes(response: string): number {
    const match = response.match(/APPROVED\s*[:]?\s*(\d+)/i);
    if (match) {
      const mins = parseInt(match[1], 10);
      if ([5, 10, 15].includes(mins)) return mins;
    }
    return 10;
  }

  resetChat(): void {
    this.chatHistory = [];
  }

  async evaluateRequest(userInput: string): Promise<{ isApproved: boolean; message: string }> {
    const systemPrompt = `
You are a highly advanced, strict productivity mentor. The user is trying to access a distracting app. Their reason is: '${userInput}'.
If this is genuinely essential for immediate work, task tracking, or safety, respond only with the word 'YES'.
If it is an excuse, mindless scrolling, or procrastination, reply only with the word 'NO'.

Current productive tasks: ${this.configuration.settings.productiveTasks.join(', ')}
Current productive apps: ${this.configuration.settings.productiveApps.join(', ')}
`;

    try {
      const ollamaStatus = await this.getOllamaConnectionStatus();
      if (!ollamaStatus.connected) {
        return {
          isApproved: false,
          message: ollamaStatus.message,
        };
      }

      const response = await this.ollamaService.generateRawResponse(systemPrompt);
      const isApproved = response.trim().toUpperCase().startsWith('YES');
      const message = isApproved
        ? 'Access approved. Please select a duration.'
        : 'Access denied. Stay focused on your work.';

      return { isApproved, message };
    } catch {
      return {
        isApproved: false,
        message: 'AI service unavailable. Access denied.',
      };
    }
  }

  grantAccess(duration: number): void {
    if (this.accessTimer) clearTimeout(this.accessTimer);
    this.grantedAppIdentifier = this.currentApp ? this.getAppIdentifier(this.currentApp) : null;
    this.accessExpiresAt = Date.now() + duration * 1000;

    this.accessTimer = setTimeout(() => {
      this.revokeAccessAndReappear();
    }, duration * 1000);
  }

  revokeAccessAndReappear(): void {
    if (this.accessTimer) {
      clearTimeout(this.accessTimer);
      this.accessTimer = null;
    }
    const expiredIdentifier = this.grantedAppIdentifier;
    this.grantedAppIdentifier = null;
    this.accessExpiresAt = null;
    this.onAccessExpired?.(expiredIdentifier);
  }

  expireAccessIfNeeded(): void {
    if (this.accessExpiresAt !== null && this.accessExpiresAt <= Date.now()) {
      this.revokeAccessAndReappear();
    }
  }

  hasActiveAccess(app: ActiveWindowInfo): boolean {
    if (!this.grantedAppIdentifier || !this.accessExpiresAt) {
      return false;
    }

    if (this.accessExpiresAt <= Date.now()) {
      return false;
    }

    return this.grantedAppIdentifier === this.getAppIdentifier(app);
  }

  cancelAccessTimer(): void {
    if (this.accessTimer) clearTimeout(this.accessTimer);
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
    this.ollamaService.updateConfig(config.settings.ollamaURL, config.settings.ollamaModel);
  }

  onAccessExpired?: (appIdentifier: string | null) => void;
}
