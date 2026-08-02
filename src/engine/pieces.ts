/**
 * Piece identity helpers for CellValue marks (M49 Transform lite).
 * Uncrowned seats are Player ("X"|"O"); crowned kings are CrownMark ("X+"|"O+").
 */
import type { CellValue, CrownMark, Player } from "@/engine/types";

export function cellOwner(v: CellValue): Player | null {
	if (v === "X" || v === "X+") return "X";
	if (v === "O" || v === "O+") return "O";
	return null;
}

export function isCrowned(v: CellValue): boolean {
	return v === "X+" || v === "O+";
}

export function isPieceMark(v: CellValue): v is Player | CrownMark {
	return v === "X" || v === "O" || v === "X+" || v === "O+";
}

/** Promote an uncrowned seat mark; already crowned → same crown; non-piece → null. */
export function promote(v: CellValue): CrownMark | null {
	if (v === "X" || v === "X+") return "X+";
	if (v === "O" || v === "O+") return "O+";
	return null;
}
