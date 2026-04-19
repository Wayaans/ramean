import fs from "node:fs";
import { parse } from "yaml";

export function readYamlFile(filePath: string, label = "config"): unknown {
  if (!fs.existsSync(filePath)) return undefined;

  try {
    return parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Warning: failed to parse ${label} at ${filePath}: ${message}`);
    return undefined;
  }
}
