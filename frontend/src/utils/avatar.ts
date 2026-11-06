export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%23202c33"/><path fill="%238696a0" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;

/**
 * Returns a valid avatar URL or falls back to the default user icon SVG.
 * Filters out legacy demo Unsplash photos so all users without custom avatars display the clean user icon.
 */
export function getAvatarUrl(avatar?: string | null): string {
  if (!avatar || avatar.trim() === '' || avatar.includes('unsplash.com')) {
    return DEFAULT_AVATAR;
  }
  return avatar;
}
