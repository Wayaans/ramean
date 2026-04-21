import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { parse } from "yaml";

const DEFAULT_SKILLS_DIR = fileURLToPath(new URL("../../skills", import.meta.url));
export const FLAIR_MESSAGE_TYPE = "flair-skill";

export interface FlairSkill {
  name: string;
  description: string;
  body: string;
  skillFilePath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSkillMarkdown(markdown: string): { description: string; body: string } | null {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  const frontmatter = match?.[1] ?? "";
  const body = (match ? markdown.slice(match[0].length) : markdown).trim();

  let parsedFrontmatter: unknown = {};
  if (frontmatter) {
    try {
      parsedFrontmatter = parse(frontmatter);
    } catch {
      parsedFrontmatter = {};
    }
  }

  const description = isRecord(parsedFrontmatter) && typeof parsedFrontmatter.description === "string"
    ? parsedFrontmatter.description.replace(/\s+/g, " ").trim()
    : "";

  if (!description || !body) return null;
  return { description, body };
}

function discoverSkillFiles(skillsDir: string): string[] {
  if (!fs.existsSync(skillsDir)) return [];

  const directories = [skillsDir];
  const skillFiles: string[] = [];

  while (directories.length > 0) {
    const currentDir = directories.shift();
    if (!currentDir) continue;

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(currentDir, entry.name);
      const skillFilePath = path.join(entryPath, "SKILL.md");

      if (fs.existsSync(skillFilePath)) {
        skillFiles.push(skillFilePath);
        continue;
      }

      directories.push(entryPath);
    }
  }

  return skillFiles.sort((left, right) => left.localeCompare(right));
}

export function discoverFlairSkills(skillsDir = DEFAULT_SKILLS_DIR): FlairSkill[] {
  const discoveredSkills: FlairSkill[] = [];
  const seenNames = new Set<string>();

  for (const skillFilePath of discoverSkillFiles(skillsDir)) {
    let parsedSkill: ReturnType<typeof parseSkillMarkdown>;
    try {
      parsedSkill = parseSkillMarkdown(fs.readFileSync(skillFilePath, "utf-8"));
    } catch {
      continue;
    }
    if (!parsedSkill) continue;

    const name = path.basename(path.dirname(skillFilePath));
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    discoveredSkills.push({
      name,
      description: parsedSkill.description,
      body: parsedSkill.body,
      skillFilePath,
    });
  }

  return discoveredSkills.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildFlairSkillContent(skillBody: string, args: string): string {
  const trimmedArgs = args.trim();
  return trimmedArgs ? `${skillBody}\n\nUser: ${trimmedArgs}` : skillBody;
}

export function registerFlairCommands(
  pi: ExtensionAPI,
  options?: { skillsDir?: string; skills?: FlairSkill[] },
): void {
  const skills = options?.skills ?? discoverFlairSkills(options?.skillsDir);

  for (const skill of skills) {
    pi.registerCommand(`flair:${skill.name}`, {
      description: skill.description,
      handler: async (args, ctx) => {
        const content = buildFlairSkillContent(skill.body, args);

        if (ctx.isIdle()) {
          pi.sendMessage({ customType: FLAIR_MESSAGE_TYPE, content, display: false }, { triggerTurn: true });
          return;
        }

        pi.sendMessage({ customType: FLAIR_MESSAGE_TYPE, content, display: false }, { deliverAs: "followUp" });
      },
    });
  }
}
