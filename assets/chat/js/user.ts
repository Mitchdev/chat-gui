import UserFeature from './features';
import { ChatWebsocketTypes } from './types';

class ChatUser {
  nick: string;
  username: string;
  createdDate: string;
  features: string[];

  constructor(
    data: string | ChatWebsocketTypes.IN.SimplifiedUser | null = null
  ) {
    if (typeof data === 'string') {
      this.nick = data;
      this.username = data;
      this.createdDate = '';
      this.features = [];
      return;
    }

    this.nick = data?.nick || '';
    this.username = data?.nick || '';
    this.createdDate = data?.createdDate || '';
    this.features = data?.features || [];
  }

  hasAnyFeatures(...features: string[]): boolean {
    return features.some((feature) => this.features.includes(feature));
  }

  hasFeature(feature: string): boolean {
    return this.hasAnyFeatures(feature);
  }

  hasModPowers(): boolean {
    return this.hasAnyFeatures(UserFeature.ADMIN, UserFeature.MODERATOR);
  }

  isPrivileged(): boolean {
    return this.hasAnyFeatures(
      UserFeature.MODERATOR,
      UserFeature.PROTECTED,
      UserFeature.ADMIN,
      UserFeature.BROADCASTER,
      UserFeature.VIP
    );
  }

  isSubscriber(): boolean {
    return this.hasFeature(UserFeature.SUBSCRIBER);
  }

  isTwitchSub(): boolean {
    return this.hasFeature(UserFeature.TWITCHSUB);
  }

  get subTier(): number {
    if (this.hasFeature(UserFeature.SUB_TIER_5)) return 5;
    if (this.hasFeature(UserFeature.SUB_TIER_4)) return 4;
    if (this.hasFeature(UserFeature.SUB_TIER_3)) return 3;
    if (this.hasFeature(UserFeature.SUB_TIER_2)) return 2;
    if (this.hasFeature(UserFeature.SUB_TIER_1)) return 1;
    return 0;
  }
}

export default ChatUser;
