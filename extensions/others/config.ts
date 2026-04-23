import { readYamlFile } from "../core/config-file.js";
import { getDefaultConfigPath, getProjectConfigPath } from "../core/paths.js";
import { isRecord } from "../core/utils.js";
import type { OptionalExtensionName, OptionalExtensionsState } from "../types/others.js";

interface ExtractedOptionalExtensionsConfig {
  handoff?: boolean;
  notify?: boolean;
  minimalMode?: boolean;
  footerBadges?: boolean;
}

export function emptyOptionalExtensionsState(): OptionalExtensionsState {
  return {
    handoff: true,
    notify: true,
    minimalMode: true,
    footerBadges: true,
  };
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOptionalExtensionName(value: unknown): OptionalExtensionName | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "handoff") return "handoff";
  if (normalized === "notify") return "notify";
  if (normalized === "minimal-mode" || normalized === "minimal_mode") return "minimal-mode";
  if (
    normalized === "footer-badges" ||
    normalized === "footer_badges" ||
    normalized === "footer" ||
    normalized === "footer-redesign"
  ) {
    return "footer-badges";
  }
  return null;
}

function setExtensionEnabled(
  state: ExtractedOptionalExtensionsConfig,
  extension: OptionalExtensionName,
  enabled: boolean | undefined,
): void {
  if (enabled === undefined) return;
  if (extension === "handoff") state.handoff = enabled;
  if (extension === "notify") state.notify = enabled;
  if (extension === "minimal-mode") state.minimalMode = enabled;
  if (extension === "footer-badges") state.footerBadges = enabled;
}

function normalizeNestedOptionalExtension(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (isRecord(value)) return normalizeBoolean(value.enabled);
  return undefined;
}

function extractOptionalExtensionsConfig(document: unknown): ExtractedOptionalExtensionsConfig {
  const result: ExtractedOptionalExtensionsConfig = {};

  if (Array.isArray(document)) {
    for (const item of document) {
      if (!isRecord(item)) continue;
      const extension = normalizeOptionalExtensionName(item.extension);
      if (!extension) continue;
      setExtensionEnabled(result, extension, normalizeBoolean(item.enabled));
    }
    return result;
  }

  if (!isRecord(document)) return result;

  const extension = normalizeOptionalExtensionName(document.extension);
  if (extension) {
    setExtensionEnabled(result, extension, normalizeBoolean(document.enabled));
  }

  setExtensionEnabled(result, "handoff", normalizeNestedOptionalExtension(document.handoff));
  setExtensionEnabled(result, "notify", normalizeNestedOptionalExtension(document.notify));
  setExtensionEnabled(
    result,
    "minimal-mode",
    normalizeNestedOptionalExtension(document["minimal-mode"] ?? document.minimal_mode ?? document.minimalMode),
  );
  setExtensionEnabled(
    result,
    "footer-badges",
    normalizeNestedOptionalExtension(
      document["footer-badges"] ??
        document.footer_badges ??
        document.footerBadges ??
        document.footer ??
        document.footerRedesign,
    ),
  );

  return result;
}

function mergeOptionalExtensionsState(
  base: OptionalExtensionsState,
  override: ExtractedOptionalExtensionsConfig,
): OptionalExtensionsState {
  return {
    handoff: override.handoff ?? base.handoff,
    notify: override.notify ?? base.notify,
    minimalMode: override.minimalMode ?? base.minimalMode,
    footerBadges: override.footerBadges ?? base.footerBadges,
  };
}

export function loadMergedOptionalExtensionsState(cwd: string): OptionalExtensionsState {
  const defaults = extractOptionalExtensionsConfig(readYamlFile(getDefaultConfigPath(), "ramean default config"));
  const project = extractOptionalExtensionsConfig(readYamlFile(getProjectConfigPath(cwd), "ramean project config"));
  return mergeOptionalExtensionsState(mergeOptionalExtensionsState(emptyOptionalExtensionsState(), defaults), project);
}
