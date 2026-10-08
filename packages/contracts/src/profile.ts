export const IDENTITY_COLORS = [
  'blue',
  'green',
  'purple',
  'rose',
  'orange',
  'teal',
  'slate',
  'indigo',
] as const;
export const IDENTITY_EMOJIS = ['🌱', '🌻', '🍀', '⭐', '🌙', '☀️', '🦋', '🐢'] as const;
export type AvatarSource = 'initial' | 'generated' | 'emoji' | 'photo';
export interface UserIdentity {
  schemaVersion: 1;
  avatarSource: AvatarSource;
  accentColor: (typeof IDENTITY_COLORS)[number];
  detail?: string;
  photoPath?: string;
  photoUrl?: string;
  photoVersion?: number;
  updatedAt?: string;
}
export const avatarPath = (uid: string): string => `users/${uid}/avatar/avatar.webp`;
export function parseIdentity(value: unknown, uid: string): UserIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) =>
        ![
          'schemaVersion',
          'avatarSource',
          'accentColor',
          'detail',
          'photoPath',
          'photoVersion',
          'photoUrl',
          'updatedAt',
        ].includes(key),
    )
  )
    return null;
  if (
    body.schemaVersion !== 1 ||
    !['initial', 'generated', 'emoji', 'photo'].includes(String(body.avatarSource)) ||
    !IDENTITY_COLORS.includes(body.accentColor as UserIdentity['accentColor'])
  )
    return null;
  if (
    body.detail !== undefined &&
    !IDENTITY_EMOJIS.includes(body.detail as (typeof IDENTITY_EMOJIS)[number])
  )
    return null;
  if (body.avatarSource === 'emoji' && !body.detail) return null;
  if (body.photoPath !== undefined && body.photoPath !== avatarPath(uid)) return null;
  if (
    body.photoVersion !== undefined &&
    (!Number.isSafeInteger(body.photoVersion) || Number(body.photoVersion) < 1)
  )
    return null;
  if (
    body.avatarSource === 'photo' &&
    (body.photoPath !== avatarPath(uid) || body.photoVersion === undefined)
  )
    return null;
  if (
    body.avatarSource !== 'photo' &&
    (body.photoPath !== undefined || body.photoVersion !== undefined)
  )
    return null;
  const identity = { ...body };
  delete identity.photoUrl;
  delete identity.updatedAt;
  return identity as unknown as UserIdentity;
}
