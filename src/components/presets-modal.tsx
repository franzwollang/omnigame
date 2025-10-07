"use client";

import { useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
	examplePresets,
	searchPresets,
	type ExamplePreset
} from "@/presets/registry";

interface PresetsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectPreset: (preset: ExamplePreset) => void;
}

export function PresetsModal({
	open,
	onOpenChange,
	onSelectPreset
}: PresetsModalProps) {
	const [query, setQuery] = useState("");

	const results = query ? searchPresets(query) : Object.values(examplePresets);

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<div className="bg-black">
				<CommandInput
					placeholder="Search examples..."
					value={query}
					onValueChange={setQuery}
				/>
				<CommandList>
					{results.length === 0 ? (
						<CommandEmpty>No examples found.</CommandEmpty>
					) : (
						<CommandGroup heading="Examples">
							{results.map((preset) => (
								<CommandItem
									key={preset.id}
									value={`${preset.name} ${preset.tags.join(" ")} ${
										preset.description
									}`}
									onSelect={() => {
										onSelectPreset(preset);
										onOpenChange(false);
										setQuery("");
									}}
									className="flex flex-col gap-2 items-start py-3"
								>
									<div className="flex gap-2 items-center w-full">
										<span className="font-medium">{preset.name}</span>
										<div className="flex gap-1 ml-auto">
											{preset.tags.slice(0, 2).map((tag) => (
												<Badge
													key={tag}
													variant="secondary"
													className="text-xs"
												>
													{tag}
												</Badge>
											))}
										</div>
									</div>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{preset.description}
									</p>
								</CommandItem>
							))}
						</CommandGroup>
					)}
				</CommandList>
			</div>
		</CommandDialog>
	);
}
