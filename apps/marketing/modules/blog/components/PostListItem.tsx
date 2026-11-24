"use client";

import type { Post } from "@blog/types";
import { LocaleLink } from "@i18n/routing";
import { useLocale } from "next-intl";
import Image from "next/image";

export function PostListItem({ post }: { post: Post }) {
	const locale = useLocale();
	const { title, excerpt, authorName, image, date, path, authorImage, tags } = post;

	return (
		<div className="island-blog-card">
			{image && (
				<div className="island-blog-card-image">
					<Image
						src={image}
						alt={title}
						fill
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						className="object-cover object-center"
					/>
					<LocaleLink
						href={`/blog/${path}`}
						className="inset-0 absolute"
						aria-label={title}
					/>
				</div>
			)}

			{tags && (
				<div className="island-blog-tags">
					{tags.map((tag) => (
						<span key={tag} className="island-blog-tag">
							#{tag}
						</span>
					))}
				</div>
			)}

			<LocaleLink href={`/blog/${path}`} className="island-blog-card-title">
				{title}
			</LocaleLink>
			{excerpt && <p className="island-blog-excerpt">{excerpt}</p>}

			<div className="island-blog-meta">
				{authorName && (
					<div className="flex items-center">
						{authorImage && (
							<div className="mr-2 size-8 relative overflow-hidden rounded-full">
								<Image
									src={authorImage}
									alt={authorName}
									fill
									sizes="96px"
									className="object-cover object-center"
								/>
							</div>
						)}
						<div>
							<p className="island-blog-author">{authorName}</p>
						</div>
					</div>
				)}

				<div className="mr-0 ml-auto">
					<time dateTime={date}>
						{Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(new Date(date))}
					</time>
				</div>
			</div>
		</div>
	);
}
