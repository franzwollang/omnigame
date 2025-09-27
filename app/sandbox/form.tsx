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
		<div className="flex-1 min-h-0 flex flex-col">
			<ScrollArea className="rounded-md border h-full min-h-0">
				<div className="p-2">
					<Form {...form}>
						<form
							className="flex w-full flex-col gap-4"
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
									<FormItem className="flex flex-row items-center gap-2 space-y-0">
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
						</form>
					</Form>
				</div>
			</ScrollArea>
		</div>
	);
}
