export interface WarEraClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface WarEraRequestOptions {
  signal?: AbortSignal;
}

export class WarEraApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`WarEra API request failed with HTTP ${status}`);
    this.name = "WarEraApiError";
    this.status = status;
    this.body = body;
  }
}

export class WarEraClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: WarEraClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api2.warera.io/trpc").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Generic tRPC procedure caller.
   *
   * We deliberately keep this low-level until each WERA procedure is
   * verified against the current WarEra schema. Verified typed wrappers
   * will be added later.
   */
  public async call<TResponse = unknown>(
    procedure: string,
    input: unknown = {},
    options: WarEraRequestOptions = {},
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(procedure)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let body: unknown = null;

      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!response.ok) {
        throw new WarEraApiError(response.status, body);
      }

      return body as TResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

