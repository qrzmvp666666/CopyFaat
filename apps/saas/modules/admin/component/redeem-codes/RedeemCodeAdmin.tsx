"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePlanData } from "@payments/hooks/plan-data";
import { config as paymentsConfig } from "@repo/payments/config";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { Pagination } from "@shared/components/Pagination";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckIcon,
	Clock3Icon,
	CopyIcon,
	DownloadIcon,
	PlusIcon,
	RotateCcwIcon,
	TicketIcon,
	TimerIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { z } from "zod";

const ITEMS_PER_PAGE = 10;
const ALL_VALUE = "all";

const redeemBeforePresetOptions = [
	{ value: "none", days: null },
	{ value: "7", days: 7 },
	{ value: "30", days: 30 },
	{ value: "90", days: 90 },
	{ value: "365", days: 365 },
	{ value: "custom", days: null },
] as const;

const redeemCodeStatuses = ["all", "available", "redeemed", "expired"] as const;

type RedeemBeforePreset = (typeof redeemBeforePresetOptions)[number]["value"];
type RedeemCodeStatusFilter = (typeof redeemCodeStatuses)[number];

const formSchema = z.object({
	name: z.string().min(1).max(120),
	planId: z.string().min(1),
	durationDays: z.string().refine((value) => isIntegerInRange(value, 1, 3650)),
	quantity: z.string().refine((value) => isIntegerInRange(value, 1, 1000)),
	redeemBefore: z.string().optional(),
	note: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function RedeemCodeAdmin() {
	const t = useTranslations();
	const format = useFormatter();
	const queryClient = useQueryClient();
	const { planData } = usePlanData();
	const [activeTab, setActiveTab] = useState("codes");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [redeemBeforePreset, setRedeemBeforePreset] = useState<RedeemBeforePreset>("none");
	const [currentPage, setCurrentPage] = useQueryState(
		"currentPage",
		parseAsInteger.withDefault(1),
	);
	const [batchPage, setBatchPage] = useQueryState("batchPage", parseAsInteger.withDefault(1));
	const [searchTerm, setSearchTerm] = useQueryState("query", parseAsString.withDefault(""));
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		parseAsString.withDefault(ALL_VALUE),
	);
	const [planFilter, setPlanFilter] = useQueryState("plan", parseAsString.withDefault(ALL_VALUE));
	const [batchFilter, setBatchFilter] = useQueryState(
		"batch",
		parseAsString.withDefault(ALL_VALUE),
	);
	const [redeemedFrom, setRedeemedFrom] = useQueryState(
		"redeemedFrom",
		parseAsString.withDefault(""),
	);
	const [redeemedTo, setRedeemedTo] = useQueryState("redeemedTo", parseAsString.withDefault(""));
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useDebounceValue(searchTerm, 300, {
		leading: true,
		trailing: false,
	});

	useEffect(() => {
		setDebouncedSearchTerm(searchTerm);
	}, [searchTerm]); // oxlint-disable-line eslint-plugin-react-hooks/exhaustive-deps

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			planId: getDefaultPlanId(),
			durationDays: "30",
			quantity: "20",
			redeemBefore: "",
			note: "",
		},
	});

	const redeemBeforeValue = form.watch("redeemBefore");
	const customRedeemBefore = splitDateTimeLocalValue(redeemBeforeValue, "23:59");
	const planOptions = useMemo(
		() => Object.keys(paymentsConfig.plans).filter((planId) => planId !== "free"),
		[],
	);

	const batchesQuery = useQuery(
		orpc.admin.redeemCodes.listBatches.queryOptions({
			input: {
				limit: ITEMS_PER_PAGE,
				offset: (batchPage - 1) * ITEMS_PER_PAGE,
				query: activeTab === "batches" ? debouncedSearchTerm : undefined,
			},
		}),
	);
	const allBatchesQuery = useQuery(
		orpc.admin.redeemCodes.listBatches.queryOptions({
			input: {
				limit: 100,
				offset: 0,
			},
		}),
	);
	const statsQuery = useQuery(orpc.admin.redeemCodes.stats.queryOptions());
	const codesQuery = useQuery(
		orpc.admin.redeemCodes.listCodes.queryOptions({
			input: {
				limit: ITEMS_PER_PAGE,
				offset: (currentPage - 1) * ITEMS_PER_PAGE,
				query: debouncedSearchTerm,
				status: normalizeStatusFilter(statusFilter),
				planId: planFilter,
				batchId: batchFilter,
				redeemedFrom: getDateTimeBoundary(redeemedFrom),
				redeemedTo: getDateTimeBoundary(redeemedTo),
			},
		}),
	);
	const createBatchMutation = useMutation(orpc.admin.redeemCodes.createBatch.mutationOptions());
	const exportBatchMutation = useMutation(orpc.admin.redeemCodes.exportBatch.mutationOptions());
	const exportCodesMutation = useMutation(orpc.admin.redeemCodes.exportCodes.mutationOptions());

	useEffect(() => {
		if (currentPage > 1) {
			void setCurrentPage(1);
		}
	}, [debouncedSearchTerm, statusFilter, planFilter, batchFilter, redeemedFrom, redeemedTo]); // oxlint-disable-line eslint-plugin-react-hooks/exhaustive-deps

	useEffect(() => {
		if (batchPage > 1) {
			void setBatchPage(1);
		}
	}, [debouncedSearchTerm]); // oxlint-disable-line eslint-plugin-react-hooks/exhaustive-deps

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			const result = await createBatchMutation.mutateAsync({
				...values,
				durationDays: Number(values.durationDays),
				quantity: Number(values.quantity),
				redeemBefore: values.redeemBefore
					? new Date(values.redeemBefore).toISOString()
					: null,
				note: values.note || null,
			});

			downloadCsv(result.csv, `${slugifyFileName(values.name)}-${result.batch.id}.csv`);
			form.reset({
				...values,
				name: "",
				note: "",
			});
			setRedeemBeforePreset("none");
			setCreateDialogOpen(false);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.admin.redeemCodes.listBatches.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.admin.redeemCodes.listCodes.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.admin.redeemCodes.stats.key(),
				}),
			]);
			toastSuccess(t("admin.redeemCodes.notifications.created"));
		} catch {
			toastError(t("admin.redeemCodes.notifications.createError"));
		}
	});

	const onExportBatch = async (id: string) => {
		try {
			const result = await exportBatchMutation.mutateAsync({ id });
			downloadCsv(result.csv, result.fileName);
		} catch {
			toastError(t("admin.redeemCodes.notifications.exportError"));
		}
	};

	const onExportCodes = async () => {
		try {
			const result = await exportCodesMutation.mutateAsync({
				query: debouncedSearchTerm,
				status: normalizeStatusFilter(statusFilter),
				planId: planFilter,
				batchId: batchFilter,
				redeemedFrom: getDateTimeBoundary(redeemedFrom),
				redeemedTo: getDateTimeBoundary(redeemedTo),
			});
			downloadCsv(result.csv, result.fileName);
		} catch {
			toastError(t("admin.redeemCodes.notifications.exportError"));
		}
	};

	const onCopyCode = async (code: string) => {
		try {
			await copyCode(code);
			toastSuccess(t("admin.redeemCodes.notifications.copied"));
		} catch {
			toastError(t("admin.redeemCodes.notifications.copyError"));
		}
	};

	const resetFilters = () => {
		void setSearchTerm("");
		void setStatusFilter(ALL_VALUE);
		void setPlanFilter(ALL_VALUE);
		void setBatchFilter(ALL_VALUE);
		void setRedeemedFrom("");
		void setRedeemedTo("");
	};

	const batches = batchesQuery.data?.batches ?? [];
	const allBatches = allBatchesQuery.data?.batches ?? [];
	const codes = codesQuery.data?.codes ?? [];
	const stats = statsQuery.data ?? {
		total: 0,
		redeemed: 0,
		available: 0,
		expired: 0,
	};

	return (
		<div className="gap-6 flex flex-col">
			<div className="gap-4 md:flex-row md:items-start md:justify-between flex flex-col">
				<div>
					<h1 className="font-semibold text-3xl tracking-tight">
						{t("admin.redeemCodes.title")}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						{t("admin.redeemCodes.description")}
					</p>
				</div>
				<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button type="button">
							<PlusIcon />
							{t("admin.redeemCodes.create.trigger")}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[520px]">
						<DialogHeader>
							<DialogTitle>{t("admin.redeemCodes.create.title")}</DialogTitle>
							<DialogDescription>
								{t("admin.redeemCodes.create.description")}
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form className="gap-4 flex flex-col" onSubmit={onSubmit}>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("admin.redeemCodes.create.name")}
											</FormLabel>
											<FormControl>
												<Input {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="planId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("admin.redeemCodes.create.plan")}
											</FormLabel>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectGroup>
														{planOptions.map((planId) => (
															<SelectItem key={planId} value={planId}>
																{planData[planId]?.title ?? planId}
															</SelectItem>
														))}
													</SelectGroup>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								<div className="gap-3 grid grid-cols-2">
									<FormField
										control={form.control}
										name="durationDays"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													{t("admin.redeemCodes.create.durationDays")}
												</FormLabel>
												<FormControl>
													<Input type="number" min={1} {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="quantity"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													{t("admin.redeemCodes.create.quantity")}
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={1}
														max={1000}
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<FormField
									control={form.control}
									name="redeemBefore"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("admin.redeemCodes.create.redeemBefore")}
											</FormLabel>
											<FormControl>
												<div className="gap-2 flex flex-col">
													<Select
														value={redeemBeforePreset}
														onValueChange={(value) => {
															const preset =
																value as RedeemBeforePreset;
															setRedeemBeforePreset(preset);
															field.onChange(
																getRedeemBeforeValue(preset),
															);
														}}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																{redeemBeforePresetOptions.map(
																	(option) => (
																		<SelectItem
																			key={option.value}
																			value={option.value}
																		>
																			{t(
																				`admin.redeemCodes.create.redeemBeforeOptions.${option.value}`,
																			)}
																		</SelectItem>
																	),
																)}
															</SelectGroup>
														</SelectContent>
													</Select>
													{redeemBeforePreset === "custom" && (
														<div className="gap-2 grid grid-cols-[minmax(0,1fr)_120px]">
															<Input
																type="date"
																value={customRedeemBefore.date}
																onChange={(event) =>
																	field.onChange(
																		joinDateTimeLocalValue({
																			date: event.target
																				.value,
																			time: customRedeemBefore.time,
																		}),
																	)
																}
																aria-label={t(
																	"admin.redeemCodes.create.redeemBeforeDate",
																)}
															/>
															<Input
																type="time"
																value={customRedeemBefore.time}
																onChange={(event) =>
																	field.onChange(
																		joinDateTimeLocalValue({
																			date: customRedeemBefore.date,
																			time: event.target
																				.value,
																		}),
																	)
																}
																aria-label={t(
																	"admin.redeemCodes.create.redeemBeforeTime",
																)}
															/>
														</div>
													)}
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="note"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("admin.redeemCodes.create.note")}
											</FormLabel>
											<FormControl>
												<Textarea {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter className="gap-2 pt-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => setCreateDialogOpen(false)}
									>
										{t("admin.redeemCodes.create.cancel")}
									</Button>
									<Button type="submit" loading={createBatchMutation.isPending}>
										<DownloadIcon />
										{t("admin.redeemCodes.create.submit")}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="gap-3 sm:grid-cols-2 xl:grid-cols-4 grid">
				<StatsCard
					icon={TicketIcon}
					label={t("admin.redeemCodes.stats.total")}
					value={stats.total}
				/>
				<StatsCard
					icon={CheckIcon}
					label={t("admin.redeemCodes.stats.redeemed")}
					value={stats.redeemed}
				/>
				<StatsCard
					icon={TimerIcon}
					label={t("admin.redeemCodes.stats.available")}
					value={stats.available}
				/>
				<StatsCard
					icon={Clock3Icon}
					label={t("admin.redeemCodes.stats.expired")}
					value={stats.expired}
				/>
			</div>

			<Card className="overflow-hidden rounded-2xl bg-card/80">
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<div className="px-5 pt-4 border-b">
						<TabsList>
							<TabsTrigger value="batches">
								{t("admin.redeemCodes.tabs.batches")}
							</TabsTrigger>
							<TabsTrigger value="codes">
								{t("admin.redeemCodes.tabs.codes")}
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="codes" className="m-0">
						<CardContent className="gap-4 p-5 flex flex-col">
							<div className="gap-4 flex flex-col">
								<div className="gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_140px_150px_170px] grid">
									<Input
										type="search"
										placeholder={t("admin.redeemCodes.codes.search")}
										value={searchTerm}
										onChange={(event) => setSearchTerm(event.target.value)}
									/>
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{redeemCodeStatuses.map((status) => (
													<SelectItem key={status} value={status}>
														{t(`admin.redeemCodes.status.${status}`)}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
									<Select value={planFilter} onValueChange={setPlanFilter}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												<SelectItem value={ALL_VALUE}>
													{t("admin.redeemCodes.filters.all")}
												</SelectItem>
												{planOptions.map((planId) => (
													<SelectItem key={planId} value={planId}>
														{planData[planId]?.title ?? planId}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
									<Select value={batchFilter} onValueChange={setBatchFilter}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												<SelectItem value={ALL_VALUE}>
													{t("admin.redeemCodes.filters.all")}
												</SelectItem>
												{allBatches.map((batch) => (
													<SelectItem key={batch.id} value={batch.id}>
														{batch.name}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</div>
								<div className="gap-3 xl:flex-row xl:items-end flex flex-col">
									<div className="gap-3 md:grid-cols-2 grid flex-1">
										<DateTimeFilter
											label={t("admin.redeemCodes.filters.startDate")}
											dateLabel={t("admin.redeemCodes.filters.startDate")}
											timeLabel={t(
												"admin.redeemCodes.create.redeemBeforeTime",
											)}
											value={redeemedFrom}
											defaultTime="00:00"
											onChange={(value) => void setRedeemedFrom(value)}
										/>
										<DateTimeFilter
											label={t("admin.redeemCodes.filters.endDate")}
											dateLabel={t("admin.redeemCodes.filters.endDate")}
											timeLabel={t(
												"admin.redeemCodes.create.redeemBeforeTime",
											)}
											value={redeemedTo}
											defaultTime="23:59"
											onChange={(value) => void setRedeemedTo(value)}
										/>
									</div>
									<div className="gap-2 flex shrink-0 items-center justify-start">
										<Button
											type="button"
											variant="secondary"
											onClick={resetFilters}
										>
											<RotateCcwIcon data-icon="inline-start" />
											{t("admin.redeemCodes.filters.reset")}
										</Button>
										<Button
											type="button"
											variant="secondary"
											onClick={() => void onExportCodes()}
											loading={exportCodesMutation.isPending}
										>
											<DownloadIcon data-icon="inline-start" />
											{t("admin.redeemCodes.filters.export")}
										</Button>
									</div>
								</div>
							</div>

							<div className="overflow-x-auto rounded-xl border bg-background/40">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.code")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.plan")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.batch")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.status")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.user")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.redeemedAt")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.codes.columns.expiresAt")}
											</TableHead>
											<TableHead className="text-left">
												{t("admin.redeemCodes.codes.columns.actions")}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{codes.length > 0 ? (
											codes.map((code) => (
												<TableRow key={code.id}>
													<TableCell className="font-medium whitespace-nowrap">
														{code.code}
													</TableCell>
													<TableCell>
														{planData[code.batch.planId]?.title ??
															code.batch.planId}
													</TableCell>
													<TableCell>{code.batch.name}</TableCell>
													<TableCell>
														<StatusBadge status={code.displayStatus} />
													</TableCell>
													<TableCell>
														{code.redeemedBy?.email ?? "-"}
													</TableCell>
													<TableCell>
														{formatNullableDateTime(
															format,
															code.redeemedAt,
														)}
													</TableCell>
													<TableCell>
														{formatNullableDateTime(
															format,
															code.entitlementGrant?.expiresAt ??
																code.batch.redeemBefore,
														)}
													</TableCell>
													<TableCell className="text-left">
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={() =>
																void onCopyCode(code.code)
															}
														>
															<CopyIcon data-icon="inline-start" />
															{t("admin.redeemCodes.codes.copy")}
														</Button>
													</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell
													colSpan={8}
													className="h-24 text-center text-muted-foreground"
												>
													{codesQuery.isLoading
														? t("admin.redeemCodes.codes.loading")
														: t("admin.redeemCodes.codes.empty")}
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
							{codesQuery.data?.total && codesQuery.data.total > ITEMS_PER_PAGE && (
								<Pagination
									totalItems={codesQuery.data.total}
									itemsPerPage={ITEMS_PER_PAGE}
									currentPage={currentPage}
									onChangeCurrentPage={setCurrentPage}
								/>
							)}
						</CardContent>
					</TabsContent>

					<TabsContent value="batches" className="m-0">
						<CardContent className="gap-4 p-5 flex flex-col">
							<Input
								type="search"
								placeholder={t("admin.redeemCodes.list.search")}
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
							/>
							<div className="overflow-x-auto rounded-xl border bg-background/40">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>
												{t("admin.redeemCodes.list.columns.name")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.list.columns.plan")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.list.columns.usage")}
											</TableHead>
											<TableHead>
												{t("admin.redeemCodes.list.columns.createdAt")}
											</TableHead>
											<TableHead className="text-left">
												{t("admin.redeemCodes.list.columns.actions")}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{batches.length > 0 ? (
											batches.map((batch) => (
												<TableRow key={batch.id}>
													<TableCell>
														<div className="leading-tight">
															<strong>{batch.name}</strong>
															<div className="text-xs text-muted-foreground">
																{batch.note}
															</div>
														</div>
													</TableCell>
													<TableCell>
														{planData[batch.planId]?.title ??
															batch.planId}
														<div className="text-xs text-muted-foreground">
															{t("admin.redeemCodes.list.duration", {
																days: batch.durationDays,
															})}
														</div>
													</TableCell>
													<TableCell>
														{batch.redeemedCount} / {batch.totalCount}
													</TableCell>
													<TableCell>
														{formatDate(format, batch.createdAt)}
													</TableCell>
													<TableCell className="text-left">
														<Button
															size="sm"
															variant="primary"
															className="min-w-24"
															onClick={() =>
																void onExportBatch(batch.id)
															}
															loading={exportBatchMutation.isPending}
														>
															<DownloadIcon data-icon="inline-start" />
															{t("admin.redeemCodes.list.download")}
														</Button>
													</TableCell>
												</TableRow>
											))
										) : (
											<TableRow>
												<TableCell
													colSpan={5}
													className="h-24 text-center text-muted-foreground"
												>
													{batchesQuery.isLoading
														? t("admin.redeemCodes.list.loading")
														: t("admin.redeemCodes.list.empty")}
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
							{batchesQuery.data?.total &&
								batchesQuery.data.total > ITEMS_PER_PAGE && (
									<Pagination
										totalItems={batchesQuery.data.total}
										itemsPerPage={ITEMS_PER_PAGE}
										currentPage={batchPage}
										onChangeCurrentPage={setBatchPage}
									/>
								)}
						</CardContent>
					</TabsContent>
				</Tabs>
			</Card>
		</div>
	);
}

function StatsCard({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: number;
}) {
	const format = useFormatter();

	return (
		<Card className="rounded-2xl bg-card/80">
			<CardContent className="gap-4 p-5 min-h-28 flex items-center">
				<div className="size-11 flex shrink-0 items-center justify-center rounded-full border bg-muted/30">
					<Icon className="size-6 text-muted-foreground" />
				</div>
				<div>
					<div className="text-sm font-medium text-muted-foreground">{label}</div>
					<div className="mt-1 font-semibold text-3xl tabular-nums">
						{format.number(value)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function StatusBadge({ status }: { status: string }) {
	const t = useTranslations();
	const badgeStatus =
		status === "redeemed" ? "success" : status === "expired" ? "error" : "warning";

	return <Badge status={badgeStatus}>{t(`admin.redeemCodes.status.${status}`)}</Badge>;
}

function DateTimeFilter({
	label,
	dateLabel,
	timeLabel,
	value,
	defaultTime,
	onChange,
}: {
	label: string;
	dateLabel: string;
	timeLabel: string;
	value: string;
	defaultTime: string;
	onChange: (value: string) => void;
}) {
	const dateTime = splitDateTimeLocalValue(value, defaultTime);

	return (
		<div className="gap-2 flex flex-col">
			<div className="text-xs font-medium text-muted-foreground">{label}</div>
			<div className="gap-2 grid grid-cols-[minmax(0,1fr)_110px]">
				<Input
					type="date"
					value={dateTime.date}
					onChange={(event) =>
						onChange(
							joinDateTimeLocalValue({
								date: event.target.value,
								time: dateTime.time || defaultTime,
							}),
						)
					}
					aria-label={dateLabel}
				/>
				<Input
					type="time"
					value={dateTime.time}
					onChange={(event) =>
						onChange(
							joinDateTimeLocalValue({
								date: dateTime.date,
								time: event.target.value || defaultTime,
							}),
						)
					}
					aria-label={timeLabel}
				/>
			</div>
		</div>
	);
}

function getDefaultPlanId() {
	return Object.keys(paymentsConfig.plans).find((planId) => planId !== "free") ?? "pro";
}

function normalizeStatusFilter(value: string): RedeemCodeStatusFilter {
	return redeemCodeStatuses.includes(value as RedeemCodeStatusFilter)
		? (value as RedeemCodeStatusFilter)
		: "all";
}

function getRedeemBeforeValue(preset: RedeemBeforePreset) {
	if (preset === "none") {
		return "";
	}

	if (preset === "custom") {
		return getDateTimeLocalValue(addDays(new Date(), 30));
	}

	return getDateTimeLocalValue(addDays(new Date(), Number(preset)));
}

function splitDateTimeLocalValue(value?: string, defaultTime = "23:59") {
	if (!value) {
		return {
			date: "",
			time: "",
		};
	}

	const [date = "", time = ""] = value.split("T");

	return {
		date,
		time: (time || defaultTime).slice(0, 5),
	};
}

function joinDateTimeLocalValue({ date, time }: { date: string; time: string }) {
	if (!date) {
		return "";
	}

	return `${date}T${time || "23:59"}`;
}

function addDays(date: Date, days: number) {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + days);
	nextDate.setHours(23, 59, 0, 0);

	return nextDate;
}

function getDateTimeLocalValue(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDateTimeBoundary(value: string) {
	if (!value) {
		return null;
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date.toISOString();
}

function formatDate(format: ReturnType<typeof useFormatter>, value: Date | string) {
	return format.dateTime(new Date(value), {
		dateStyle: "medium",
	});
}

function formatNullableDateTime(
	format: ReturnType<typeof useFormatter>,
	value?: Date | string | null,
) {
	if (!value) {
		return "-";
	}

	return format.dateTime(new Date(value), {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

async function copyCode(code: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(code);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = code;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.opacity = "0";

	document.body.appendChild(textarea);
	textarea.select();
	const copied = document.execCommand("copy");
	document.body.removeChild(textarea);

	if (!copied) {
		throw new Error("Unable to copy redeem code");
	}
}

function isIntegerInRange(value: string, min: number, max: number) {
	const parsed = Number(value);

	return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function downloadCsv(csv: string, fileName: string) {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

function slugifyFileName(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "redeem-codes"
	);
}
