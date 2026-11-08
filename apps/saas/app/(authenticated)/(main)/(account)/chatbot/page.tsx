import { AiChat } from "@ai/components/AiChat";
import { config } from "@config";
import { PageHeader } from "@shared/components/PageHeader";
import { notFound } from "next/navigation";

export default async function AiDemoPage() {
	if (!config.enableAiChatbot) notFound();
	return (
		<>
			<PageHeader
				title="AI Chatbot"
				subtitle="This is an example chatbot built with the OpenAI API"
				className="max-w-3xl mx-auto"
			/>

			<AiChat />
		</>
	);
}
