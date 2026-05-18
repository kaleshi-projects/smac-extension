export const MODES: {
  POST: string;
  PROFILE: string;
  MESSAGE: string;
};

export function detectModeFromUrl(rawUrl: string, providedPlatform?: string | null): string | null;
