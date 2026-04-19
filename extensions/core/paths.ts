import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalAgentName } from "../types/subagents.js";

const EXTENSIONS_DIR = fileURLToPath(new URL("..", import.meta.url));

export function getExtensionsDir(): string {
  return EXTENSIONS_DIR;
}

export function getDefaultConfigPath(): string {
  return path.join(EXTENSIONS_DIR, "config.yaml");
}

export function getDefaultPromptPath(agent: CanonicalAgentName): string {
  return path.join(EXTENSIONS_DIR, "subagents", "prompts", `${agent}.md`);
}

function hasMarker(dir: string, marker: string): boolean {
  return fs.existsSync(path.join(dir, marker));
}

export function findProjectRoot(startCwd: string): string {
  let current = path.resolve(startCwd);

  while (true) {
    if (hasMarker(current, ".git") || hasMarker(current, ".pi")) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startCwd);
    }
    current = parent;
  }
}

export function getProjectRameanDir(cwd: string): string {
  return path.join(findProjectRoot(cwd), ".pi", "ramean");
}

export function getProjectConfigPath(cwd: string): string {
  return path.join(getProjectRameanDir(cwd), "config.yaml");
}

export function getProjectAgentsDir(cwd: string): string {
  return path.join(getProjectRameanDir(cwd), "agents");
}

export function getProjectPromptPath(cwd: string, agent: CanonicalAgentName): string {
  return path.join(getProjectAgentsDir(cwd), `${agent}.md`);
}
