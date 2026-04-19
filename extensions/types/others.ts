export type OptionalExtensionName = "handoff" | "notify" | "minimal-mode";

export interface OptionalExtensionsState {
  handoff: boolean;
  notify: boolean;
  minimalMode: boolean;
}
