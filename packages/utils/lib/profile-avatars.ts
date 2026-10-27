export const PROFILE_AVATAR_PHOTO_IDS = [8, 11, 12, 15, 20, 25, 26, 28, 33, 47, 52, 64] as const;

export function getProfileAvatarUrl(photoId: number, _size = 80) {
	return `/images/profile-avatars/${photoId}.jpg`;
}

export function getProfileAvatarUrlForSeed(seed: string, size = 80) {
	const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
	const photoId = PROFILE_AVATAR_PHOTO_IDS[hash % PROFILE_AVATAR_PHOTO_IDS.length];

	return getProfileAvatarUrl(photoId, size);
}
