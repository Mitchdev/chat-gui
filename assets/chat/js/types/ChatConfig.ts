interface ChatConfig {
  url: string;
  api: { base: string };
  cdn: { base: string };
  cacheKey?: string;
  banAppealUrl?: string | null;
  amazonTags?: string | null;
  welcomeMessage?: string;
  stalkEnabled?: boolean;
  mentionsEnabled?: boolean;
}

export default ChatConfig;
