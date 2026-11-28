import { FileText, ImageOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Message } from "../../shared/contracts";

interface MessageAttachmentsProps {
	attachments: Message["attachments"];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
	const [preview, setPreview] = useState<{ url: string; name: string }>();
	if (!attachments.length) return null;
	return (
		<div className="message-attachments">
			<div className="message-image-grid">
				{attachments.map((file, index) =>
					file.kind === "image" && imageUrl(file.url) ? (
						<button
							key={`${file.url}-${index}`}
							className="message-image-button"
							aria-label={`放大查看图片：${file.name || `图片 ${index + 1}`}`}
							onClick={() => setPreview({ url: file.url, name: file.name || "图片" })}
						>
							<AttachmentImage url={file.url} name={file.name || "图片"} />
						</button>
					) : null,
				)}
			</div>
			<div className="message-files">
				{attachments.map((file, index) =>
					file.kind !== "image" || !imageUrl(file.url) ? (
						<span key={`${file.url}-${index}`}>
							<FileText size={13} /> {file.name || "附件"}
						</span>
					) : null,
				)}
			</div>
			{preview && <ImagePreview {...preview} onClose={() => setPreview(undefined)} />}
		</div>
	);
}

function AttachmentImage({ url, name }: { url: string; name: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<span className="message-image-unavailable" role="status">
			<ImageOff size={22} />
			<strong>图片暂时无法加载</strong>
			<span>链接可能已过期或网络不可用</span>
		</span>
	) : (
		<img
			src={url}
			alt={name}
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
		/>
	);
}

function ImagePreview({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, []);
	return (
		<dialog
			ref={ref}
			className="message-image-preview"
			aria-label={`图片预览：${name}`}
			onCancel={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClose();
			}}
		>
			<header>
				<strong>{name}</strong>
				<button aria-label="关闭图片预览" onClick={onClose}>
					<X size={20} />
				</button>
			</header>
			<AttachmentImage url={url} name={name} />
		</dialog>
	);
}

function imageUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}
