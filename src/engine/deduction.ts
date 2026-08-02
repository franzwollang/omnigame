/**
 * Deduction / Guess Who-lite helpers (pure).
 * Secrets from seeded RNG; queries prune candidate boards.
 */
import { runSeeded } from "@/engine/rng";
import type { DeductionCharacter } from "@/engine/types";

/** Assign distinct secrets for X and O from roster ids (when length ≥ 2). */
export function assignSecrets(
	rosterIds: string[],
	seed: number
): { X: string; O: string } {
	if (rosterIds.length === 0) {
		return { X: "", O: "" };
	}
	const draws = runSeeded(seed, 2);
	const n = rosterIds.length;
	const iX = Math.floor(draws[0]! * n) % n;
	let iO = Math.floor(draws[1]! * n) % n;
	if (n >= 2 && iO === iX) {
		iO = (iO + 1) % n;
	}
	return { X: rosterIds[iX]!, O: rosterIds[iO]! };
}

/** Does the secret character match the queried trait=value? */
export function answerQuery(
	secretId: string,
	roster: readonly DeductionCharacter[],
	trait: string,
	value: boolean
): boolean {
	const character = roster.find((c) => c.id === secretId);
	if (!character) return false;
	return character.traits[trait] === value;
}

/**
 * Append newly eliminated roster ids for the querier after a query answer.
 * Candidates inconsistent with the answer are pruned.
 */
export function eliminateAfterQuery(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	trait: string,
	value: boolean,
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const next = [...eliminated];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = character.traits[trait] === value;
		if (matches !== answer) {
			next.push(character.id);
		}
	}
	return next;
}

/**
 * Roster ids still active that are inconsistent with a query answer
 * (candidates a rational player would flip after that answer).
 */
export function candidatesInconsistentWithQuery(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	trait: string,
	value: boolean,
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const out: string[] = [];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = character.traits[trait] === value;
		if (matches !== answer) out.push(character.id);
	}
	return out;
}

/** True when `id` is on the roster and not already eliminated. */
export function canEliminate(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	id: string
): boolean {
	if (!roster.some((c) => c.id === id)) return false;
	return !eliminated.includes(id);
}

export function isGuessCorrect(secretId: string, guessId: string): boolean {
	return secretId === guessId;
}
