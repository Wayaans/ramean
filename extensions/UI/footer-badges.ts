import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ContextUsage, ExtensionContext, SessionEntry, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export type BadgeTone = "text" | "muted" | "dim" | "accent" | "warning" | "error" | "raw";
export type BadgeKind =
  | "path"
  | "gitBranch"
  | "input"
  | "output"
  | "cacheRead"
  | "cacheWrite"
  | "context"
  | "cost"
  | "provider"
  | "model"
  | "thinking"
  | "status";

export interface BadgeVariant {
  body: string;
  tone?: BadgeTone;
}

export interface BadgePlan {
  kind: BadgeKind;
  variants: readonly BadgeVariant[];
}

export interface ResolvedBadge {
  kind: BadgeKind;
  body: string;
  tone: BadgeTone;
}

export interface AssistantCostTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalCost: number;
}

export interface FooterSnapshot {
  cwd: string;
  contextUsage?: ContextUsage;
  totals: AssistantCostTotals;
  usingSubscription: boolean;
  provider?: string;
  modelId?: string;
  modelReasoning: boolean;
  thinkingLevel?: string;
}

export interface FooterRenderState {
  snapshot: FooterSnapshot;
  requestRender?: () => void;
}

type FooterLine =
  | {
      align: "split";
      left: ResolvedBadge[];
      right: ResolvedBadge[];
    }
  | {
      align: "left" | "right";
      badges: ResolvedBadge[];
    };

const PROVIDER_ABBREVIATIONS: Record<string, string> = {
  "amazon-bedrock": "bedrock",
  anthropic: "anth",
  "azure-openai-responses": "azure",
  cerebras: "cer",
  google: "goog",
  "google-antigravity": "antigrav",
  "google-gemini-cli": "gem-cli",
  "google-vertex": "vertex",
  groq: "groq",
  "github-copilot": "copilot",
  huggingface: "hf",
  kimi: "kimi",
  "kimi-coding": "kimi",
  minimax: "mini",
  "minimax-cn": "mini-cn",
  mistral: "mistral",
  opencode: "opcode",
  "opencode-go": "opcode",
  openai: "oai",
  "openai-codex": "codex",
  openrouter: "router",
  "vercel-ai-gateway": "vercel",
  xai: "xai",
  zai: "zai",
};

const TOKEN_ABBREVIATIONS: Record<string, string> = {
  anthropic: "anth",
  claude: "cld",
  codex: "codx",
  experimental: "exp",
  flash: "fl",
  gemini: "gmn",
  high: "hi",
  haiku: "hk",
  latest: "@",
  medium: "med",
  mini: "mini",
  minimal: "min",
  preview: "pre",
  reasoning: "rsn",
  sonnet: "snt",
  thinking: "thk",
  turbo: "trbo",
};

const PROVIDER_BADGE_ICON = "☁";
const MODEL_BADGE_ICON = "◈";
const BRANCH_BADGE_ICON = "⎇";
const PATH_BADGE_ICON = "⌂";

export function createFooterRenderState(): FooterRenderState {
  return {
    snapshot: emptyFooterSnapshot(),
  };
}

export function resetFooterRenderState(state: FooterRenderState): void {
  state.snapshot = emptyFooterSnapshot();
  state.requestRender = undefined;
}

export function createFooterSnapshot(ctx: ExtensionContext, thinkingLevel?: string): FooterSnapshot {
  const model = ctx.model;
  return {
    cwd: ctx.sessionManager.getCwd() || ctx.cwd,
    contextUsage: ctx.getContextUsage(),
    totals: aggregateAssistantCosts(ctx.sessionManager.getEntries()),
    usingSubscription: model ? ctx.modelRegistry.isUsingOAuth(model) : false,
    provider: model?.provider,
    modelId: model?.id,
    modelReasoning: Boolean(model?.reasoning),
    thinkingLevel: model?.reasoning ? thinkingLevel : undefined,
  };
}

export function updateFooterSnapshot(state: FooterRenderState, snapshot: FooterSnapshot): void {
  state.snapshot = snapshot;
  state.requestRender?.();
}

export function installFooterBadges(
  ctx: ExtensionContext,
  state: FooterRenderState,
  resolveThinkingLevel?: () => string | undefined,
): void {
  ctx.ui.setFooter((tui, theme, footerData) => {
    const requestRender = () => tui.requestRender();
    state.requestRender = requestRender;
    const unsubscribeBranch = footerData.onBranchChange(requestRender);

    return {
      dispose() {
        if (state.requestRender === requestRender) {
          state.requestRender = undefined;
        }
        unsubscribeBranch();
      },
      invalidate() {
        refreshDynamicSnapshot(state, resolveThinkingLevel);
      },
      render(width: number): string[] {
        refreshDynamicSnapshot(state, resolveThinkingLevel);
        const leftPlans = buildLeftPlans(state.snapshot, footerData.getGitBranch());
        const rightPlans = buildRightPlans(state.snapshot);
        const lines = buildRequiredLines(width, leftPlans, rightPlans);
        const statusLine = buildStatusLine(width, footerData.getExtensionStatuses());
        const renderedLines = lines.map((line) => renderFooterLine(theme, line, width));

        if (statusLine) {
          renderedLines.push(renderAlignedRow(theme, statusLine, width, "left"));
        }

        return renderedLines.map((line) => truncateToWidth(line, width, ""));
      },
    };
  });
}

export function createInputBadge(totalInput: number): BadgePlan | undefined {
  return createCountBadge("input", "↑", totalInput, "dim");
}

export function createOutputBadge(totalOutput: number): BadgePlan | undefined {
  return createCountBadge("output", "↓", totalOutput, "dim");
}

export function createCacheReadBadge(totalCacheRead: number): BadgePlan | undefined {
  return createCountBadge("cacheRead", "R", totalCacheRead, "dim");
}

export function createCacheWriteBadge(totalCacheWrite: number): BadgePlan | undefined {
  return createCountBadge("cacheWrite", "W", totalCacheWrite, "dim");
}

export function createContextBadge(usage: ContextUsage | undefined): BadgePlan {
  const percent = usage?.percent ?? null;
  const contextWindow = usage?.contextWindow ?? 0;
  const windowText = contextWindow > 0 ? formatCompactNumber(contextWindow) : "?";
  const fullPercent = percent === null ? "?" : `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
  const compactPercent = percent === null ? "?" : `${Math.round(percent)}%`;
  const tone = getContextTone(percent);

  return {
    kind: "context",
    variants: [
      { body: `◔ ${fullPercent}/${windowText}`, tone },
      { body: `◔ ${compactPercent}/${windowText}`, tone },
      { body: `${compactPercent}/${windowText}`, tone },
    ],
  };
}

export function aggregateAssistantCosts(entries: readonly SessionEntry[]): AssistantCostTotals {
  const totals: AssistantCostTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalCost: 0,
  };

  for (const entry of entries) {
    if (!isAssistantMessageEntry(entry)) continue;
    totals.input += entry.message.usage.input;
    totals.output += entry.message.usage.output;
    totals.cacheRead += entry.message.usage.cacheRead;
    totals.cacheWrite += entry.message.usage.cacheWrite;
    totals.totalCost += entry.message.usage.cost.total;
  }

  return totals;
}

export function createCostBadge(totals: AssistantCostTotals, usingSubscription = false): BadgePlan {
  const exact = `$${formatCost(totals.totalCost, 3)}`;
  const compact = `$${formatCost(totals.totalCost, totals.totalCost >= 10 ? 1 : 2)}`;
  const subscription = usingSubscription ? " sub" : "";

  return {
    kind: "cost",
    variants: [
      { body: `¤ ${exact}${subscription}`, tone: "muted" },
      { body: `¤ ${compact}${subscription}`, tone: "muted" },
      { body: `¤ ${compact}`, tone: "muted" },
    ],
  };
}

export function createPathBadge(filePath: string): BadgePlan {
  const shortened = shortenPathSegments(filePath);

  return {
    kind: "path",
    variants: [
      { body: `${PATH_BADGE_ICON} ${shortened.full}`, tone: "text" },
      { body: `${PATH_BADGE_ICON} ${shortened.compact}`, tone: "text" },
      { body: `${PATH_BADGE_ICON} ${shortened.icon}`, tone: "text" },
      { body: PATH_BADGE_ICON, tone: "text" },
    ],
  };
}

export function createGitBranchBadge(branch: string | null | undefined): BadgePlan | undefined {
  const full = sanitizeOptionalText(branch);
  if (!full) return undefined;

  const compact = abbreviateTokenSequence(full, 3);
  const icon = compact.length <= 3 ? compact : compact.slice(0, 3);

  return {
    kind: "gitBranch",
    variants: [
      { body: `${BRANCH_BADGE_ICON} ${full}`, tone: "muted" },
      { body: `${BRANCH_BADGE_ICON} ${compact}`, tone: "muted" },
      { body: `${BRANCH_BADGE_ICON} ${icon}`, tone: "muted" },
      { body: BRANCH_BADGE_ICON, tone: "muted" },
    ],
  };
}

export function createProviderBadge(provider: string | undefined): BadgePlan {
  const abbreviated = abbreviateProvider(provider);
  return {
    kind: "provider",
    variants: [
      { body: `${PROVIDER_BADGE_ICON} ${abbreviated.full}`, tone: "muted" },
      { body: `${PROVIDER_BADGE_ICON} ${abbreviated.compact}`, tone: "muted" },
      { body: `${PROVIDER_BADGE_ICON} ${abbreviated.icon}`, tone: "muted" },
      { body: PROVIDER_BADGE_ICON, tone: "muted" },
    ],
  };
}

export function createModelBadge(model: string | undefined, provider?: string): BadgePlan {
  const abbreviated = abbreviateModel(model, provider);
  return {
    kind: "model",
    variants: [
      { body: `${MODEL_BADGE_ICON} ${abbreviated.full}`, tone: "text" },
      { body: `${MODEL_BADGE_ICON} ${abbreviated.compact}`, tone: "text" },
      { body: `${MODEL_BADGE_ICON} ${abbreviated.icon}`, tone: "text" },
      { body: MODEL_BADGE_ICON, tone: "text" },
    ],
  };
}

export function createThinkingBadge(thinkingLevel: string | undefined): BadgePlan {
  const level = sanitizeValue(thinkingLevel, "off").toLowerCase();
  const tone = getThinkingTone(level);
  const full = level === "off" ? "◐ thinking off" : `◐ ${level}`;

  return {
    kind: "thinking",
    variants: [
      { body: full, tone },
      { body: `◐ ${level}`, tone },
      { body: level, tone },
    ],
  };
}

export function createStatusBadge(text: string): BadgePlan {
  const body = sanitizeStatusText(text);
  return {
    kind: "status",
    variants: [{ body, tone: "raw" }],
  };
}

export function negotiateBadgeLine(plans: readonly BadgePlan[], maxWidth: number, gap = 1): ResolvedBadge[] | null {
  if (plans.length === 0) return [];

  const indexes = plans.map(() => 0);
  let currentWidth = measureVariantLine(plans, indexes, gap);

  while (currentWidth > maxWidth) {
    let bestIndex = -1;
    let bestSavings = 0;

    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index]!;
      const variantIndex = indexes[index]!;
      if (variantIndex >= plan.variants.length - 1) continue;

      const currentVariant = resolveBadge(plan.kind, plan.variants[variantIndex]!);
      const nextVariant = resolveBadge(plan.kind, plan.variants[variantIndex + 1]!);
      const savings = badgeWidth(currentVariant) - badgeWidth(nextVariant);
      if (savings > bestSavings) {
        bestSavings = savings;
        bestIndex = index;
      }
    }

    if (bestIndex === -1) return null;
    indexes[bestIndex] += 1;
    currentWidth = measureVariantLine(plans, indexes, gap);
  }

  return plans.map((plan, index) => resolveBadge(plan.kind, plan.variants[indexes[index]!]!));
}

export function fitBadgeWithinWidth(plan: BadgePlan, maxWidth: number): ResolvedBadge {
  for (const variant of plan.variants) {
    const resolved = resolveBadge(plan.kind, variant);
    if (badgeWidth(resolved) <= maxWidth) return resolved;
  }

  const narrowest = resolveBadge(plan.kind, plan.variants[plan.variants.length - 1]!);
  const availableBodyWidth = Math.max(0, maxWidth - 2);
  return {
    ...narrowest,
    body: truncateToWidth(narrowest.body, availableBodyWidth),
  };
}

function refreshDynamicSnapshot(state: FooterRenderState, resolveThinkingLevel?: () => string | undefined): void {
  if (!resolveThinkingLevel) return;
  const thinkingLevel = resolveThinkingLevel();
  if (thinkingLevel === undefined || thinkingLevel === state.snapshot.thinkingLevel) return;
  state.snapshot = {
    ...state.snapshot,
    thinkingLevel,
  };
}

function buildLeftPlans(snapshot: FooterSnapshot, gitBranch: string | null): BadgePlan[] {
  return [
    createPathBadge(snapshot.cwd),
    createGitBranchBadge(gitBranch),
    createContextBadge(snapshot.contextUsage),
    createCostBadge(snapshot.totals, snapshot.usingSubscription),
    createInputBadge(snapshot.totals.input),
    createOutputBadge(snapshot.totals.output),
    createCacheReadBadge(snapshot.totals.cacheRead),
    createCacheWriteBadge(snapshot.totals.cacheWrite),
  ].filter(isBadgePlan);
}

function buildRightPlans(snapshot: FooterSnapshot): BadgePlan[] {
  const thinkingBadge = snapshot.modelReasoning ? createThinkingBadge(snapshot.thinkingLevel) : undefined;
  return [createProviderBadge(snapshot.provider), createModelBadge(snapshot.modelId, snapshot.provider), thinkingBadge].filter(
    isBadgePlan,
  );
}

function buildRequiredLines(width: number, leftPlans: readonly BadgePlan[], rightPlans: readonly BadgePlan[]): FooterLine[] {
  const combined = negotiateBadgeLine([...leftPlans, ...rightPlans], width);
  if (combined) {
    return [
      {
        align: "split",
        left: combined.slice(0, leftPlans.length),
        right: combined.slice(leftPlans.length),
      },
    ];
  }

  const lines: FooterLine[] = [];
  for (const badges of packBadgeGroup(leftPlans, width)) {
    lines.push({ align: "left", badges });
  }
  for (const badges of packBadgeGroup(rightPlans, width)) {
    lines.push({ align: "right", badges });
  }
  return lines;
}

function buildStatusLine(width: number, statuses: ReadonlyMap<string, string>): ResolvedBadge[] | undefined {
  const statusPlans = Array.from(statuses.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([, text]) => createStatusBadge(text))
    .filter((plan) => plan.variants[0]?.body);

  if (statusPlans.length === 0) return undefined;

  const accepted: BadgePlan[] = [];
  for (const plan of statusPlans) {
    const candidate = [...accepted, plan];
    if (negotiateBadgeLine(candidate, width)) {
      accepted.push(plan);
    }
  }

  if (accepted.length === 0) return undefined;
  return negotiateBadgeLine(accepted, width) ?? undefined;
}

function packBadgeGroup(plans: readonly BadgePlan[], width: number): ResolvedBadge[][] {
  const lines: ResolvedBadge[][] = [];
  let index = 0;

  while (index < plans.length) {
    let end = plans.length;
    let resolved: ResolvedBadge[] | null = null;

    while (end > index) {
      const slice = plans.slice(index, end);
      resolved = negotiateBadgeLine(slice, width);
      if (resolved) break;
      end -= 1;
    }

    if (resolved) {
      lines.push(resolved);
      index = end;
      continue;
    }

    lines.push([fitBadgeWithinWidth(plans[index]!, width)]);
    index += 1;
  }

  return lines;
}

function renderFooterLine(theme: Theme, line: FooterLine, width: number): string {
  if (line.align === "split") {
    const left = renderBadgeRow(theme, line.left);
    const right = renderBadgeRow(theme, line.right);
    const padding = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
    return truncateToWidth(left + padding + right, width, "");
  }

  return renderAlignedRow(theme, line.badges, width, line.align);
}

function renderAlignedRow(theme: Theme, badges: readonly ResolvedBadge[], width: number, align: "left" | "right"): string {
  const row = renderBadgeRow(theme, badges);
  if (align === "right") {
    const padding = " ".repeat(Math.max(0, width - visibleWidth(row)));
    return truncateToWidth(padding + row, width, "");
  }
  return truncateToWidth(row, width, "");
}

function renderBadgeRow(theme: Theme, badges: readonly ResolvedBadge[]): string {
  return badges.map((badge) => renderBadge(theme, badge)).join(" ");
}

function renderBadge(theme: Theme, badge: ResolvedBadge): string {
  return theme.fg("border", "[") + applyTone(theme, badge.tone, badge.body) + theme.fg("border", "]");
}

function applyTone(theme: Theme, tone: BadgeTone, text: string): string {
  switch (tone) {
    case "accent":
      return theme.fg("accent", text);
    case "warning":
      return theme.fg("warning", text);
    case "error":
      return theme.fg("error", text);
    case "dim":
      return theme.fg("dim", text);
    case "muted":
      return theme.fg("muted", text);
    case "raw":
      return text;
    default:
      return theme.fg("text", text);
  }
}

function createCountBadge(kind: BadgeKind, icon: string, value: number, tone: BadgeTone): BadgePlan | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const formatted = formatCompactNumber(value);
  return {
    kind,
    variants: [
      { body: `${icon} ${formatted}`, tone },
      { body: formatted, tone },
    ],
  };
}

function sanitizeStatusText(text: string): string {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

function shortenPathWithTilde(filePath: string, homeDir = process.env.HOME ?? process.env.USERPROFILE): string {
  const normalizedPath = normalizePath(filePath || ".");
  const normalizedHome = homeDir ? normalizePath(homeDir) : undefined;

  if (!normalizedHome) return normalizedPath;
  if (normalizedPath === normalizedHome) return "~";
  if (normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~${normalizedPath.slice(normalizedHome.length)}`;
  }
  return normalizedPath;
}

function shortenPathSegments(
  filePath: string,
  segmentWidth = 1,
  keepTail = 2,
): { full: string; compact: string; icon: string } {
  const full = shortenPathWithTilde(filePath);
  const { prefix, segments } = splitPath(full);

  if (segments.length <= keepTail) {
    return {
      full,
      compact: full,
      icon: full,
    };
  }

  const compactHead = segments
    .slice(0, -keepTail)
    .map((segment) => segment.slice(0, Math.max(1, segmentWidth)) || segment);
  const tail = segments.slice(-keepTail);

  const compact = joinPath(prefix, [...compactHead, ...tail]);
  const icon = prefix === "~/" ? `~/.../${tail.join("/")}` : `.../${tail.join("/")}`;

  return {
    full,
    compact,
    icon,
  };
}

function abbreviateProvider(provider: string | undefined): { full: string; compact: string; icon: string } {
  const full = sanitizeValue(provider, "none");
  const compact = PROVIDER_ABBREVIATIONS[full.toLowerCase()] ?? abbreviateTokenSequence(full, 3);
  const icon = compact.length <= 3 ? compact : compact.slice(0, 3);

  return { full, compact, icon };
}

function abbreviateModel(model: string | undefined, provider?: string): { full: string; compact: string; icon: string } {
  const raw = sanitizeValue(model, "no-model");
  const withoutPrefix = stripProviderPrefix(raw, provider);
  const full = withoutPrefix || raw;

  return {
    full,
    compact: abbreviateTokenSequence(full, 4),
    icon: abbreviateTokenSequence(full, 2),
  };
}

function badgeText(badge: Pick<BadgeVariant, "body">): string {
  return `[${badge.body}]`;
}

function badgeWidth(badge: Pick<BadgeVariant, "body">): number {
  return visibleWidth(badgeText(badge));
}

function badgeLineWidth(badges: readonly Pick<BadgeVariant, "body">[], gap = 1): number {
  if (badges.length === 0) return 0;
  return badges.reduce((total, badge, index) => total + badgeWidth(badge) + (index > 0 ? gap : 0), 0);
}

function sanitizeOptionalText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const sanitized = sanitizeStatusText(value);
  return sanitized || undefined;
}

function resolveBadge(kind: BadgeKind, variant: BadgeVariant): ResolvedBadge {
  return {
    kind,
    body: variant.body,
    tone: variant.tone ?? defaultToneFor(kind),
  };
}

function measureVariantLine(plans: readonly BadgePlan[], indexes: readonly number[], gap: number): number {
  const badges = plans.map((plan, index) => resolveBadge(plan.kind, plan.variants[indexes[index]!]!));
  return badgeLineWidth(badges, gap);
}

function defaultToneFor(kind: BadgeKind): BadgeTone {
  switch (kind) {
    case "input":
    case "output":
    case "cacheRead":
    case "cacheWrite":
      return "dim";
    case "gitBranch":
    case "context":
    case "cost":
    case "provider":
    case "thinking":
      return "muted";
    case "status":
      return "raw";
    default:
      return "text";
  }
}

function getContextTone(percent: number | null): BadgeTone {
  if (percent === null) return "muted";
  if (percent >= 90) return "error";
  if (percent >= 75) return "warning";
  return "muted";
}

function getThinkingTone(level: string): BadgeTone {
  switch (level) {
    case "off":
      return "dim";
    case "medium":
    case "high":
    case "xhigh":
      return "accent";
    default:
      return "muted";
  }
}

function formatCompactNumber(value: number): string {
  if (value < 1_000) return `${value}`;
  if (value < 10_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value < 1_000_000) return `${Math.round(value / 1_000)}k`;
  if (value < 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${Math.round(value / 1_000_000)}M`;
}

function formatCost(value: number, digits: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return digits > 0 ? `0.${"0".repeat(digits)}` : "0";
  }
  return value.toFixed(Math.max(0, digits));
}

function sanitizeValue(value: string | undefined, fallback: string): string {
  const sanitized = value?.trim();
  return sanitized ? sanitized : fallback;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function splitPath(filePath: string): { prefix: string; segments: string[] } {
  const normalized = normalizePath(filePath);
  let remainder = normalized;
  let prefix = "";

  if (remainder === "~") return { prefix: "~/", segments: [] };
  if (remainder.startsWith("~/")) {
    prefix = "~/";
    remainder = remainder.slice(2);
  } else if (/^[A-Za-z]:\//.test(remainder)) {
    prefix = remainder.slice(0, 3);
    remainder = remainder.slice(3);
  } else if (remainder.startsWith("/")) {
    prefix = "/";
    remainder = remainder.slice(1);
  }

  return {
    prefix,
    segments: remainder.split("/").filter(Boolean),
  };
}

function joinPath(prefix: string, segments: readonly string[]): string {
  const joined = segments.join("/");
  if (!prefix) return joined || ".";
  if (!joined) return prefix === "~/" ? "~" : prefix;
  return `${prefix}${joined}`;
}

function stripProviderPrefix(model: string, provider?: string): string {
  let stripped = model.replace(/^models\//i, "");
  if (provider) {
    const escapedProvider = provider.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    stripped = stripped.replace(new RegExp(`^${escapedProvider}[/:_-]?`, "i"), "");
  }
  return stripped.replace(/^models\//i, "");
}

function abbreviateTokenSequence(value: string, tokenWidth: number): string {
  const tokens = value.split(/[/:._-]+/).filter(Boolean);
  if (tokens.length === 0) return value;

  return tokens
    .map((token) => abbreviateToken(token, tokenWidth))
    .join("-")
    .replace(/-@/g, "@")
    .replace(/--+/g, "-");
}

function abbreviateToken(token: string, maxWidth: number): string {
  if (!token) return token;
  if (/^\d+$/.test(token)) return token;

  const lower = token.toLowerCase();
  const mapped = TOKEN_ABBREVIATIONS[lower];
  if (mapped) return mapped;
  if (token.length <= maxWidth) return lower;

  const consonants = lower[0] + lower.slice(1).replace(/[aeiou]/g, "");
  if (consonants.length <= maxWidth) return consonants;
  return consonants.slice(0, Math.max(1, maxWidth));
}

function emptyFooterSnapshot(): FooterSnapshot {
  return {
    cwd: process.cwd(),
    totals: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalCost: 0,
    },
    usingSubscription: false,
    modelReasoning: false,
  };
}

function isBadgePlan(plan: BadgePlan | undefined): plan is BadgePlan {
  return Boolean(plan);
}

function isAssistantMessageEntry(entry: SessionEntry): entry is Extract<SessionEntry, { type: "message" }> & {
  message: AssistantMessage;
} {
  return entry.type === "message" && entry.message.role === "assistant";
}
