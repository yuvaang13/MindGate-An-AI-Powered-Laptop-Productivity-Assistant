import { DecisionResult, ChatMessage, OllamaConnectionStatus } from '../types.js';

interface TagsResponse {
  models?: Array<{ name: string }>;
}

export class OllamaService {
  private baseURL: string;
  private model: string;
  private retryCount: number = 0;
  private baseRetryDelay: number = 1000;
  private cachedConnectionStatus: boolean | null = null;
  private cachedConnectionTime: number = 0;
  private connectionCacheTTL: number = 10000;

  constructor(baseURL: string, model: string) {
    this.baseURL = baseURL;
    this.model = model;
  }

  private getApiOrigin(): string {
    try {
      const url = new URL(this.baseURL);
      return `${url.protocol}//${url.host}`;
    } catch {
      return this.baseURL.replace(/\/api\/generate\/?$/, '').replace(/\/$/, '');
    }
  }

  private getTagsUrl(): string {
    return `${this.getApiOrigin()}/api/tags`;
  }

  async checkConnection(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedConnectionStatus !== null && now - this.cachedConnectionTime < this.connectionCacheTTL) {
      return this.cachedConnectionStatus;
    }

    const status = await this.getConnectionStatus();
    return status.connected;
  }

  async getConnectionStatus(): Promise<OllamaConnectionStatus> {
    const status = await this.fetchConnectionStatus();
    this.cachedConnectionStatus = status.connected;
    this.cachedConnectionTime = Date.now();
    return status;
  }

  private async fetchConnectionStatus(): Promise<OllamaConnectionStatus> {
    const origin = this.getApiOrigin();
    const configuredModel = this.model;

    try {
      const data = await this.fetchTags();
      const availableModels = (data.models || []).map((m) => m.name);
      const modelAvailable = availableModels.some((m) => this.modelMatches(m, configuredModel));

      if (modelAvailable) {
        return {
          connected: true,
          message: 'Ollama is ready.',
          origin,
          configuredModel,
          activeModel: configuredModel,
          modelAvailable: true,
          availableModels,
        };
      }

      const fallbackModel = this.selectBestAvailableModel(availableModels);
      if (fallbackModel) {
        this.model = fallbackModel;
        return {
          connected: true,
          message: `Ollama is ready using fallback model ${fallbackModel}.`,
          origin,
          configuredModel,
          activeModel: fallbackModel,
          modelAvailable: false,
          availableModels,
        };
      }

      return {
        connected: false,
        message: `Ollama is reachable, but model "${configuredModel}" is not installed. Install it with: ollama pull ${configuredModel}`,
        origin,
        configuredModel,
        activeModel: configuredModel,
        modelAvailable: false,
        availableModels,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        connected: false,
        message: `Ollama is not reachable at ${origin}. Start Ollama and make sure it is listening on ${origin}.`,
        origin,
        configuredModel,
        activeModel: configuredModel,
        modelAvailable: false,
        availableModels: [],
        error: message,
      };
    }
  }

  private async fetchTags(): Promise<TagsResponse> {
    const data = await this.fetchJson<TagsResponse>(this.getTagsUrl(), 2000);
    this.retryCount = 0;
    return data;
  }

  private modelMatches(available: string, requested: string): boolean {
    if (available === requested) return true;
    const [requestedName, requestedTag] = requested.split(':');
    const [availableName, availableTag] = available.split(':');
    if (availableName !== requestedName) return false;
    if (!requestedTag) return true;
    return availableTag === requestedTag;
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const data = await this.fetchTags();
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  private selectBestAvailableModel(models: string[]): string | null {
    if (models.length === 0) return null;
    const preferred = ['gemma3', 'llama3', 'llama', 'mistral', 'mixtral', 'phi', 'qwen', 'mathstral'];
    for (const name of preferred) {
      const match = models.find((m) => {
        const base = m.split(':')[0].toLowerCase();
        return base === name;
      });
      if (match) return match;
    }
    return models[0];
  }

  async getBestAvailableModel(): Promise<string | null> {
    return this.selectBestAvailableModel(await this.getAvailableModels());
  }

  private getRetryDelay(): number {
    return Math.min(this.baseRetryDelay * Math.pow(2, this.retryCount), 30000);
  }

  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.checkConnection()) {
        this.retryCount = 0;
        return true;
      }
      this.retryCount++;
      const delay = this.getRetryDelay();
      await this.sleep(delay);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async evaluateRequest(userInput: string): Promise<DecisionResult> {
    const systemPrompt = `Evaluate this request for distraction access: "${userInput}". Is this a valid, productive reason? Respond with JSON containing isApproved (true/false) and a brief message explaining the decision.`;

    try {
      const responseText = await this.generateRawResponse(systemPrompt);

      try {
        const parsed = JSON.parse(responseText);
        return {
          isApproved: parsed.isApproved ?? false,
          message: parsed.message ?? 'Unable to determine approval',
        };
      } catch {
        const isApproved =
          responseText.toLowerCase().includes('approved') ||
          responseText.toLowerCase().includes('valid');
        return {
          isApproved,
          message: responseText || 'No response from AI',
        };
      }
    } catch (error) {
      console.error('Ollama request failed:', error);
      return {
        isApproved: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async generateRawResponse(prompt: string, maxRetries: number = 1): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            options: {
              temperature: 0.7,
              top_p: 0.9,
            },
          }),
        });
        const body = await response.text();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        let data: { response?: string };
        try {
          data = JSON.parse(body);
        } catch {
          throw new Error('Ollama returned an invalid JSON response');
        }

        this.retryCount = 0;
        return (data.response || '').trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries - 1) {
          this.retryCount++;
          const delay = this.getRetryDelay();
          await this.sleep(delay);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('Ollama request failed');
  }

  private async fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  updateConfig(baseURL: string, model: string): void {
    this.baseURL = baseURL;
    this.model = model;
    this.retryCount = 0;
    this.cachedConnectionStatus = null;
    this.cachedConnectionTime = 0;
  }

  async chat(messages: ChatMessage[], distractionContext?: string): Promise<string> {
    const systemPrompt = `You are MindGate, a strict but fair productivity AI mentor. Your role is to help users stay focused by challenging their distractions.

Rules:
- You speak conversationally but remain firm.
- Your goal is to determine if the user genuinely needs access to a distracting website or app.
- Ask probing questions. Challenge weak excuses. Acknowledge legitimate needs.
- Keep responses concise (1-3 sentences).
- If you are fully convinced the user has a legitimate, time-sensitive reason, include the exact words "APPROVED 5", "APPROVED 10", or "APPROVED 15" in your response (choose 5 for quick tasks, 10 for moderate tasks, 15 for longer essential work).
- If the user fails to convince you, include the exact word "DENIED" in your response.

Distraction context: ${distractionContext || 'Accessing a distracting website or app'}

Conversation history:`;

    const conversationText = messages
      .map((m) => {
        const label = m.role === 'user' ? 'User' : 'MindGate';
        return `${label}: ${m.content}`;
      })
      .join('\n\n');

    const fullPrompt = `${systemPrompt}\n\n${conversationText}\n\nMindGate:`;
    return this.generateRawResponse(fullPrompt);
  }
}
