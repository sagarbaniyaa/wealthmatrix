import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-5');
  }

  async complete(params: {
    system: string;
    user: string;
    maxTokens?: number;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not configured on the backend. Set it in .env and restart the server.',
      );
    }

    let res: Response;
    try {
      res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: params.maxTokens ?? 1024,
          system: params.system,
          messages: [{ role: 'user', content: params.user }],
        }),
      });
    } catch (err) {
      this.logger.error(`Claude API network error: ${err}`);
      throw new ServiceUnavailableException(
        'Could not reach the Claude API — check your internet connection.',
      );
    }

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Claude API error ${res.status}: ${body}`);
      if (res.status === 401) {
        throw new ServiceUnavailableException(
          'Claude API rejected the API key (401) — check ANTHROPIC_API_KEY is correct.',
        );
      }
      if (res.status === 400 && body.includes('credit')) {
        throw new ServiceUnavailableException(
          'Claude API rejected the request — check billing/credits are set up on your Anthropic account.',
        );
      }
      throw new ServiceUnavailableException(`Claude API request failed (${res.status}).`);
    }

    const data = await res.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    return textBlock?.text ?? '';
  }

  async completeJSON<T>(params: { system: string; user: string; maxTokens?: number }): Promise<T> {
    const raw = await this.complete(params);
    const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}