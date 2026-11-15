"use client";

import type { SignalWebhookLogStatus } from "@repo/database";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { orpc } from "@shared/lib/orpc-query-utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	ActivityIcon,
	AlertCircleIcon,
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	InboxIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";

const SIGNAL_WEBHOOK_LOG_STATUSES = [
	"processing",
	"success",
	"partial",
	"rejected",
	"failed",
] as const;
const PAGE_SIZE = 20;
const FILTER_STATUSES = ["all", ...SIGNAL_WEBHOOK_LOG_STATUSES] as const;

export function WebhookLogAdmin() {
	const t = useTranslations("admin.webhookLogs");
	const format = useFormatter();
	const [query, setQuery] = useQueryState("query", parseAsString.withDefault(""));
	const [status, setStatus] = useQueryState(
		"status",
		parseAsStringLiteral(FILTER_STATUSES).withDefault("all"),
	);
	const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
	const [selectedId, setSelectedId] = useQueryState("log", parseAsString.withDefault(""));
	const [search] = useDebounceValue(query, 300);
	const currentPage = Math.max(1, page);
	const list = useQuery({
		...orpc.admin.webhookLogs.list.queryOptions({
			input: {
				query: search.slice(0, 160),
				status: status === "all" ? undefined : status,
				limit: PAGE_SIZE,
				offset: (currentPage - 1) * PAGE_SIZE,
			},
		}),
		placeholderData: keepPreviousData,
		refetchInterval: 15000,
	});
	const data = list.data;
	const cards = [
		{ label: t("summary.total"), value: data?.summary.total, icon: ActivityIcon },
		{ label: t("summary.success"), value: data?.summary.success, icon: CheckCircle2Icon },
		{ label: t("summary.attention"), value: data?.summary.attention, icon: AlertCircleIcon },
		{ label: t("summary.processing"), value: data?.summary.processing, icon: RefreshCwIcon },
	];
	return (
		<div className="space-y-6">
			<div className="gap-4 sm:flex-row sm:items-start flex flex-col justify-between">
				<div>
					<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
					<p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
				</div>
				<Button
					variant="secondary"
					onClick={() => void list.refetch()}
					disabled={list.isFetching}
				>
					<RefreshCwIcon className={`size-4 ${list.isFetching ? "animate-spin" : ""}`} />
					{t("refresh")}
				</Button>
			</div>
			<div className="gap-3 lg:grid-cols-4 grid grid-cols-2">
				{cards.map((card) => (
					<div key={card.label} className="p-4 rounded-xl border bg-card">
						<div className="text-sm flex items-center justify-between text-muted-foreground">
							<span>{card.label}</span>
							<card.icon className="size-4" />
						</div>
						<p className="mt-3 text-2xl font-semibold tabular-nums">
							{card.value === undefined ? "—" : format.number(card.value)}
						</p>
					</div>
				))}
			</div>
			<div className="overflow-hidden rounded-xl border bg-card">
				<div className="gap-3 p-4 sm:flex-row flex flex-col border-b">
					<div className="relative flex-1">
						<SearchIcon className="left-3 top-2.5 size-4 absolute text-muted-foreground" />
						<Input
							aria-label={t("search")}
							placeholder={t("search")}
							className="pl-9"
							maxLength={160}
							value={query}
							onChange={(event) => {
								void setQuery(event.target.value);
								void setPage(1);
							}}
						/>
					</div>
					<Select
						value={status}
						onValueChange={(value) => {
							void setStatus(value as typeof status);
							void setPage(1);
						}}
					>
						<SelectTrigger className="sm:w-44 w-full" aria-label={t("filter")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FILTER_STATUSES.map((value) => (
								<SelectItem key={value} value={value}>
									{value === "all" ? t("all") : t(`statuses.${value}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{list.isError ? (
					<div role="alert" className="space-y-3 p-10 text-center">
						<AlertCircleIcon className="size-6 mx-auto text-destructive" />
						<p>{t("loadError")}</p>
						<Button variant="secondary" onClick={() => void list.refetch()}>
							{t("retry")}
						</Button>
					</div>
				) : list.isPending ? (
					<div role="status" className="p-12 text-center text-muted-foreground">
						{t("loading")}
					</div>
				) : !data?.logs.length ? (
					<div className="px-6 py-14 text-center">
						<InboxIcon className="mb-3 size-8 mx-auto text-muted-foreground" />
						<h3 className="font-medium">
							{query || status !== "all" ? t("noMatches") : t("emptyTitle")}
						</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							{query || status !== "all" ? t("noMatchesHint") : t("emptyHint")}
						</p>
						{(query || status !== "all") && (
							<Button
								variant="ghost"
								className="mt-4 mx-auto"
								onClick={() => {
									void setQuery("");
									void setStatus("all");
									void setPage(1);
								}}
							>
								{t("clear")}
							</Button>
						)}
					</div>
				) : (
					<>
						<div className="md:hidden divide-y">
							{data.logs.map((log) => (
								<button
									key={log.id}
									type="button"
									className="space-y-3 p-4 block w-full text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
									aria-label={t("viewCall", { id: log.id.slice(0, 8) })}
									onClick={() => void setSelectedId(log.id)}
								>
									<div className="gap-2 flex items-center justify-between">
										<span className="text-sm font-medium">
											{format.dateTime(new Date(log.createdAt), {
												month: "2-digit",
												day: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
												second: "2-digit",
												timeZone: "Asia/Shanghai",
											})}
										</span>
										<LogStatus status={log.status} />
									</div>
									<p className="font-mono text-xs text-muted-foreground">
										{log.id.slice(0, 8)} ·{" "}
										{t(
											log.mode === "batch"
												? "batch"
												: log.mode === "single"
													? "single"
													: "unknown",
										)}
										{log.httpStatus ? " · HTTP " + log.httpStatus : ""}
									</p>
									<p className="text-sm">
										{t("resultSummary", {
											total: log.total,
											saved: log.saved,
											errors: log.invalid + log.failed,
										})}
									</p>
									{(log.error || log.ignored > 0) && (
										<p className="text-xs break-words text-muted-foreground">
											{log.error || t("ignoredCount", { count: log.ignored })}
										</p>
									)}
									<div className="text-xs flex items-center justify-between text-muted-foreground">
										<span>
											{log.durationMs === null
												? t("waiting")
												: t("duration", {
														value: format.number(log.durationMs),
													})}
										</span>
										<span className="font-medium text-foreground">
											{t("view")} →
										</span>
									</div>
								</button>
							))}
						</div>
						<div className="md:block hidden overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("columns.call")}</TableHead>
										<TableHead>{t("columns.status")}</TableHead>
										<TableHead>{t("columns.results")}</TableHead>
										<TableHead>{t("columns.duration")}</TableHead>
										<TableHead className="text-right">
											{t("columns.details")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.logs.map((log) => (
										<TableRow key={log.id}>
											<TableCell>
												<p className="text-sm font-medium whitespace-nowrap">
													{format.dateTime(new Date(log.createdAt), {
														month: "2-digit",
														day: "2-digit",
														hour: "2-digit",
														minute: "2-digit",
														second: "2-digit",
														timeZone: "Asia/Shanghai",
													})}
												</p>
												<p className="mt-1 font-mono text-xs text-muted-foreground">
													{log.id.slice(0, 8)} ·{" "}
													{t(
														log.mode === "batch"
															? "batch"
															: log.mode === "single"
																? "single"
																: "unknown",
													)}
												</p>
											</TableCell>
											<TableCell>
												<LogStatus status={log.status} />
												<p className="mt-1 text-xs text-muted-foreground">
													{log.httpStatus
														? `HTTP ${log.httpStatus}`
														: t("waiting")}
												</p>
											</TableCell>
											<TableCell>
												<p className="text-sm whitespace-nowrap">
													{t("resultSummary", {
														total: log.total,
														saved: log.saved,
														errors: log.invalid + log.failed,
													})}
												</p>
												<p className="mt-1 max-w-xs text-xs truncate text-muted-foreground">
													{log.error ||
														(log.ignored
															? t("ignoredCount", {
																	count: log.ignored,
																})
															: t("viewHint"))}
												</p>
											</TableCell>
											<TableCell className="text-sm whitespace-nowrap tabular-nums">
												{log.durationMs === null
													? "—"
													: t("duration", {
															value: format.number(log.durationMs),
														})}
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => void setSelectedId(log.id)}
													aria-label={t("viewCall", {
														id: log.id.slice(0, 8),
													})}
												>
													{t("view")}
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<div className="gap-3 px-4 py-3 flex items-center justify-between border-t">
							<span className="text-xs text-muted-foreground">
								{t("pagination", {
									total: data.total,
									page: currentPage,
									pages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
								})}
							</span>
							<div className="gap-1 flex">
								<Button
									variant="ghost"
									size="icon"
									aria-label={t("previous")}
									disabled={currentPage <= 1 || list.isPlaceholderData}
									onClick={() => void setPage(currentPage - 1)}
								>
									<ChevronLeftIcon className="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									aria-label={t("next")}
									disabled={
										currentPage * PAGE_SIZE >= data.total ||
										list.isPlaceholderData
									}
									onClick={() => void setPage(currentPage + 1)}
								>
									<ChevronRightIcon className="size-4" />
								</Button>
							</div>
						</div>
					</>
				)}
			</div>
			<p className="text-xs text-muted-foreground">{t("footnote")}</p>
			{selectedId && (
				<WebhookLogDetails id={selectedId} onClose={() => void setSelectedId("")} />
			)}
		</div>
	);
}

function WebhookLogDetails({ id, onClose }: { id: string; onClose: () => void }) {
	const t = useTranslations("admin.webhookLogs");
	const format = useFormatter();
	const [errorsOnly, setErrorsOnly] = useState(false);
	const detail = useQuery({
		...orpc.admin.webhookLogs.find.queryOptions({ input: { id } }),
		retry: false,
		refetchInterval: (query) => (query.state.data?.status === "processing" ? 5000 : false),
	});
	const log = detail.data;
	const items =
		log?.items.filter(
			(item) => !errorsOnly || item.status === "invalid" || item.status === "failed",
		) ?? [];
	async function copyId(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toastSuccess(t("copied"));
		} catch {
			toastError(t("copyError"));
		}
	}
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent className="max-w-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("detailTitle")}</DialogTitle>
					<DialogDescription>{t("detailDescription")}</DialogDescription>
				</DialogHeader>
				<div className="gap-2 px-3 py-2 flex items-center rounded-lg bg-muted/40">
					<code className="min-w-0 text-xs flex-1 break-all">{id}</code>
					<Button
						size="icon"
						variant="ghost"
						aria-label={t("copyId")}
						onClick={() => void copyId(id)}
					>
						<CopyIcon className="size-4" />
					</Button>
				</div>
				{detail.isPending ? (
					<p role="status" className="py-8 text-center text-muted-foreground">
						{t("loading")}
					</p>
				) : detail.isError ? (
					<div role="alert" className="space-y-3 py-6 text-center">
						<p>{t("detailError")}</p>
						<Button
							className="mx-auto"
							variant="secondary"
							onClick={() => void detail.refetch()}
						>
							{t("retry")}
						</Button>
					</div>
				) : (
					log && (
						<>
							<div className="gap-3 text-sm flex flex-wrap items-center">
								<LogStatus status={log.status} />
								<span className="text-muted-foreground">
									{format.dateTime(new Date(log.createdAt), {
										dateStyle: "medium",
										timeStyle: "medium",
										timeZone: "Asia/Shanghai",
									})}
								</span>
								<span className="text-muted-foreground">
									{log.httpStatus ? `HTTP ${log.httpStatus}` : t("waiting")}
								</span>
							</div>
							<div className="gap-2 p-3 grid grid-cols-4 rounded-lg border text-center">
								{(["saved", "ignored", "invalid", "failed"] as const).map((key) => (
									<div key={key}>
										<p className="text-lg font-semibold tabular-nums">
											{log[key]}
										</p>
										<p className="text-xs text-muted-foreground">
											{t(`itemStatuses.${key}`)}
										</p>
									</div>
								))}
							</div>
							{log.status === "processing" && (
								<p
									role="status"
									className="bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 rounded-lg"
								>
									{t("processingHint")}
								</p>
							)}
							{log.error && (
								<p
									role="alert"
									className="p-3 text-sm rounded-lg bg-destructive/10 break-words text-destructive"
								>
									{log.error}
								</p>
							)}
							{!!log.items.length && (
								<div className="flex items-center justify-between">
									<h3 className="font-medium">
										{t("itemsTitle", { count: log.total })}
									</h3>
									<Button
										variant={errorsOnly ? "secondary" : "ghost"}
										size="sm"
										aria-pressed={errorsOnly}
										onClick={() => setErrorsOnly(!errorsOnly)}
									>
										{errorsOnly ? t("showAll") : t("errorsOnly")}
									</Button>
								</div>
							)}
							<div className="space-y-3">
								{items.map((item) => (
									<article
										key={item.index}
										className="overflow-hidden rounded-lg border"
									>
										<div className="gap-2 px-4 py-3 flex flex-wrap items-center justify-between bg-muted/20">
											<div className="min-w-0 gap-2 flex items-center">
												<span className="text-xs text-muted-foreground tabular-nums">
													#{item.index + 1}
												</span>
												<span className="text-sm font-medium break-all">
													{String(
														item.input.sourceName || t("unknownSource"),
													)}
												</span>
												<span className="text-sm text-muted-foreground">
													{String(item.input.symbol || "—")}
												</span>
											</div>
											<LogStatus status={item.status} item />
										</div>
										<div className="space-y-2 p-4 text-sm">
											{item.eventId && (
												<p className="break-all">
													<span className="text-muted-foreground">
														eventId:{" "}
													</span>
													<code className="text-xs">{item.eventId}</code>
												</p>
											)}
											{item.signalId && (
												<div className="gap-2 flex items-center">
													<p className="min-w-0 break-all">
														<span className="text-muted-foreground">
															{t("signalId")}:{" "}
														</span>
														<code className="text-xs">
															{item.signalId}
														</code>
													</p>
													<Button
														variant="ghost"
														size="icon"
														aria-label={t("copySignalId")}
														onClick={() => void copyId(item.signalId!)}
													>
														<CopyIcon className="size-3" />
													</Button>
												</div>
											)}
											{item.errors.length > 0 && (
												<ul className="space-y-1 p-3 text-xs rounded-md bg-destructive/5 text-destructive">
													{item.errors.map((error, index) => (
														<li key={index} className="break-words">
															{error}
														</li>
													))}
												</ul>
											)}
											{item.status === "ignored" && (
												<p className="text-xs text-muted-foreground">
													{t("ignoredHint")}
												</p>
											)}
											<details>
												<summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
													{t("inputFields")}
												</summary>
												<pre className="mt-2 p-3 text-xs leading-relaxed overflow-x-auto rounded-md bg-muted/40">
													{JSON.stringify(item.input, null, 2)}
												</pre>
											</details>
										</div>
									</article>
								))}
								{errorsOnly && !items.length && (
									<p className="py-6 text-sm text-center text-muted-foreground">
										{t("noItemErrors")}
									</p>
								)}
							</div>
						</>
					)
				)}
			</DialogContent>
		</Dialog>
	);
}

function LogStatus({ status, item = false }: { status: string; item?: boolean }) {
	const t = useTranslations("admin.webhookLogs");
	const batchStatus = SIGNAL_WEBHOOK_LOG_STATUSES.includes(status as SignalWebhookLogStatus)
		? (status as SignalWebhookLogStatus)
		: "processing";
	const itemStatus =
		(["pending", "saved", "ignored", "invalid", "failed"] as const).find(
			(value) => value === status,
		) ?? "pending";
	const color = ["success", "saved"].includes(status)
		? "success"
		: ["failed", "rejected", "invalid"].includes(status)
			? "error"
			: ["partial", "ignored"].includes(status)
				? "warning"
				: "info";
	return (
		<Badge status={color} className="whitespace-nowrap normal-case">
			{item ? t(`itemStatuses.${itemStatus}`) : t(`statuses.${batchStatus}`)}
		</Badge>
	);
}
