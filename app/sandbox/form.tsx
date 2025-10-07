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
								name="grid.wrap"
								render={({ field }) => (
									<FormItem className="flex flex-row gap-2 items-center space-y-0">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<FormLabel className="font-normal">Wrap edges</FormLabel>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="turn.mode"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Turn mode</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select mode" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="turn">turn</SelectItem>
													<SelectItem value="realtime">realtime</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
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
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="win.length"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Win length</FormLabel>
										<FormControl>
											<Input
												type="number"
												value={field.value}
												onChange={(e) => field.onChange(Number(e.target.value))}
											/>
										</FormControl>
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
													value={field.value}
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
													checked={field.value}
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
													checked={field.value}
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
													checked={field.value}
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
													checked={field.value}
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
