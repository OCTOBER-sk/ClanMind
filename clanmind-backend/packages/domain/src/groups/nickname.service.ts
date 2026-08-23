import { AppError } from "@clanmind/shared";

/** §26 */
export interface MemberNickname {
  group_id: string;
  viewer_user_id: string;
  target_user_id: string;
  nickname: string;
  created_at: string;
  updated_at: string;
}

export interface NicknameRepository {
  upsert(input: {
    group_id: string;
    viewer_user_id: string;
    target_user_id: string;
    nickname: string;
  }): Promise<MemberNickname>;
  find(
    groupId: string,
    viewerUserId: string,
    targetUserId: string,
  ): Promise<MemberNickname | null>;
  listForViewer(groupId: string, viewerUserId: string): Promise<MemberNickname[]>;
  delete(groupId: string, viewerUserId: string, targetUserId: string): Promise<void>;
}

const NICKNAME_MAX = 60;

/**
 * §26 / §175 group-local nicknames. A nickname mapping belongs to the
 * viewer + Group, never to the target member; a nickname is never canonical
 * identity. Display resolution order (§175):
 *   viewer nickname → Group display name → global profile name.
 */
export class NicknameService {
  constructor(private readonly nicknames: NicknameRepository) {}

  async set(
    groupId: string,
    viewerUserId: string,
    targetUserId: string,
    nickname: string,
  ): Promise<MemberNickname> {
    if (viewerUserId === targetUserId) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Nicknames apply to teammates, not yourself.",
      );
    }
    const trimmed = nickname.trim();
    if (trimmed.length === 0 || trimmed.length > NICKNAME_MAX) {
      throw new AppError("VALIDATION_FAILED", "Nickname must be 1–60 characters.");
    }
    return this.nicknames.upsert({
      group_id: groupId,
      viewer_user_id: viewerUserId,
      target_user_id: targetUserId,
      nickname: trimmed,
    });
  }

  async remove(
    groupId: string,
    viewerUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.nicknames.delete(groupId, viewerUserId, targetUserId);
  }

  async listForViewer(groupId: string, viewerUserId: string): Promise<MemberNickname[]> {
    return this.nicknames.listForViewer(groupId, viewerUserId);
  }

  /**
   * §175 resolution used when rendering any member reference for a viewer:
   * viewer nickname → Group display name → global profile display name.
   */
  static resolveDisplayName(input: {
    nickname: string | null;
    group_display_name: string | null;
    global_display_name: string;
  }): string {
    return input.nickname?.trim() || input.group_display_name?.trim() || input.global_display_name;
  }
}
