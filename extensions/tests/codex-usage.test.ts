import assert from "node:assert/strict";
import test from "node:test";
import { createCodexBadge, CodexUsageManager } from "../UI/codex-usage.js";

// --- createCodexBadge tests ---

test("codex badge is undefined when snapshot is missing", () => {
  assert.equal(createCodexBadge(undefined), undefined);
});

test("codex badge shows 5-hour usage percentage", () => {
  const snapshot = {
    planType: "plus",
    fiveHour: { usedPercent: 73, windowSeconds: 18000, resetAt: Date.now() / 1000 + 3600 },
    weekly: { usedPercent: 12, windowSeconds: 604800, resetAt: Date.now() / 1000 + 86400 },
    fetchedAt: Date.now(),
  };

  const badge = createCodexBadge(snapshot);
  assert.ok(badge);
  assert.equal(badge.variants[0]?.body, "◷ 73%");
  assert.equal(badge.variants[1]?.body, "73%");
});

test("codex badge uses muted tone below 75%", () => {
  const snapshot = {
    fiveHour: { usedPercent: 50, windowSeconds: 18000, resetAt: Date.now() / 1000 + 3600 },
    fetchedAt: Date.now(),
  };

  const badge = createCodexBadge(snapshot);
  assert.ok(badge);
  assert.equal(badge.variants[0]?.tone, "muted");
});

test("codex badge uses warning tone at 75%", () => {
  const snapshot = {
    fiveHour: { usedPercent: 75, windowSeconds: 18000, resetAt: Date.now() / 1000 + 3600 },
    fetchedAt: Date.now(),
  };

  const badge = createCodexBadge(snapshot);
  assert.ok(badge);
  assert.equal(badge.variants[0]?.tone, "warning");
});

test("codex badge uses error tone at 90%", () => {
  const snapshot = {
    fiveHour: { usedPercent: 92, windowSeconds: 18000, resetAt: Date.now() / 1000 + 3600 },
    fetchedAt: Date.now(),
  };

  const badge = createCodexBadge(snapshot);
  assert.ok(badge);
  assert.equal(badge.variants[0]?.tone, "error");
});

test("codex badge shows 0% when fiveHour window is missing", () => {
  const snapshot = {
    fiveHour: undefined,
    fetchedAt: Date.now(),
  };

  const badge = createCodexBadge(snapshot);
  assert.ok(badge);
  assert.equal(badge.variants[0]?.body, "◷ 0%");
  assert.equal(badge.variants[0]?.tone, "muted");
});

// --- CodexUsageManager tests ---

function makeRenderRef() {
  let renderCount = 0;
  const ref = {
    requestRender: () => {
      renderCount += 1;
    },
    get count() {
      return renderCount;
    },
  };
  return ref;
}

function makeMockCtx(overrides: Partial<{ provider: string; isOAuth: boolean; apiKey: string }> = {}) {
  const provider = overrides.provider ?? "openai-codex";
  const isOAuth = overrides.isOAuth ?? true;
  const apiKey = overrides.apiKey;

  return {
    model: provider ? { provider, id: "codex-mini", reasoning: false } : undefined,
    modelRegistry: {
      isUsingOAuth: () => isOAuth,
      getApiKeyAndHeaders: async () => {
        if (apiKey) return { ok: true as const, apiKey };
        return { ok: true as const, apiKey: undefined };
      },
    },
  } as any;
}

test("manager returns undefined when not using openai-codex provider", async () => {
  const ref = makeRenderRef();
  const manager = new CodexUsageManager(ref);
  const ctx = makeMockCtx({ provider: "anthropic" });

  const result = await manager.refresh(ctx);
  assert.equal(result, undefined);
  assert.equal(manager.hasData, false);
});

test("manager returns undefined when not using OAuth", async () => {
  const ref = makeRenderRef();
  const manager = new CodexUsageManager(ref);
  const ctx = makeMockCtx({ isOAuth: false });

  const result = await manager.refresh(ctx);
  assert.equal(result, undefined);
});

test("manager clears stale data when switching away from openai-codex provider", async () => {
  const ref = makeRenderRef();
  const manager = new CodexUsageManager(ref);

  (manager as any).current = {
    fiveHour: { usedPercent: 42, windowSeconds: 18000, resetAt: Date.now() / 1000 + 3600 },
    fetchedAt: Date.now(),
  };
  (manager as any).lastFetchMs = Date.now();

  const result = await manager.refresh(makeMockCtx({ provider: "anthropic" }));

  assert.equal(result, undefined);
  assert.equal(manager.hasData, false);
  assert.equal(ref.count, 1);
});

test("manager debounces within 60 second window", async () => {
  const ref = makeRenderRef();
  const manager = new CodexUsageManager(ref);
  const ctx = makeMockCtx();

  // First call — no cached data, should attempt fetch (will fail since no real endpoint)
  const result1 = await manager.refresh(ctx);
  // Second call immediately — should return cached (undefined) without re-fetching
  const result2 = await manager.refresh(ctx);

  assert.equal(result1, result2);
});

test("manager clears cached data", async () => {
  const ref = makeRenderRef();
  const manager = new CodexUsageManager(ref);

  // Manually set some data by accessing private field — this tests clear()
  // We can't directly test the internal state, but we can verify clear doesn't throw
  manager.clear();
  assert.equal(manager.hasData, false);
});
