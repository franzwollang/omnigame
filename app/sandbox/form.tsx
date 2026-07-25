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

export default function SandboxForm<T extends FieldValues>({ form }: Props<T>) {
	return (
		<div className="flex flex-col flex-1 min-h-0">
			<ScrollArea className="h-full min-h-0 rounded-md border">
				<div className="p-2">
					<Form {...form}>
						<form
							className="flex flex-col gap-4 w-full"
							onSubmit={(e) => e.preventDefault()}
						>
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
								manual_tick + Life Lite, simultaneous joint place,
								commitReveal for hidden simultaneous, actionsPerTurn for
								multi-step, or delayTurns for queued places.
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
											on rectangle, hex_offset, or graph. Optional
											commitReveal hides picks until both commit;
											resolveOrder sets same-cell priority.
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
											&gt;1 keeps the current player until the budget is
											spent (alternating + cell + n-in-a-row only).
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
											intervening places (cell reserved meanwhile).
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
													onValueChange={field.onChange}
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
												destroy_hidden↔hit_miss; reach_row↔move;
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
