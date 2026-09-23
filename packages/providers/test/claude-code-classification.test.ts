import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAuthStatus,
  classifyExecFailure,
  isAcceptedNonApiAuth,
} from "../src/claude-code/classification.js";

// Fixtures below are shaped exactly like real `claude` 2.1.278 output,
// captured live during planning (see the plan doc) rather than guessed.

const SUBSCRIPTION_LOGIN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: "claude.ai",
  apiProvider: "firstParty",
  email: "user@example.com",
  subscriptionType: "team",
});

const OAUTH_TOKEN_LOGIN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: "oauth_token",
  apiProvider: "firstParty",
});

const API_KEY_LOGIN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: "claude.ai",
  apiProvider: "firstParty",
  apiKeySource: "ANTHROPIC_API_KEY",
  email: null,
});

const NOT_LOGGED_IN_JSON = JSON.stringify({ loggedIn: false });

test("classifyAuthStatus accepts a claude.ai subscription login", () => {
  assert.equal(classifyAuthStatus(0, SUBSCRIPTION_LOGIN_JSON), "subscription");
});

test("classifyAuthStatus accepts a CI oauth_token login", () => {
  assert.equal(classifyAuthStatus(0, OAUTH_TOKEN_LOGIN_JSON), "oauth_token");
});

test("classifyAuthStatus rejects an API-key-backed login even when loggedIn is true", () => {
  assert.equal(classifyAuthStatus(0, API_KEY_LOGIN_JSON), "api_key");
});

test("classifyAuthStatus treats loggedIn: false as not logged in", () => {
  assert.equal(classifyAuthStatus(1, NOT_LOGGED_IN_JSON), "not_logged_in");
});

test("classifyAuthStatus treats a nonzero exit code as not logged in even if loggedIn were somehow true", () => {
  assert.equal(classifyAuthStatus(1, SUBSCRIPTION_LOGIN_JSON), "not_logged_in");
});

test("classifyAuthStatus never treats unparsable output as a pass", () => {
  assert.equal(classifyAuthStatus(0, "not json"), "unknown");
});

test("isAcceptedNonApiAuth accepts subscription, oauth_token, and cloud_provider only", () => {
  assert.equal(isAcceptedNonApiAuth("subscription"), true);
  assert.equal(isAcceptedNonApiAuth("oauth_token"), true);
  assert.equal(isAcceptedNonApiAuth("cloud_provider"), true);
  assert.equal(isAcceptedNonApiAuth("api_key"), false);
  assert.equal(isAcceptedNonApiAuth("not_logged_in"), false);
  assert.equal(isAcceptedNonApiAuth("unknown"), false);
});

const INVALID_TOKEN_RESULT_JSON = JSON.stringify({
  is_error: true,
  api_error_status: 401,
  result: "Failed to authenticate. API Error: 401 Invalid bearer token",
});

const RATE_LIMITED_RESULT_JSON = JSON.stringify({
  is_error: true,
  api_error_status: 429,
  result: "Rate limit reached",
});

test("classifyExecFailure reports cli_unavailable when the executable is missing, before inspecting output", () => {
  assert.equal(
    classifyExecFailure({
      exitCode: null,
      timedOut: false,
      executableMissing: true,
      stdout: INVALID_TOKEN_RESULT_JSON,
    }),
    "cli_unavailable",
  );
});

test("classifyExecFailure reports timeout, before inspecting output", () => {
  assert.equal(
    classifyExecFailure({
      exitCode: null,
      timedOut: true,
      executableMissing: false,
      stdout: INVALID_TOKEN_RESULT_JSON,
    }),
    "timeout",
  );
});

test("classifyExecFailure classifies a real 401 invalid-bearer-token result", () => {
  assert.equal(
    classifyExecFailure({
      exitCode: 1,
      timedOut: false,
      executableMissing: false,
      stdout: INVALID_TOKEN_RESULT_JSON,
    }),
    "authentication_required",
  );
});

test("classifyExecFailure classifies a 429 rate-limit result", () => {
  assert.equal(
    classifyExecFailure({
      exitCode: 1,
      timedOut: false,
      executableMissing: false,
      stdout: RATE_LIMITED_RESULT_JSON,
    }),
    "rate_limited",
  );
});

test("classifyExecFailure falls back to unknown_failure for unparsable output", () => {
  assert.equal(
    classifyExecFailure({
      exitCode: 1,
      timedOut: false,
      executableMissing: false,
      stdout: "not json",
    }),
    "unknown_failure",
  );
});
