/**
 * Deduction / Guess Who-lite helpers (pure).
 * Secrets from seeded RNG; queries prune candidate boards.
 */
import { runSeeded } from "@/engine/rng";
import type { DeductionCharacter, QueryClause } from "@/engine/types";

export type { QueryClause };

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

/** True iff the secret satisfies every clause (AND). */
export function answerQueryConjunction(
	secretId: string,
	roster: readonly DeductionCharacter[],
	clauses: readonly QueryClause[]
): boolean {
	const character = roster.find((c) => c.id === secretId);
	if (!character) return false;
	for (const clause of clauses) {
		if (character.traits[clause.trait] !== clause.value) return false;
	}
	return true;
}

/** True iff the secret satisfies at least one clause (OR). */
export function answerQueryDisjunction(
	secretId: string,
	roster: readonly DeductionCharacter[],
	clauses: readonly QueryClause[]
): boolean {
	const character = roster.find((c) => c.id === secretId);
	if (!character) return false;
	for (const clause of clauses) {
		if (character.traits[clause.trait] === clause.value) return true;
	}
	return false;
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
 * Prune candidates inconsistent with a conjunction answer.
 * YES ⇒ keep only ids that match all clauses; NO ⇒ prune ids that match all.
 */
export function eliminateAfterQueryConjunction(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	clauses: readonly QueryClause[],
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const next = [...eliminated];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = clauses.every(
			(c) => character.traits[c.trait] === c.value
		);
		if (matches !== answer) {
			next.push(character.id);
		}
	}
	return next;
}

/**
 * Prune candidates inconsistent with a disjunction answer.
 * YES ⇒ keep only ids that match ≥1 clause; NO ⇒ prune ids that match ≥1
 * (keep only ids that match none).
 */
export function eliminateAfterQueryDisjunction(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	clauses: readonly QueryClause[],
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const next = [...eliminated];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = clauses.some(
			(c) => character.traits[c.trait] === c.value
		);
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

/** Active candidates inconsistent with a conjunction answer. */
export function candidatesInconsistentWithQueryConjunction(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	clauses: readonly QueryClause[],
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const out: string[] = [];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = clauses.every(
			(c) => character.traits[c.trait] === c.value
		);
		if (matches !== answer) out.push(character.id);
	}
	return out;
}

/** Active candidates inconsistent with a disjunction answer. */
export function candidatesInconsistentWithQueryDisjunction(
	roster: readonly DeductionCharacter[],
	eliminated: readonly string[],
	clauses: readonly QueryClause[],
	answer: boolean
): string[] {
	const already = new Set(eliminated);
	const out: string[] = [];
	for (const character of roster) {
		if (already.has(character.id)) continue;
		const matches = clauses.some(
			(c) => character.traits[c.trait] === c.value
		);
		if (matches !== answer) out.push(character.id);
	}
	return out;
}

/**
 * Enumerate 2-clause compound queries over distinct traits (AND or OR configs).
 * For n traits: C(n,2) × 4 boolean combinations.
 */
export function enumerateTwoClauseQueries(
	traits: readonly string[]
): Array<{ type: "query"; clauses: [QueryClause, QueryClause] }> {
	const out: Array<{ type: "query"; clauses: [QueryClause, QueryClause] }> =
		[];
	for (let i = 0; i < traits.length; i++) {
		for (let j = i + 1; j < traits.length; j++) {
			const a = traits[i]!;
			const b = traits[j]!;
			for (const va of [true, false] as const) {
				for (const vb of [true, false] as const) {
					out.push({
						type: "query",
						clauses: [
							{ trait: a, value: va },
							{ trait: b, value: vb }
						]
					});
				}
			}
		}
	}
	return out;
}

/** @deprecated Prefer {@link enumerateTwoClauseQueries} (shared by and/or). */
export const enumerateConjunctionQueries = enumerateTwoClauseQueries;

/** Compact fingerprint for a query action or lastQuery payload. */
export function formatQueryFingerprint(q: {
	trait?: string;
	value?: boolean;
	clauses?: readonly QueryClause[];
	/** Clause operator when `clauses` is set (default and). */
	op?: "and" | "or";
	answer?: boolean;
}): string {
	if (q.clauses && q.clauses.length > 0) {
		const joiner = q.op === "or" ? "|" : "&";
		const body = q.clauses
			.map((c) => `${c.trait}=${c.value}`)
			.join(joiner);
		return q.answer === undefined ? body : `${body}:${q.answer}`;
	}
	const body = `${q.trait}=${q.value}`;
	return q.answer === undefined ? body : `${body}:${q.answer}`;
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
