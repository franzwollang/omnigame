"use client";

import { Control, FieldValues } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props<T extends FieldValues> = {
	form: any; // RHF useFormReturn for nested Config; kept as any to avoid type noise
};

type PhaseKey =
	| "none"
	| "place,move"
	| "place,fire"
	| "place,move,fire"
	| "move,fire";

const PHASE_OPTIONS: { value: PhaseKey; label: string }[] = [
	{ value: "none", label: "none (single action type)" },
	{ value: "place,move", label: "place → move" },
	{ value: "place,fire", label: "place → fire" },
	{ value: "place,move,fire", label: "place → move → fire" },
	{ value: "move,fire", label: "move → fire" }
];

function phasesToKey(phases: unknown): PhaseKey {
	if (!Array.isArray(phases) || phases.length === 0) return "none";
	const key = phases.join(",");
	if (
		key === "place,move" ||
		key === "place,fire" ||
		key === "place,move,fire" ||
		key === "move,fire"
	) {
		return key;
	}
	return "none";
}

function keyToPhases(key: PhaseKey): ("place" | "move" | "fire")[] | undefined {
	if (key === "none") return undefined;
	return key.split(",") as ("place" | "move" | "fire")[];
}

export default function SandboxForm<T extends FieldValues>({ form }: Props<T>) {
	const inputMode = form.watch("input.mode") as string | undefined;
	const topology = (form.watch("grid.topology") as string | undefined) ?? "rectangle";
	const schedule =
		(form.watch("turn.schedule") as string | undefined) ?? "alternating";
	const phases = form.watch("turn.phases") as string[] | undefined;
	const phasesNeedMove = Array.isArray(phases) && phases.includes("move");
	const showMovement = inputMode === "move" || phasesNeedMove;
	const hexOrGraph = topology === "hex_offset" || topology === "graph";
	const simultaneousMove = schedule === "simultaneous" && inputMode === "move";
	const orderedReplaceOk = simultaneousMove && !hexOrGraph;
	const rangeMax = hexOrGraph ? 1 : 8;

	const ensureMovement = () => {
		const current = form.getValues("movement");
		if (!current) {
			form.setValue(
				"movement",
				{ adjacency: "orthogonal", range: 1, capture: "none" },
				{ shouldDirty: true }
			);
		}
	};

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<ScrollArea className="h-full min-h-0 rounded-md border">
				<div className="p-2">
					<Form {...form}>
						<form
							className="flex flex-col gap-4 w-full"
							onSubmit={(e) => e.preventDefault()}
						>
							<div className="rounded-md border border-dashed p-3 space-y-1">
								<p className="text-sm font-medium">Form coverage</p>
								<p className="text-xs text-muted-foreground">
									This form covers common knobs (grid, turn schedule/budget,
									movement, phases, placement, win, observation). It does not
									cover the full schema.
								</p>
								<p className="text-xs text-muted-foreground">
									JSON or presets required for:{" "}
									<span className="font-medium text-foreground">
										scheduler, grid.nodes/edges, initial seeds, placements,
										placement.capture, fleet ship geometry beyond lengths,
										deduction.*, identify_secret
									</span>
									.
								</p>
							</div>
							<FormField
								control={form.control}
								name="metadata.name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="grid.width"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Grid width</FormLabel>
											<FormControl>
												<Input
													type="number"
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="grid.height"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Grid height</FormLabel>
											<FormControl>
												<Input
													type="number"
													value={field.value}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<FormField
								control={form.control}
								name="grid.topology"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Topology</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value ?? "rectangle"}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="rectangle" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="rectangle">rectangle</SelectItem>
												<SelectItem value="hex_offset">
													hex_offset (odd-r)
												</SelectItem>
												<SelectItem value="graph">
													graph (adjacency list)
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="grid.wrap"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
										<div className="space-y-0.5">
											<FormLabel>Wrap (toroidal)</FormLabel>
											<p className="text-xs text-muted-foreground">
												Rectangle and hex_offset — opposite edges connect
												(graph: add wrap edges explicitly)
											</p>
										</div>
										<FormControl>
											<Switch
												checked={field.value === true}
												onCheckedChange={field.onChange}
												disabled={
													!["rectangle", "hex_offset"].includes(
														form.watch("grid.topology") ?? "rectangle"
													)
												}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* Tokens */}
							<div className="space-y-2">
								<p className="text-sm font-medium">Tokens</p>
								<div className="space-y-3">
									{/* Simple inline editors for first few tokens */}
									{[0, 1, 2].map((idx) => (
										<div key={idx} className="grid grid-cols-3 gap-2">
											<FormField
												control={form.control}
												name={`tokens.${idx}.id`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Token {idx + 1} id</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name={`tokens.${idx}.label`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Label</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name={`tokens.${idx}.asset.url`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>Image URL</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									))}
								</div>
							</div>
							<p className="text-xs text-muted-foreground">
								manual_tick + Life Lite, simultaneous joint place or
								joint move, commitReveal for hidden simultaneous,
								resolveOrder for ordered same-cell priority,
								actionsPerTurn for multi-step, delayTurns for queued
								places. In-turn phases (place→move / place→fire /
								place→move→fire / move→fire) use the Phases control
								below.
							</p>
							<FormField
								control={form.control}
								name="turn.mode"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Turn mode</FormLabel>
										<FormControl>
											<Select value={field.value} disabled>
												<SelectTrigger>
													<SelectValue placeholder="turn" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="turn">turn</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.schedule"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Schedule</FormLabel>
										<FormControl>
											<Select
												value={field.value ?? "alternating"}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="alternating" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="alternating">
														alternating
													</SelectItem>
													<SelectItem value="manual_tick">
														manual_tick
													</SelectItem>
													<SelectItem value="simultaneous">
														simultaneous
													</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											manual_tick needs scheduler + objective none;
											simultaneous needs cell + n-in-a-row (joint place)
											on rectangle/hex/graph, or move + reach_row (joint
											move) on rectangle/hex/graph. Optional commitReveal
											hides place picks until both commit; resolveOrder
											sets same-cell / same-destination priority.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.commitReveal"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Commit-reveal</FormLabel>
										<FormControl>
											<Select
												value={field.value === true ? "true" : "false"}
												onValueChange={(v) =>
													field.onChange(v === "true")
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="false" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="false">false</SelectItem>
													<SelectItem value="true">true</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											Requires schedule = simultaneous. Each seat commits
											privately; board updates when both have committed.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.resolveOrder"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Resolve order</FormLabel>
										<FormControl>
											<Select
												value={field.value ?? "joint"}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="joint" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="joint">joint</SelectItem>
													<SelectItem value="x_first">x_first</SelectItem>
													<SelectItem value="o_first">o_first</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											Simultaneous same-cell: joint places neither;
											x_first / o_first give the earlier seat the cell.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.actionsPerTurn"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Actions per turn</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={8}
												value={field.value ?? 1}
												onChange={(e) => {
													const n = Number(e.target.value);
													field.onChange(
														Number.isFinite(n) && n > 0 ? n : 1
													);
												}}
											/>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											&gt;1 = multi-step under alternating, or multi-action
											rounds under simultaneous (rectangle | hex_offset |
											graph + cell + n-in-a-row). Incompatible with
											turn.phases.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.phases"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Phases (in-turn)</FormLabel>
										<FormControl>
											<Select
												value={phasesToKey(field.value)}
												onValueChange={(v) => {
													const key = v as PhaseKey;
													const next = keyToPhases(key);
													field.onChange(next);
													if (next?.includes("move")) {
														ensureMovement();
													}
													if (key === "place,fire") {
														form.setValue("movement", undefined, {
															shouldDirty: true
														});
													}
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="none" />
												</SelectTrigger>
												<SelectContent>
													{PHASE_OPTIONS.map((opt) => (
														<SelectItem key={opt.value} value={opt.value}>
															{opt.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											Alternating only; sequences place then move
											and/or fire, or move→fire (no place) within one
											turn. Needs matching objective / observation
											(see schema errors). Distinct from actionsPerTurn.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="placement.delayTurns"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Place delay (turns)</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												max={8}
												value={field.value ?? 0}
												onChange={(e) => {
													const n = Number(e.target.value);
													field.onChange(
														Number.isFinite(n) && n >= 0 ? n : 0
													);
												}}
											/>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											&gt;0 queues the place; stone lands after that many
											intervening places. Cell mode reserves the cell;
											gravity column/row settles landing at resolve time.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="rng.seed"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Seed</FormLabel>
										<FormControl>
											<Input
												type="number"
												value={field.value}
												onChange={(e) => field.onChange(Number(e.target.value))}
											/>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											Used by Effect RNG helpers; not yet wired into play
											stepping.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Input / Placement (Connect 4, etc.) */}
							<div className="space-y-2">
								<p className="text-sm font-medium">Input</p>
								<FormField
									control={form.control}
									name="input.mode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Mode</FormLabel>
											<FormControl>
												<Select
													value={field.value}
													onValueChange={(v) => {
														field.onChange(v);
														if (v === "move") ensureMovement();
													}}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select mode" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="cell">cell</SelectItem>
														<SelectItem value="column">column</SelectItem>
														<SelectItem value="row">row</SelectItem>
														<SelectItem value="move">move</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							{showMovement && (
								<div className="space-y-2">
									<p className="text-sm font-medium">Movement</p>
									<p className="text-xs text-muted-foreground">
										Required for input.mode = move and for phases that
										include move. Diagonal/king and range &gt; 1 are
										rectangle-only; joint simultaneous sliding uses
										vacated-origin paths (incl. replace — fleeing
										blockers clear; stationary targets stay); ordered
										simultaneous sliding revalidates the second seat
										after the first. Replace capture is rectangle +
										move; ordered simultaneous replace uses sequential
										apply.
									</p>
									<div className="grid grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="movement.adjacency"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Adjacency</FormLabel>
													<FormControl>
														<Select
															value={field.value ?? "orthogonal"}
															onValueChange={(v) => {
																ensureMovement();
																field.onChange(v);
															}}
														>
															<SelectTrigger>
																<SelectValue placeholder="orthogonal" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="orthogonal">
																	orthogonal
																</SelectItem>
																<SelectItem
																	value="diagonal"
																	disabled={hexOrGraph}
																>
																	diagonal (rect)
																</SelectItem>
																<SelectItem
																	value="king"
																	disabled={hexOrGraph}
																>
																	king (rect)
																</SelectItem>
															</SelectContent>
														</Select>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="movement.range"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Range</FormLabel>
													<FormControl>
														<Input
															type="number"
															min={1}
															max={rangeMax}
															value={field.value ?? 1}
															onChange={(e) => {
																ensureMovement();
																const n = Number(e.target.value);
																const clamped = Number.isFinite(n)
																	? Math.min(
																			rangeMax,
																			Math.max(1, Math.trunc(n))
																		)
																	: 1;
																field.onChange(clamped);
															}}
														/>
													</FormControl>
													<p className="text-xs text-muted-foreground">
														1 = adjacent step; 2–8 = sliding ray on
														rectangle (stops at occupied / edge).
														{rangeMax === 1
															? " Locked to 1 for hex/graph."
															: ""}
													</p>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
									<FormField
										control={form.control}
										name="movement.capture"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Capture</FormLabel>
												<FormControl>
													<Select
														value={field.value ?? "none"}
														onValueChange={(v) => {
															ensureMovement();
															field.onChange(v);
														}}
														disabled={
															hexOrGraph ||
															(simultaneousMove && !orderedReplaceOk) ||
															inputMode !== "move"
														}
													>
														<SelectTrigger>
															<SelectValue placeholder="none" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="none">none</SelectItem>
															<SelectItem value="replace">
																replace (onto enemy)
															</SelectItem>
														</SelectContent>
													</Select>
												</FormControl>
												<p className="text-xs text-muted-foreground">
													Replace: land on an enemy cell to remove it
													(path must be empty except destination).
													Rectangle + move input; simultaneous OK
													(joint or ordered, any range); not
													placement.capture.
												</p>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							)}

							<div className="space-y-2">
								<p className="text-sm font-medium">Observation / objective</p>
								<FormField
									control={form.control}
									name="observation.mode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Observation mode</FormLabel>
											<FormControl>
												<Select
													value={field.value ?? "full"}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="full" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="full">full</SelectItem>
														<SelectItem value="hit_miss">hit_miss</SelectItem>
														<SelectItem value="fog">fog</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												hit_miss = Battleship-lite; fog = radius vision around
												own pieces.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="fleet.ships"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Fleet ships (placement phase)</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g. 2,3"
													value={
														Array.isArray(field.value)
															? field.value.join(",")
															: ""
													}
													onChange={(e) => {
														const raw = e.target.value.trim();
														if (!raw) {
															form.setValue("fleet", undefined, {
																shouldDirty: true
															});
															return;
														}
														const parts = raw
															.split(/[,\s]+/)
															.map((s) => Number(s))
															.filter((n) => Number.isFinite(n) && n >= 1);
														if (parts.length === 0) {
															form.setValue("fleet", undefined, {
																shouldDirty: true
															});
															return;
														}
														form.setValue(
															"fleet",
															{ ships: parts },
															{ shouldDirty: true }
														);
													}}
												/>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												hit_miss only: contiguous ship lengths each player
												places before combat. Clear to use fixed owner
												initial seeds instead.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="observation.radius"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Fog radius</FormLabel>
											<FormControl>
												<Input
													type="number"
													value={field.value ?? 1}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												Used when observation.mode = fog.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="observation.metric"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Fog metric</FormLabel>
											<FormControl>
												<Select
													value={field.value ?? "chebyshev"}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="chebyshev" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="chebyshev">
															chebyshev
														</SelectItem>
														<SelectItem value="manhattan">
															manhattan
														</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												Rectangle only; hex uses cube distance, graph uses
												BFS hops.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="objective.mode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Objective</FormLabel>
											<FormControl>
												<Select
													value={field.value ?? "n_in_a_row"}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="n_in_a_row" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="n_in_a_row">
															n_in_a_row
														</SelectItem>
														<SelectItem value="destroy_hidden">
															destroy_hidden
														</SelectItem>
														<SelectItem value="connect_or_destroy">
															connect_or_destroy
														</SelectItem>
														<SelectItem value="reach_row">
															reach_row
														</SelectItem>
														<SelectItem value="area_control">
															area_control
														</SelectItem>
														<SelectItem value="none">none</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												destroy_hidden↔hit_miss; connect_or_destroy↔
												place→move→fire + hit_miss; reach_row↔move;
												area_control↔liberties; none↔tick.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="space-y-2">
								<p className="text-sm font-medium">Placement</p>
								<FormField
									control={form.control}
									name="placement.mode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Mode</FormLabel>
											<FormControl>
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select mode" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="direct">direct</SelectItem>
														<SelectItem value="gravity">gravity</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="placement.gravity.direction"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Gravity direction</FormLabel>
											<FormControl>
												<Select
													value={field.value ?? "down"}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="down" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="down">down</SelectItem>
														<SelectItem value="up">up</SelectItem>
														<SelectItem value="left">left</SelectItem>
														<SelectItem value="right">right</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												column ↔ down/up; row ↔ left/right.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="placement.overflow"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Overflow behavior</FormLabel>
											<FormControl>
												<Select
													value={field.value}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select behavior" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="reject">reject</SelectItem>
														<SelectItem value="pop_out_bottom">
															pop_out_bottom
														</SelectItem>
														<SelectItem value="pop_out_top">
															pop_out_top
														</SelectItem>
														<SelectItem value="pop_out_right">
															pop_out_right
														</SelectItem>
														<SelectItem value="pop_out_left">
															pop_out_left
														</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												bottom↔down, top↔up, right↔right, left↔left.
											</p>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<FormField
								control={form.control}
								name="win.length"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Win length</FormLabel>
										<FormControl>
											<Input
												type="number"
												value={field.value ?? ""}
												onChange={(e) =>
													field.onChange(
														e.target.value === ""
															? undefined
															: Number(e.target.value)
													)
												}
											/>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											Used for n_in_a_row; ignored for destroy_hidden.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="space-y-2">
								<p className="text-sm font-medium">Adjacency</p>
								<FormField
									control={form.control}
									name="win.adjacency.mode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Mode</FormLabel>
											<FormControl>
												<Select
													value={field.value ?? "linear"}
													onValueChange={field.onChange}
												>
													<SelectTrigger>
														<SelectValue placeholder="Select mode" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="linear">linear</SelectItem>
														<SelectItem value="composite">composite</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="win.adjacency.horizontal"
									render={({ field }) => (
										<FormItem className="flex flex-row gap-2 items-center space-y-0">
											<FormControl>
												<Checkbox
													checked={Boolean(field.value)}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<FormLabel className="text-xs font-normal">
												Horizontal
											</FormLabel>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="win.adjacency.vertical"
									render={({ field }) => (
										<FormItem className="flex flex-row gap-2 items-center space-y-0">
											<FormControl>
												<Checkbox
													checked={Boolean(field.value)}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<FormLabel className="text-xs font-normal">
												Vertical
											</FormLabel>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="win.adjacency.backDiagonal"
									render={({ field }) => (
										<FormItem className="flex flex-row gap-2 items-center space-y-0">
											<FormControl>
												<Checkbox
													checked={Boolean(field.value)}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<FormLabel className="text-xs font-normal">
												Back diagonal
											</FormLabel>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="win.adjacency.forwardDiagonal"
									render={({ field }) => (
										<FormItem className="flex flex-row gap-2 items-center space-y-0">
											<FormControl>
												<Checkbox
													checked={Boolean(field.value)}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
											<FormLabel className="text-xs font-normal">
												Forward diagonal
											</FormLabel>
										</FormItem>
									)}
								/>
							</div>
						</form>
					</Form>
				</div>
			</ScrollArea>
		</div>
	);
}
