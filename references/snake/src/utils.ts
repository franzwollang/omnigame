import { Coordinate } from "./types";

export function mod(n: number, m: number) {
	return ((n % m) + m) % m;
}

export function randomNumber(range: number) {
	return Math.floor(Math.random() * range);
}

export function randomCoordinate(xRange: number, yRange: number) {
	return [randomNumber(xRange), randomNumber(yRange)];
}

export function styleSquare(element: Element, styleClass: string) {
	element.classList.toggle(styleClass);
}

export function coordToId([x, y]: Coordinate): string {
	return `${x}-${y}`;
}

export function idToCoord(id: string): Coordinate {
	return id.split("-").map(Number) as Coordinate;
}
