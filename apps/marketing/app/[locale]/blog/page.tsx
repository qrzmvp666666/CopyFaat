import { PostListItem } from "@blog/components/PostListItem";
import { getAllPosts } from "@blog/lib/posts";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	const t = await getTranslations({ locale, namespace: "blog" });
	return {
		title: t("title"),
	};
}

export default async function BlogListPage(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations({ locale, namespace: "blog" });
	const posts = await getAllPosts(locale);

	return (
		<div className="island-blog">
			<div className="island-blog-heading">
				<h1 className="island-blog-title">{t("title")}</h1>
				<p className="island-blog-description">{t("description")}</p>
			</div>

			<div className="island-blog-grid">
				{posts.map((post) => (
					<PostListItem post={post} key={post.path} />
				))}
			</div>
		</div>
	);
}
