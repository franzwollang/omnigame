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
								Wrap edges and realtime turns are deferred. Use
								manual_tick + Life Lite for discrete generations.
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
												</SelectContent>
											</Select>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											manual_tick requires scheduler + objective none.
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
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												hit_miss projects per-player views (Battleship-lite).
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
												<Select value={field.value ?? "down"} disabled>
													<SelectTrigger>
														<SelectValue placeholder="down" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="down">down</SelectItem>
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												Only down is implemented (up/left/right → M1+).
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
													</SelectContent>
												</Select>
											</FormControl>
											<p className="text-xs text-muted-foreground">
												pop_out_top deferred to M1+.
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
