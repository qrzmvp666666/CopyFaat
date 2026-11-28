import Image from "next/image";

export function Logo() {
	return (
		<>
			<Image src="/images/brand/copyfast-logo.png" alt="" width={36} height={36} />
			<span>CopyFast</span>
		</>
	);
}
