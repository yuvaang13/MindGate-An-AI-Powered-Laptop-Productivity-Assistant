import { OllamaService } from './ollamaService.js';
import { ActiveWindowInfo, ChatMessage, ChatResponse, Configuration } from '../types.js';

const MAX_CHAT_HISTORY = 40;

export class DecisionEngine {
  private ollamaService: OllamaService;
  private currentApp: ActiveWindowInfo | null = null;
  private accessTimer: NodeJS.Timeout | null = null;
  private grantedAppIdentifier: string | null = null;
  private accessExpiresAt: number | null = null;
  private chatHistory: ChatMessage[] = [];

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

  async getAvailableModels(): Promise<string[]> {
    return this.ollamaService.getAvailableModels();
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
    this.chatHistory.push({ role: 'user', content: userInput, timestamp: Date.now() });
    this.trimChatHistory();

    const context = this.getDistractionContext();
    let response: string;
    try {
      response = await this.ollamaService.chat(this.chatHistory, context);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        message: `MindGate AI error: ${errorMsg}`,
        isApproved: false,
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
