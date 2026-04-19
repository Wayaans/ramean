import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import { getDefaultPromptPath, getProjectPromptPath } from "../core/paths.js";
import type { CanonicalAgentName, ProjectPromptFrontmatter, PromptResolution } from "../types/subagents.js";

function validateProjectPromptFrontmatter(
  agent: CanonicalAgentName,
  frontmatter: ProjectPromptFrontmatter,
): { valid: boolean; warning?: string; mode?: "append" | "replace" } {
  const keys = Object.keys(frontmatter);
  const allowedKeys = new Set(["name", "mode"]);
  if (keys.some((key) => !allowedKeys.has(key))) {
    return {
      valid: false,
      warning: `Ignored ${agent} project prompt override: only frontmatter keys \"name\" and \"mode\" are allowed.`,
    };
  }

  if (frontmatter.name !== agent) {
    return {
      valid: false,
      warning: `Ignored ${agent} project prompt override: frontmatter name must be \"${agent}\".`,
    };
  }

  if (frontmatter.mode !== "append" && frontmatter.mode !== "replace") {
    return {
      valid: false,
      warning: `Ignored ${agent} project prompt override: mode must be \"append\" or \"replace\".`,
    };
  }

  return {
    valid: true,
    mode: frontmatter.mode,
  };
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

export function loadPromptResolution(cwd: string, agent: CanonicalAgentName): PromptResolution {
  const defaultPromptFile = getDefaultPromptPath(agent);
  const projectPromptFile = getProjectPromptPath(cwd, agent);
  const warnings: string[] = [];

  const defaultContent = readFile(defaultPromptFile);
  const defaultPrompt = parseFrontmatter<Record<string, unknown>>(defaultContent).body.trim();

  if (!fs.existsSync(projectPromptFile)) {
    return {
      agent,
      source: "default",
      prompt: defaultPrompt,
      warnings,
      projectFilePath: projectPromptFile,
    };
  }

  try {
    const parsed = parseFrontmatter<ProjectPromptFrontmatter>(readFile(projectPromptFile));
    const validation = validateProjectPromptFrontmatter(agent, parsed.frontmatter);
    if (!validation.valid || !validation.mode) {
      warnings.push(validation.warning ?? `Ignored invalid ${agent} project prompt override.`);
      return {
        agent,
        source: "fallback-default",
        prompt: defaultPrompt,
        warnings,
        projectFilePath: projectPromptFile,
      };
    }

    const body = parsed.body.trim();
    const prompt = validation.mode === "replace" ? body : `${defaultPrompt}\n\n${body}`.trim();
    return {
      agent,
      source: validation.mode === "replace" ? "project-replace" : "project-append",
      prompt,
      warnings,
      projectFilePath: projectPromptFile,
    };
  } catch (error) {
    warnings.push(
      `Ignored ${agent} project prompt override at ${path.basename(projectPromptFile)}: ${(error as Error).message}`,
    );
    return {
      agent,
      source: "fallback-default",
      prompt: defaultPrompt,
      warnings,
      projectFilePath: projectPromptFile,
    };
  }
}

export function createPromptTemplate(agent: CanonicalAgentName, mode: "append" | "replace", body = ""): string {
  return [`---`, `name: ${agent}`, `mode: ${mode}`, `---`, "", body].join("\n");
}
