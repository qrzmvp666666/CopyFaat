import { getProfileAvatarUrl } from "@repo/utils";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { AVATAR_PHOTO_IDS, TESTIMONIAL_KEYS } from "../lib/testimonials";

export function TestimonialsSection() {
	const t = useTranslations();
	return (
		<section className="island-testimonials island-width">
			<header className="island-section-heading">
				<h2>{t("home.island.reviewsTitle")}</h2>
				<p>{t("home.island.reviewsDescription")}</p>
			</header>
			<div className="island-reviews-grid">
				{TESTIMONIAL_KEYS.map((key) => (
					<figure className="island-review" key={key}>
						<blockquote>{t(`home.testimonials.items.${key}.quote`)}</blockquote>
						<figcaption>
							<Image
								className="island-avatar"
								src={getProfileAvatarUrl(AVATAR_PHOTO_IDS[key])}
								alt=""
								width={35}
								height={35}
							/>
							<span>
								<strong>{t(`home.testimonials.items.${key}.name`)}</strong>
								<small>{t(`home.testimonials.items.${key}.role`)}</small>
							</span>
						</figcaption>
					</figure>
				))}
			</div>
		</section>
	);
}
