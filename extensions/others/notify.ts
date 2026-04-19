import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function windowsToastScript(title: string, body: string): string {
  const type = "Windows.UI.Notifications";
  const manager = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
  const template = `[${type}.ToastTemplateType]::ToastText01`;
  const toast = `[${type}.ToastNotification]::new($xml)`;
  return [
    `${manager} > $null`,
    `$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
    `$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body.replace(/'/g, "''")}')) > $null`,
    `[${type}.ToastNotificationManager]::CreateToastNotifier('${title.replace(/'/g, "''")}').Show(${toast})`,
  ].join("; ");
}

function notifyOSC777(title: string, body: string): void {
  process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
  process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
  process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notifyWindows(title: string, body: string): void {
  execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)], () => undefined);
}

export function sendTerminalNotification(title: string, body: string): void {
  if (process.env.WT_SESSION) {
    notifyWindows(title, body);
    return;
  }

  if (process.env.KITTY_WINDOW_ID) {
    notifyOSC99(title, body);
    return;
  }

  notifyOSC777(title, body);
}

export function registerNotifyExtension(pi: ExtensionAPI): void {
  pi.on("agent_end", async () => {
    sendTerminalNotification("Pi", "Ready for input");
  });
}
