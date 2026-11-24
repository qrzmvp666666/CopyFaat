"use client";

import { mdxComponents } from "@blog/lib/mdx-components";
import { MDXContent } from "@content-collections/mdx/react";

export function PostContent({ content }: { content: string }) {
	return (
		<div className="island-blog-prose prose prose-invert">
			<MDXContent
				code={content}
				components={{
					a: mdxComponents.a,
				}}
			/>
		</div>
	);
}
