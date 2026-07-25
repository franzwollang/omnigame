"use server";

/**
 * Optional / experimental SMT validation helper (Z3 WASM).
 *
 * Not wired into the sandbox UI. Sandbox live validation uses client-side
 * Zod + `validateConfig` (feature contracts). Call this from scripts, CI, or
 * a future explicit “deep check” when Z3 constraints grow past contract checks.
 *
 * Today Z3 mostly re-checks the same placement/input/overflow implications
 * already covered by Zod refinements + contracts — keep it optional until it
 * adds unique value.
 */
import { zConfig } from "@/schemas/config";
import {
	validateConfig,
	contractErrorsToZodIssues,
	type ZodLikeIssue
} from "@/engine/validateConfig";
import { solveZ3Config } from "@/engine/solveZ3";

export async function validateConfigServerAction(
	input: unknown
): Promise<{ ok: boolean; issues: ZodLikeIssue[]; warnings?: string[] }> {
	// First, run Zod + contract checks (fast path)
	const parsed = zConfig.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			issues: parsed.error.issues.map((i) => ({
				code: "custom",
				path: i.path as (string | number)[],
				message: i.message
			}))
		};
	}
	const structural = validateConfig(parsed.data);
	if (!structural.ok) {
		return { ok: false, issues: contractErrorsToZodIssues(structural.errors) };
	}
	// Z3 config constraints (SAT) check
	try {
		const res = await solveZ3Config(parsed.data);
		if (!res.ok) {
			return {
				ok: false,
				issues: res.errors.map((message) => ({
					code: "custom",
					path: ["root"],
					message
				})),
				warnings: structural.warnings
			};
		}
	} catch (e: any) {
		return {
			ok: false,
			issues: [
				{
					code: "custom",
					path: ["root"],
					message: `Z3 init/error: ${e?.message ?? e}`
				}
			],
			warnings: structural.warnings
		};
	}
	return { ok: true, issues: [], warnings: structural.warnings };
}
