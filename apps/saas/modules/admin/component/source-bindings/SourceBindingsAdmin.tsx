"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	signalSourceBindingSchema,
	type SignalSourceBindingValues,
} from "@repo/api/modules/admin/types/signal-source-bindings";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
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
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2Icon, PlusIcon, RefreshCwIcon, PencilIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useForm } from "react-hook-form";

const DEFAULT_VALUES: SignalSourceBindingValues = {
	platform: "discord",
	serverName: "",
	channelName: "",
	categoryName: "",
	traderId: "",
	isActive: true,
};

export function SourceBindingsAdmin() {
	const t = useTranslations("admin.sourceBindings");
	const [query, setQuery] = useQueryState("query", parseAsString.withDefault(""));
	const [open, setOpen] = useState(false);
	const list = useQuery(orpc.admin.sourceBindings.list.queryOptions());
	const save = useMutation(orpc.admin.sourceBindings.save.mutationOptions());
	const form = useForm<SignalSourceBindingValues>({
		resolver: zodResolver(signalSourceBindingSchema),
		defaultValues: DEFAULT_VALUES,
	});
	const bindings = list.data?.bindings ?? [];
	const shown = bindings.filter((row) =>
		[
			row.platform,
			row.serverName,
			row.channelName,
			row.categoryName,
			row.trader.displayName,
			row.trader.name,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase()
			.includes(query.trim().toLowerCase()),
	);
	const submit = form.handleSubmit(async (values) => {
		try {
			await save.mutateAsync(values);
			await list.refetch();
			setOpen(false);
			toastSuccess(t("saved"));
		} catch (error) {
			const code =
				typeof error === "object" && error !== null && "code" in error
					? error.code
					: undefined;
			toastError(t(code === "CONFLICT" ? "duplicate" : "saveError"));
		}
	});
	return (
		<div className="space-y-6">
			<div className="gap-4 sm:flex-row sm:items-start flex flex-col justify-between">
				<div>
					<h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						{t("description")}
					</p>
				</div>
				<Button
					onClick={() => {
						form.reset(DEFAULT_VALUES);
						setOpen(true);
					}}
				>
					<PlusIcon className="size-4" />
					{t("create")}
				</Button>
			</div>
			<div className="p-4 text-sm rounded-xl border bg-card text-muted-foreground">
				<Link2Icon className="mr-2 size-4 inline" />
				{t("hint")}
			</div>
			<div className="gap-3 flex">
				<div className="relative flex-1">
					<SearchIcon className="left-3 top-3 size-4 absolute text-muted-foreground" />
					<Input
						aria-label={t("search")}
						placeholder={t("search")}
						value={query}
						onChange={(e) => void setQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button
					variant="secondary"
					aria-label={t("refresh")}
					disabled={list.isFetching}
					onClick={() => void list.refetch()}
				>
					<RefreshCwIcon className="size-4" />
				</Button>
			</div>
			{list.isError ? (
				<div role="alert" className="p-6 rounded-xl border text-destructive">
					{t("loadError")}
				</div>
			) : list.isPending ? (
				<p className="p-6 text-muted-foreground">{t("loading")}</p>
			) : !shown.length ? (
				<div className="p-10 rounded-xl border border-dashed text-center text-muted-foreground">
					{query ? t("noMatches") : t("empty")}
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border bg-card">
					<div className="md:hidden divide-y">
						{shown.map((row) => (
							<div key={row.id} className="gap-3 p-4 flex flex-col">
								<div className="min-w-0 space-y-2">
									<div className="gap-2 flex flex-wrap items-center">
										<Badge status="info">{row.platform}</Badge>
										<span className="font-medium break-words">
											{row.channelName}
										</span>
										<Badge
											status={
												row.isActive && row.trader.isActive
													? "success"
													: "warning"
											}
										>
											{t(
												row.isActive && row.trader.isActive
													? "enabled"
													: "disabled",
											)}
										</Badge>
									</div>
									<p className="text-sm break-words text-muted-foreground">
										{row.serverName}
										{row.categoryName ? ` / ${row.categoryName}` : ""}
									</p>
									<p className="text-sm">
										{t("boundTo")}{" "}
										<span className="font-medium">
											{row.trader.displayName ?? row.trader.name}
										</span>
									</p>
								</div>
								<Button
									variant="secondary"
									onClick={() => {
										form.reset({
											id: row.id,
											platform: row.platform,
											serverName: row.serverName,
											channelName: row.channelName,
											categoryName: row.categoryName,
											traderId: row.traderId,
											isActive: row.isActive,
										});
										setOpen(true);
									}}
								>
									<PencilIcon className="size-4" />
									{t("edit")}
								</Button>
							</div>
						))}
					</div>
					<div className="md:block hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("platform")}</TableHead>
									<TableHead>{t("serverName")}</TableHead>
									<TableHead>{t("channelName")}</TableHead>
									<TableHead>{t("kol")}</TableHead>
									<TableHead>{t("status")}</TableHead>
									<TableHead className="text-right">{t("actions")}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{shown.map((row) => (
									<TableRow key={row.id}>
										<TableCell>
											<Badge status="info">{row.platform}</Badge>
										</TableCell>
										<TableCell className="max-w-64 break-words text-muted-foreground">
											{row.serverName}
										</TableCell>
										<TableCell className="max-w-64 break-words">
											<p className="font-medium">{row.channelName}</p>
											{row.categoryName && (
												<p className="mt-1 text-xs text-muted-foreground">
													{row.categoryName}
												</p>
											)}
										</TableCell>
										<TableCell className="font-medium">
											{row.trader.displayName ?? row.trader.name}
										</TableCell>
										<TableCell>
											<Badge
												status={
													row.isActive && row.trader.isActive
														? "success"
														: "warning"
												}
											>
												{t(
													row.isActive && row.trader.isActive
														? "enabled"
														: "disabled",
												)}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="secondary"
												onClick={() => {
													form.reset({
														id: row.id,
														platform: row.platform,
														serverName: row.serverName,
														channelName: row.channelName,
														categoryName: row.categoryName,
														traderId: row.traderId,
														isActive: row.isActive,
													});
													setOpen(true);
												}}
											>
												<PencilIcon className="size-4" />
												{t("edit")}
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}
			<Dialog
				open={open}
				onOpenChange={(value) => {
					if (!save.isPending) setOpen(value);
				}}
			>
				<DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{t(form.getValues("id") ? "editTitle" : "createTitle")}
						</DialogTitle>
						<DialogDescription>{t("formDescription")}</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={submit} className="space-y-4">
							{(
								["platform", "serverName", "channelName", "categoryName"] as const
							).map((name) => (
								<FormField
									key={name}
									control={form.control}
									name={name}
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t(name)}</FormLabel>
											<FormControl>
												<Input
													{...field}
													maxLength={name === "platform" ? 80 : 160}
													disabled={save.isPending}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							))}
							<FormField
								control={form.control}
								name="traderId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("kol")}</FormLabel>
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={save.isPending}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder={t("chooseKol")} />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{list.data?.traders.map((trader) => (
													<SelectItem key={trader.id} value={trader.id}>
														{trader.displayName ?? trader.name}
														{!trader.isActive
															? ` (${t("disabled")})`
															: ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="isActive"
								render={({ field }) => (
									<FormItem className="p-3 flex items-center justify-between rounded-lg border">
										<FormLabel>{t("enabled")}</FormLabel>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
												disabled={save.isPending}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							<div className="gap-2 flex justify-end">
								<Button
									type="button"
									variant="secondary"
									disabled={save.isPending}
									onClick={() => setOpen(false)}
								>
									{t("cancel")}
								</Button>
								<Button type="submit" loading={save.isPending}>
									{t("save")}
								</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
