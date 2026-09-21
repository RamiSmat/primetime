import type { FetchLike } from "../../src/fetch-like.js";

export interface FakeFetchCall {
  readonly input: string;
  readonly init:
    | {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
      }
    | undefined;
}

export interface FakeFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

export function fakeFetchResponse(overrides: Partial<FakeFetchResponse> = {}): FakeFetchResponse {
  return { ok: true, status: 200, body: {}, ...overrides };
}

export class FakeFetch {
  public readonly calls: FakeFetchCall[] = [];

  public constructor(private readonly handler: (call: FakeFetchCall) => FakeFetchResponse) {}

  public readonly fetch: FetchLike = async (input, init) => {
    const call = { input, init };
    this.calls.push(call);
    const response = this.handler(call);
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    };
  };
}
