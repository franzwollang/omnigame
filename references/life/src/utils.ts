///////////////////////////////////////
//// DOM-related Utilities & Types ////
///////////////////////////////////////

export function querySelector(selector: string) {
	return document.querySelector(selector) as HTMLElement;
}

export function querySelectorAll(selector: string) {
	return document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
}

export function getRoot() {
	return document.documentElement as HTMLElement;
}

export function setCSSVar(CSSVar: string, value: string | number) {
	const root = getRoot();
	root.style.setProperty(CSSVar, String(value));
}

export function getCSSVar(CSSVar: string) {
	const root = getRoot();
	getComputedStyle(root).getPropertyValue(CSSVar);
}

export function toggleClass(element: Element, styleClass: string) {
	element.classList.toggle(styleClass);
}

export function removeChildren(element: Element) {
	while (element.lastElementChild) {
		element.removeChild(element.lastElementChild);
	}
}

/////////////////////////////////////////
//// Maths-related Utilities & Types ////
/////////////////////////////////////////

export type Bound = [number, number];
export type Vec2 = [number, number];

export function mod(dividend: number, divisor: number) {
	return ((dividend % divisor) + divisor) % divisor;
}

export function randPosInt(range: number) {
	return Math.floor(Math.random() * range);
}

export function randInt([leftBound, rightBound]: Bound) {
	const range = Math.abs(rightBound) + Math.abs(leftBound);
	const centeredRandInt = randPosInt(range);
	return centeredRandInt + leftBound;
}

export function randVec2(xBounds: Bound, yBounds: Bound): Vec2 {
	return [randInt(xBounds), randInt(yBounds)];
}

export function randPosVec2(xRange: number, yRange: number): Vec2 {
	return [randPosInt(xRange), randPosInt(yRange)];
}

export function sampleGaussian(mean: number, stdDev: number) {
	let u = 0,
		v = 0;
	while (u === 0) u = Math.random(); //Converting [0,1) to (0,1)
	while (v === 0) v = Math.random();
	let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
	num = num * stdDev + mean; // Translate to desired mean and standard deviation
	return num;
}

///////////////////////////////////////////
//// Spatial-related Utilities & Types ////
///////////////////////////////////////////

export type Coordinate2D = [number, number];
export type Coordinate3D = [number, number, number];

export function coordToId<T extends Coordinate2D | Coordinate3D>(
	coordinate: T
) {
	return "__" + coordinate.join("_");
}

export function idToCoord<T extends Coordinate2D | Coordinate3D>(id: string) {
	return id.replace("__", "").split("_").map(Number) as T;
}

export type Entity2D = {
	position: Coordinate2D;
};

export type Entity3D = {
	position: Coordinate3D;
};

/////////////////////////////////////////
//// Logic-related Utilities & Types ////
/////////////////////////////////////////

export type Predicate<T> = (...args: Array<T>) => boolean;

/**
 * An implementation of the boolean operator XOR (exclusive or).
 */
export function XOR(a: boolean, b: boolean) {
	return (a || b) && !(a && b);
}

/**
 * A function like Array.prototype.map but it takes a binary function and applies it
 * to every possible 2-element combination of elements in an array.
 * @param operation A binary function that returns a single value.
 * @param arrayLike An iterable collection with a known size.
 */
export function map2comb<T, O>(
	operation: (arg1: T, arg2: T) => O,
	arrayLike: ArrayLike<T>
) {
	const results: Array<O> = [];

	for (let i = 0; i < arrayLike.length; i++) {
		for (let j = i + 1; j < arrayLike.length; j++) {
			const left = arrayLike[i] as T;
			const right = arrayLike[j] as T;
			results.push(operation(left, right));
		}
	}

	return results;
}

export function map2wise<T, O>(
	operation: (a: T, b: T) => O,
	arrayLike: ArrayLike<T>
) {
	const results: Array<O> = [];

	for (let i = 0; i < arrayLike.length - 1; i++) {
		const left = arrayLike[i];
		const right = arrayLike[i + 1];
		results.push(operation(left, right));
	}

	return results;
}

/**
 * A utility that implements the constraint of a quantifier on the output of a predicate applied to a collection.
 * @param constraint The number of elements of the collection that should be true. This corresponds to the number of elements of the collection that should satisfy the predicate.
 * @param booleanSet An iterable collection with a known size.
 * @returns A boolean value indicating whether the constraint is satisfied over the given boolean set.
 */
export function quantifier(
	booleanSet: ArrayLike<boolean>,
	equality: "eq" | "lt" | "lte" | "gt" | "gte",
	quantity: number
) {
	quantity = mod(quantity, booleanSet.length);
	let constraint: (population: number) => boolean;

	switch (equality) {
		case "eq":
			constraint = (population) => population === quantity;
			break;
		case "lt":
			constraint = (population) => population < quantity;
			break;
		case "lte":
			constraint = (population) => population <= quantity;
			break;
		case "gt":
			constraint = (population) => population > quantity;
			break;
		case "gte":
			constraint = (population) => population >= quantity;
			break;
		default:
			throw new Error("Invalid equality constraint.");
	}

	return constraint(
		Array.from(booleanSet).reduce((accum, val) => accum + Number(val), 0)
	);
}
