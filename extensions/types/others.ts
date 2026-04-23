export type OptionalExtensionName = "handoff" | "notify" | "minimal-mode" | "footer-badges";

export interface OptionalExtensionsState {
  handoff: boolean;
  notify: boolean;
  minimalMode: boolean;
  footerBadges: boolean;
}
