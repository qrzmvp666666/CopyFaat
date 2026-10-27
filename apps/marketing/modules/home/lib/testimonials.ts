/**
 * Shared pravatar.cc image IDs for testimonial users.
 * Used in both TestimonialsSection and HeroSection social proof.
 */
export const TESTIMONIAL_KEYS = ["andy", "blank", "corey", "gefei", "james", "justDoIt"] as const;

export type TestimonialKey = (typeof TESTIMONIAL_KEYS)[number];

export const AVATAR_PHOTO_IDS: Record<TestimonialKey, number> = {
	andy: PROFILE_AVATAR_PHOTO_IDS[0],
	blank: PROFILE_AVATAR_PHOTO_IDS[1],
	corey: PROFILE_AVATAR_PHOTO_IDS[2],
	gefei: PROFILE_AVATAR_PHOTO_IDS[3],
	james: PROFILE_AVATAR_PHOTO_IDS[4],
	justDoIt: PROFILE_AVATAR_PHOTO_IDS[5],
};
import { PROFILE_AVATAR_PHOTO_IDS } from "@repo/utils";
