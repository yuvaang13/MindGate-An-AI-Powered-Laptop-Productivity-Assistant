import { DecisionResult, ChatMessage } from '../types.js';

export class OllamaService {
  private baseURL: string;
  private model: string;
  private retryCount: number = 0;
  private baseRetryDelay: number = 1000;

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
    try {
      const tagsOk = await this.checkTagsEndpoint();
      if (!tagsOk) return false;
      const modelExists = await this.checkModelExists();
      if (!modelExists) {
        const fallback = await this.getBestAvailableModel();
        if (fallback) {
          console.log('[Ollama] Falling back to model:', fallback);
          this.model = fallback;
        }
        return fallback !== null;
      }
      return true;
    } catch (error) {
      console.error('[Ollama] Connection check failed:', error);
      return false;
    }
  }

  private async checkTagsEndpoint(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.getTagsUrl(), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        this.retryCount = 0;
      }
      return response.ok;
    } catch {
      return false;
    }
  }

  private modelMatches(available: string, requested: string): boolean {
    if (available === requested) return true;
    const [requestedName, requestedTag] = requested.split(':');
    const [availableName, availableTag] = available.split(':');
    if (availableName !== requestedName) return false;
    if (!requestedTag) return true;
    return availableTag === requestedTag;
  }

  private async checkModelExists(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.getTagsUrl(), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) return false;
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];
      return models.some((m) => this.modelMatches(m.name, this.model));
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.getTagsUrl(), {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  async getBestAvailableModel(): Promise<string | null> {
    const models = await this.getAvailableModels();
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
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: `Evaluate this request for distraction access: "${userInput}". Is this a valid, productive reason? Respond with JSON containing isApproved (true/false) and a brief message explaining the decision.`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as { response?: string; message?: string };
      const responseText = data.response || data.message || '';

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

  async generateRawResponse(prompt: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
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
        clearTimeout(timeout);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
        }

        const data = (await response.json()) as { response?: string };
        this.retryCount = 0;
        return (data.response || '').trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries - 1) {
          this.retryCount++;
          const delay = this.getRetryDelay();
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Ollama request failed');
  }

  updateConfig(baseURL: string, model: string): void {
    this.baseURL = baseURL;
    this.model = model;
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
