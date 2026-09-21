import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyExecFailure,
  classifyLoginStatus,
  isAcceptedNonApiAuth,
} from "../src/codex/classification.js";

test("classifies a ChatGPT login as accepted", () => {
  const category = classifyLoginStatus(0, "Logged in using ChatGPT");
  assert.equal(category, "chatgpt");
  assert.equal(isAcceptedNonApiAuth(category), true);
});

test("classifies an access token login as accepted", () => {
  const category = classifyLoginStatus(0, "Logged in using a Codex access token");
  assert.equal(category, "access_token");
  assert.equal(isAcceptedNonApiAuth(category), true);
});

test("classifies a workload identity login as accepted", () => {
  const category = classifyLoginStatus(0, "Logged in using workload identity");
  assert.equal(category, "workload_identity");
  assert.equal(isAcceptedNonApiAuth(category), true);
});

test("classifies an unrecognized but logged-in message as other non-API", () => {
  const category = classifyLoginStatus(0, "Logged in using some future method");
  assert.equal(category, "other_non_api");
  assert.equal(isAcceptedNonApiAuth(category), true);
});

test("rejects an API key login even when the process reports success", () => {
  const category = classifyLoginStatus(0, "Logged in using an API key");
  assert.equal(category, "api_key");
  assert.equal(isAcceptedNonApiAuth(category), false);
});

test("rejects when the CLI reports no login", () => {
  const category = classifyLoginStatus(0, "Not logged in");
  assert.equal(category, "not_logged_in");
  assert.equal(isAcceptedNonApiAuth(category), false);
});

test("rejects a nonzero exit code regardless of stdout wording", () => {
  const category = classifyLoginStatus(1, "");
  assert.equal(category, "not_logged_in");
  assert.equal(isAcceptedNonApiAuth(category), false);
});

test("rejects unrecognized output rather than guessing it is a pass", () => {
  const category = classifyLoginStatus(0, "some unexpected future output shape");
  assert.equal(category, "unknown");
  assert.equal(isAcceptedNonApiAuth(category), false);
});

test("classifies a missing executable ahead of any other signal", () => {
  const category = classifyExecFailure({
    exitCode: null,
    timedOut: true,
    executableMissing: true,
    output: "rate limit exceeded",
  });
  assert.equal(category, "cli_unavailable");
});

test("classifies a timeout ahead of stderr pattern matching", () => {
  const category = classifyExecFailure({
    exitCode: null,
    timedOut: true,
    executableMissing: false,
    output: "not authenticated",
  });
  assert.equal(category, "timeout");
});

test("classifies an authentication failure from stderr wording", () => {
  const category = classifyExecFailure({
    exitCode: 1,
    timedOut: false,
    executableMissing: false,
    output: "Error: not authenticated. Please log in.",
  });
  assert.equal(category, "authentication_required");
});

test("classifies a rate limit failure from stderr wording", () => {
  const category = classifyExecFailure({
    exitCode: 1,
    timedOut: false,
    executableMissing: false,
    output: "Error: usage limit reached for this account",
  });
  assert.equal(category, "rate_limited");
});

test("falls back to unknown_failure for an unrecognized nonzero exit", () => {
  const category = classifyExecFailure({
    exitCode: 17,
    timedOut: false,
    executableMissing: false,
    output: "some future error shape",
  });
  assert.equal(category, "unknown_failure");
});
