import assert from "node:assert/strict";
import test from "node:test";
import {
  createFooterRenderState,
  createGitBranchBadge,
  createModelBadge,
  createPathBadge,
  createProviderBadge,
  installFooterBadges,
} from "../UI/footer-badges.js";

test("path badge keeps the path separate from git branch", () => {
  const badge = createPathBadge("/Users/test/worktrees/ramean/project");

  assert.deepEqual(
    badge.variants.map((variant) => variant.body),
    [
      "⌂ /Users/test/worktrees/ramean/project",
      "⌂ /U/t/w/ramean/project",
      "⌂ .../ramean/project",
      "⌂",
    ],
  );
});

test("git branch badge uses a dedicated badge with icon prefix", () => {
  const badge = createGitBranchBadge("feature/footer-redesign");

  assert.ok(badge);
  assert.deepEqual(
    badge.variants.map((variant) => variant.body),
    ["⎇ feature/footer-redesign", "⎇ ftr-ftr-rds", "⎇ ftr", "⎇"],
  );
});

test("provider badge uses an icon prefix in every variant", () => {
  const badge = createProviderBadge("amazon-bedrock");

  assert.deepEqual(
    badge.variants.map((variant) => variant.body),
    ["☁ amazon-bedrock", "☁ bedrock", "☁ bed", "☁"],
  );
});

test("model badge uses an icon prefix in every variant", () => {
  const badge = createModelBadge("openai/gpt-4.1", "openai");

  assert.deepEqual(
    badge.variants.map((variant) => variant.body),
    ["◈ gpt-4.1", "◈ gpt-4-1", "◈ gp-4-1", "◈"],
  );
});

test("footer invalidate refreshes the thinking badge", () => {
  let footerFactory: ((tui: any, theme: any, footerData: any) => any) | undefined;
  let thinkingLevel = "medium";
  const state = createFooterRenderState();
  state.snapshot = {
    cwd: "/tmp/project",
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalCost: 0 },
    usingSubscription: false,
    provider: "github-copilot",
    modelId: "gpt-5.4",
    modelReasoning: true,
    thinkingLevel,
  };

  installFooterBadges(
    {
      ui: {
        setFooter(factory: any) {
          footerFactory = factory;
        },
      },
    } as any,
    state,
    () => thinkingLevel,
  );

  assert.ok(footerFactory);

  const component = footerFactory!(
    { requestRender() {} },
    { fg(_token: string, text: string) { return text; } },
    {
      getGitBranch() {
        return "main";
      },
      getExtensionStatuses() {
        return new Map();
      },
      onBranchChange() {
        return () => {};
      },
    },
  );

  assert.match(component.render(200).join("\n"), /\[◐ medium\]/);

  thinkingLevel = "high";
  component.invalidate();

  assert.match(component.render(200).join("\n"), /\[◐ high\]/);
});

test("footer branch watcher requests render and shows the latest branch", () => {
  let footerFactory: ((tui: any, theme: any, footerData: any) => any) | undefined;
  let branch = "main";
  let requestRenderCount = 0;
  let onBranchChange: (() => void) | undefined;
  const state = createFooterRenderState();
  state.snapshot = {
    cwd: "/tmp/project",
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalCost: 0 },
    usingSubscription: false,
    provider: "github-copilot",
    modelId: "gpt-5.4",
    modelReasoning: false,
  };

  installFooterBadges(
    {
      ui: {
        setFooter(factory: any) {
          footerFactory = factory;
        },
      },
    } as any,
    state,
  );

  assert.ok(footerFactory);

  const component = footerFactory!(
    {
      requestRender() {
        requestRenderCount += 1;
      },
    },
    { fg(_token: string, text: string) { return text; } },
    {
      getGitBranch() {
        return branch;
      },
      getExtensionStatuses() {
        return new Map();
      },
      onBranchChange(callback: () => void) {
        onBranchChange = callback;
        return () => {
          onBranchChange = undefined;
        };
      },
    },
  );

  assert.match(component.render(200).join("\n"), /\[⎇ main\]/);

  branch = "feature/live-branch";
  onBranchChange?.();

  assert.equal(requestRenderCount, 1);
  assert.match(component.render(200).join("\n"), /\[⎇ feature\/live-branch\]/);
});
