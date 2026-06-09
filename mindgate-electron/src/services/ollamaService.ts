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

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL.replace('/api/generate', '/api/tags')}`, {
        method: 'GET'
      });
      const isSuccess = response.ok;
      if (isSuccess) {
        this.retryCount = 0;
      }
      return isSuccess;
    } catch (error) {
      console.error('Ollama connection failed:', error);
      return false;
    }
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async evaluateRequest(userInput: string): Promise<DecisionResult> {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: `Evaluate this request for distraction access: "${userInput}". Is this a valid, productive reason? Respond with JSON containing isApproved (true/false) and a brief message explaining the decision.`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.response || data.message || '';

      try {
        const parsed = JSON.parse(responseText);
        return {
          isApproved: parsed.isApproved ?? false,
          message: parsed.message ?? 'Unable to determine approval'
        };
      } catch {
        const isApproved = responseText.toLowerCase().includes('approved') ||
                          responseText.toLowerCase().includes('valid');
        return {
          isApproved,
          message: responseText || 'No response from AI'
        };
      }
    } catch (error) {
      console.error('Ollama request failed:', error);
      return {
        isApproved: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async generateRawResponse(prompt: string, _maxRetries: number = 3): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < _maxRetries; attempt++) {
      try {
        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            options: {
              temperature: 0.7,
              top_p: 0.9
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.retryCount = 0;
        return (data.response || '').trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < _maxRetries - 1) {
          this.retryCount++;
          const delay = this.getRetryDelay();
          await this.sleep(delay);
        }
      }
    }
    
    console.error('Ollama raw request failed after retries:', lastError);
    throw lastError;
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
- If you are fully convinced the user has a legitimate, time-sensitive reason, include the exact word "APPROVED" in your response.
- If the user fails to convince you, include the exact word "DENIED" in your response.

Distraction context: ${distractionContext || 'Accessing a distracting website or app'}

Conversation history:`;

    const conversationText = messages.map(m => {
      const label = m.role === 'user' ? 'User' : 'MindGate';
      return `${label}: ${m.content}`;
    }).join('\n\n');

    const fullPrompt = `${systemPrompt}\n\n${conversationText}\n\nMindGate:`;
    return this.generateRawResponse(fullPrompt);
  }
}