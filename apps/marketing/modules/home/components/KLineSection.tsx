export function KLineSection() {
	return (
		<section className="py-12 lg:py-16 border-b">
			<div className="container">
				<div className="max-w-3xl mx-auto text-center">
					<h2 className="font-bold text-2xl md:text-3xl lg:text-4xl text-foreground">
						聚合 K 线
					</h2>
					<p className="mt-3 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
						整合多源链上数据与 KOL 行为，在一张 K 线图上直观呈现市场情绪与聪明钱动向，帮你在噪音中找到真正的信号。
					</p>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
						<span className="px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
							KOL 聚合 K 线
						</span>
						<span className="px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
							链上资金流向
						</span>
						<span className="px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
							实时信号标注
						</span>
						<span className="px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
							多维度数据聚合
						</span>
						<span className="px-5 py-2 rounded-full border border-primary/30 bg-primary/5 text-sm font-medium text-foreground">
							历史回测支持
						</span>
					</div>
				</div>
			</div>
		</section>
	);
}
