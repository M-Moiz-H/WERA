export interface WarEraClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface WarEraRequestOptions {
  signal?: AbortSignal;
}

export interface WarEraRateLimit {
  remaining?: number;
  total?: number;
  reset?: number;
}

export class WarEraApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  public readonly rateLimit: WarEraRateLimit;

  constructor(
    status: number,
    body: unknown,
    rateLimit: WarEraRateLimit = {},
  ) {
    super(`WarEra API request failed with HTTP ${status}`);
    this.name = "WarEraApiError";
    this.status = status;
    this.body = body;
    this.rateLimit = rateLimit;
  }
}

export class WarEraClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  public constructor(options: WarEraClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (
      options.baseUrl ?? "https://api2.warera.io/trpc"
    ).replace(/\/+$/, "");

    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  public async call<TResponse = unknown>(
    procedure: string,
    input: unknown = {},
    options: WarEraRequestOptions = {},
  ): Promise<TResponse> {
    if (!procedure.trim()) {
      throw new Error("WarEra procedure name cannot be empty.");
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.request<TResponse>(
          procedure,
          input,
          options.signal,
        );
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === this.maxRetries) {
          throw error;
        }

        await this.sleep(this.retryDelay(attempt));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("WarEra request failed.");
  }

  private async request<TResponse>(
    procedure: string,
    input: unknown,
    externalSignal?: AbortSignal,
  ): Promise<TResponse> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    const abortListener = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", abortListener, {
          once: true,
        });
      }
    }

    try {
      const url =
        `${this.baseUrl}/${encodeURIComponent(procedure)}` +
        "?batch=0";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        },
        body: JSON.stringify({
          json: input,
        }),
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

      const rateLimit: WarEraRateLimit = {};
      const remaining = this.parseHeader(
        response.headers.get("ratelimit-remaining"),
      );
      const total = this.parseHeader(
        response.headers.get("ratelimit-limit"),
      );
      const reset = this.parseHeader(
        response.headers.get("ratelimit-reset"),
      );

      if (remaining !== undefined) rateLimit.remaining = remaining;
      if (total !== undefined) rateLimit.total = total;
      if (reset !== undefined) rateLimit.reset = reset;

      if (!response.ok) {
        throw new WarEraApiError(
          response.status,
          body,
          rateLimit,
        );
      }

      return this.unwrapTRPCResponse<TResponse>(body);
    } finally {
      clearTimeout(timeout);

      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortListener);
      }
    }
  }

  private unwrapTRPCResponse<T>(body: unknown): T {
    if (
      body !== null &&
      typeof body === "object" &&
      "result" in body
    ) {
      const result = (body as {
        result?: {
          data?: unknown;
        };
      }).result;

      if (result && "data" in result) {
        return result.data as T;
      }
    }

    return body as T;
  }

  private shouldRetry(error: unknown): boolean {
    if (!(error instanceof WarEraApiError)) {
      return false;
    }

    return (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    );
  }

  private retryDelay(attempt: number): number {
    const base = 250 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 150);

    return Math.min(base + jitter, 5_000);
  }

  private parseHeader(value: string | null): number | undefined {
    if (value === null) {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
