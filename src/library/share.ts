/**
 * Share-link helpers for library finds (post-M7 depth).
 *
 * Two encodings:
 * - Explore pointer: seed + index (+ count/coherentFraction) — tiny URLs, deterministic.
 * - Config payload: base64url JSON — self-contained find, no re-sample needed.
 */
import type { Config } from "@/schemas/config";
import { zConfig } from "@/schemas/config";
import { exploreLibrary } from "@/library/explore";

export type ExploreShareParams = {
	seed: number;
	index: number;
	count?: number;
	coherentFraction?: number;
};

export type DecodedShare =
	| { kind: "explore"; params: ExploreShareParams; config: Config }
	| { kind: "config"; config: Config };

const DEFAULT_COUNT = 24;
const DEFAULT_COHERENT = 0.35;

/** URL-safe base64 without padding. */
export function toBase64Url(bytes: string): string {
	const b64 =
		typeof btoa === "function"
			? btoa(bytes)
			: Buffer.from(bytes, "binary").toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(b64url: string): string {
	const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const b64 = padded + "=".repeat(padLen);
	if (typeof atob === "function") return atob(b64);
	return Buffer.from(b64, "base64").toString("binary");
}

function utf8ToBinary(text: string): string {
	if (typeof TextEncoder !== "undefined") {
		const bytes = new TextEncoder().encode(text);
		let s = "";
		for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
		return s;
	}
	return Buffer.from(text, "utf8").toString("binary");
}

function binaryToUtf8(binary: string): string {
	if (typeof TextDecoder !== "undefined") {
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
		return new TextDecoder().decode(bytes);
	}
	return Buffer.from(binary, "binary").toString("utf8");
}

/** Encode a Config as a self-contained `find` query value. */
export function encodeConfigShare(config: Config): string {
	return toBase64Url(utf8ToBinary(JSON.stringify(config)));
}

/** Decode a `find` query value back to Config (or null). */
export function decodeConfigShare(encoded: string): Config | null {
	try {
		const json = binaryToUtf8(fromBase64Url(encoded));
		const parsed = zConfig.safeParse(JSON.parse(json));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** Build query string for an explore-pointer share (no leading `?`). */
export function encodeExploreShare(params: ExploreShareParams): string {
	const q = new URLSearchParams();
	q.set("librarySeed", String(params.seed >>> 0));
	q.set("libraryIndex", String(Math.max(0, params.index | 0)));
	if (params.count != null && params.count !== DEFAULT_COUNT) {
		q.set("libraryCount", String(params.count));
	}
	if (
		params.coherentFraction != null &&
		params.coherentFraction !== DEFAULT_COHERENT
	) {
		q.set("libraryCf", String(params.coherentFraction));
	}
	return q.toString();
}

/**
 * Resolve explore pointer by re-running the deterministic sampler.
 * Returns null if index out of range or sample isn't a loadable playable.
 */
export function resolveExploreShare(
	params: ExploreShareParams
): Config | null {
	const count = Math.max(1, params.count ?? DEFAULT_COUNT);
	const summary = exploreLibrary({
		seed: params.seed >>> 0,
		count,
		coherentFraction: params.coherentFraction ?? DEFAULT_COHERENT,
		maxPlayoutSteps: 28
	});
	const sample = summary.samples[params.index];
	if (!sample?.config) return null;
	if (sample.playability.kind !== "playable") return null;
	return sample.config;
}

/** Parse sandbox URL search params into a decoded share (prefer `find`). */
export function parseSandboxShare(
	search: string | URLSearchParams
): DecodedShare | null {
	const params =
		typeof search === "string"
			? new URLSearchParams(
					search.startsWith("?") ? search.slice(1) : search
				)
			: search;

	const find = params.get("find");
	if (find) {
		const config = decodeConfigShare(find);
		if (config) return { kind: "config", config };
	}

	const seedRaw = params.get("librarySeed");
	const indexRaw = params.get("libraryIndex");
	if (seedRaw == null || indexRaw == null) return null;
	const seed = Number(seedRaw);
	const index = Number(indexRaw);
	if (!Number.isFinite(seed) || !Number.isFinite(index)) return null;

	const countRaw = params.get("libraryCount");
	const cfRaw = params.get("libraryCf");
	const exploreParams: ExploreShareParams = {
		seed: seed >>> 0,
		index: Math.max(0, index | 0),
		...(countRaw != null && Number.isFinite(Number(countRaw))
			? { count: Math.max(1, Number(countRaw) | 0) }
			: {}),
		...(cfRaw != null && Number.isFinite(Number(cfRaw))
			? { coherentFraction: Math.min(1, Math.max(0, Number(cfRaw))) }
			: {})
	};
	const config = resolveExploreShare(exploreParams);
	if (!config) return null;
	return { kind: "explore", params: exploreParams, config };
}

/** Absolute or path share URL for a config find (`/sandbox?find=…`). */
export function buildConfigSharePath(
	config: Config,
	basePath = "/sandbox"
): string {
	return `${basePath}?find=${encodeURIComponent(encodeConfigShare(config))}`;
}

/** Path share URL for an explore pointer. */
export function buildExploreSharePath(
	params: ExploreShareParams,
	basePath = "/sandbox"
): string {
	const q = encodeExploreShare(params);
	return `${basePath}?${q}`;
}
