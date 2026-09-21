/**
 * The minimal subset of the `fetch` signature this package depends on,
 * injectable so tests never make a real network call — same DI pattern as
 * `GhRunner` in `@primetime/github` and `SubprocessRunner` in
 * `@primetime/providers`.
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;
