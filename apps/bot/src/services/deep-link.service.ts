import type { BotConfig } from "../config.js";

export class DeepLinkService {
  public constructor(
    private readonly config: Pick<BotConfig, "botUsername" | "miniAppShortName">
  ) {}

  public buildMiniAppUrl(startParam?: string, mode: "compact" | "fullscreen" = "fullscreen"): string {
    const baseUrl = this.config.miniAppShortName
      ? `https://t.me/${this.config.botUsername}/${this.config.miniAppShortName}`
      : `https://t.me/${this.config.botUsername}`;

    const params = new URLSearchParams();
    params.set("startapp", startParam ?? "");

    if (mode === "compact") {
      params.set("mode", "compact");
    }

    return `${baseUrl}?${params.toString()}`;
  }

  public buildStartParam(scope: string, entityId?: string): string {
    return entityId ? `${scope}:${entityId}` : scope;
  }
}
