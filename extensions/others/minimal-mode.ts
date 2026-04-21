import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool, createReadTool } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { setMinimalModeWorkingIndicator } from "../UI/working-indicator.js";
import { shortenPath } from "../core/utils.js";

let minimalToolDisplayEnabled = false;

export function isMinimalToolDisplayEnabled(): boolean {
  return minimalToolDisplayEnabled;
}

export function registerMinimalModeExtension(pi: ExtensionAPI): void {
  minimalToolDisplayEnabled = true;

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    setMinimalModeWorkingIndicator(ctx, true);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    setMinimalModeWorkingIndicator(ctx, false);
  });

  pi.registerTool({
    name: "read",
    label: "read",
    description:
      "Read the contents of a file. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.",
    parameters: createReadTool(process.cwd()).parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createReadTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const filePath = shortenPath(typeof args.path === "string" ? args.path : "");
      let pathDisplay = filePath ? theme.fg("accent", filePath) : theme.fg("toolOutput", "...");
      if (args.offset !== undefined || args.limit !== undefined) {
        const startLine = typeof args.offset === "number" ? args.offset : 1;
        const endLine = typeof args.limit === "number" ? startLine + args.limit - 1 : "";
        pathDisplay += theme.fg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
      }
      return new Text(`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      if (!expanded) {
        return new Text("", 0, 0);
      }

      const textContent = result.content.find((content) => content.type === "text");
      if (!textContent || textContent.type !== "text") {
        return new Text("", 0, 0);
      }

      const output = textContent.text.split("\n").map((line) => theme.fg("toolOutput", line)).join("\n");
      return new Text(output ? `\n${output}` : "", 0, 0);
    },
  });

  pi.registerTool({
    name: "bash",
    label: "bash",
    description:
      "Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last 2000 lines or 50KB (whichever is hit first).",
    parameters: createBashTool(process.cwd()).parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createBashTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const command = typeof args.command === "string" ? args.command : "...";
      const timeout = typeof args.timeout === "number" ? args.timeout : undefined;
      const timeoutSuffix = timeout ? theme.fg("muted", ` (timeout ${timeout}s)`) : "";
      return new Text(theme.fg("toolTitle", theme.bold(`$ ${command}`)) + timeoutSuffix, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      if (!expanded) {
        return new Text("", 0, 0);
      }

      const textContent = result.content.find((content) => content.type === "text");
      if (!textContent || textContent.type !== "text") {
        return new Text("", 0, 0);
      }

      const output = textContent.text
        .trim()
        .split("\n")
        .map((line) => theme.fg("toolOutput", line))
        .join("\n");
      return new Text(output ? `\n${output}` : "", 0, 0);
    },
  });
}
