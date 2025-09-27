// Use ts-essentials first before defining new utilities.
import {
  IsNever,
  NonEmptyArray,
  UnionToIntersection,
  ValueOf
} from 'ts-essentials';

/**
 * Checks if a type is a non-empty object.
 *
 * @example
 * type Example1 = IsObject<{ a: number }>; // true
 * type Example2 = IsObject<{}>; // false
 * type Example3 = IsObject<string>; // false
 */
export type IsObject<T> = T extends object
  ? keyof T extends never
    ? false
    : true
  : false;

/**
 * Ensures that the array `U` includes the type `T`.
 *
 * @example
 * type Example1 = MustInclude<string, ['a', 'b', 'c']>; // never
 * type Example2 = MustInclude<'a', ['a', 'b', 'c']>; // ['a', 'b', 'c']
 */
export type MustInclude<T, U extends readonly T[]> = [T] extends [ValueOf<U>]
  ? U
  : never;

/**
 * WARNING: Compiles very slowly for large unions.
 * Generates all permutations of a union type `T`.
 *
 * @example
 * type Permutations = AllPermutations<'a' | 'b' | 'c'>;
 * // ['a', 'b', 'c'] | ['a', 'c', 'b'] | ['b', 'a', 'c'] | ['b', 'c', 'a'] | ['c', 'a', 'b'] | ['c', 'b', 'a']
 */
export type AllPermutations<T, K = T> =
  IsNever<T> extends true
    ? []
    : T extends any
      ? [T, ...AllPermutations<Exclude<K, T>>]
      : never;

/**
 * WARNING: Compiles very slowly for large unions.
 * Generates all combinations of a union type `U`.
 *
 * @example
 * type Combinations = AllCombinations<'a' | 'b' | 'c'>;
 * // ['a', ...AllCombinations<'b' | 'c'>] | ['b', ...AllCombinations<'a' | 'c'>] | ['c', ...AllCombinations<'a' | 'b'>]
 */
export type AllCombinations<U> = U extends any
  ? [U, ...AllCombinations<Exclude<U, U>>]
  : [];

/**
 * Converts a union type `U` into an overloaded function type.
 *
 * @example
 * type Result = UnionToOverloads<'a' | 'b'>;
 * // ((x: 'a') => void) & ((x: 'b') => void)
 */
export type UnionToOverloads<U> = UnionToIntersection<
  U extends any ? (x: U) => void : never
>;

/**
 * Extracts the first type from a union type `U`.
 *
 * @example
 * type Result = FirstInUnion<'a' | 'b' | 'c'>; // 'a'
 */
export type FirstInUnion<U> =
  UnionToOverloads<U> extends (x: infer First) => any ? First : never;

/**
 * Extracts the last type from a union type `U`.
 *
 * @example
 * type Result = LastInUnion<'a' | 'b' | 'c'>; // 'c'
 */
export type LastInUnion<U> =
  UnionToIntersection<U extends any ? () => U : never> extends () => infer R
    ? R
    : never;

/**
 * Converts a union type `U` into a tuple type.
 * Note: The order of the tuple elements is not guaranteed.
 *
 * @example
 * type Result = UnionToTuple<'a' | 'b' | 'c'>; // ['a', 'b', 'c'] or ['c', 'b', 'a']
 */
export type UnionToTuple<U, T extends any[] = []> =
  IsNever<U> extends true
    ? T
    : UnionToTuple<Exclude<U, LastInUnion<U>>, [LastInUnion<U>, ...T]>;

/**
 * An array of a given type comprised of either exactly or at least a certain count of that type.
 *
 * @example
 * type ExactlyThreeStrings = ArrayOf<'exactly', 3, string>; // [string, string, string]
 * type AtLeastTwoNumbers = ArrayOf<'at least', 2, number>; // [number, number, ...number[]]
 */
export type ArrayOf<
  Quantifier extends 'exactly' | 'at least',
  Count extends number,
  Type
> = Quantifier extends 'exactly'
  ? _BuildTuple<Count, Type>
  : _BuildAtLeastTuple<Count, Type>;

type _BuildTuple<
  Count extends number,
  Type,
  Tuple extends Type[] = []
> = Tuple['length'] extends Count
  ? Tuple
  : _BuildTuple<Count, Type, [...Tuple, Type]>;

type _BuildAtLeastTuple<
  Count extends number,
  Type,
  Tuple extends Type[] = []
> = Tuple['length'] extends Count
  ? [...Tuple, ...NonEmptyArray<Type>]
  : _BuildAtLeastTuple<Count, Type, [...Tuple, Type]>;

/**
 * Maps a tuple of keys and either one type for all keys or a tuple of equal length to the keys tuple into a tuple of key-value pairs.
 *
 * @example
 * type Example = MapEntries<['a', 'b'], [1, 2]>; // [['a', 1], ['b', 2]]\
 * type Example2 = MapEntries<['a', 'b'], number>; // [['a', number], ['b', number]]
 * type Example3 = MapEntries<['a', 'b'], number[]>; // [['a', number[]], ['b', number[]]]
 */
export type MapEntries<
  Keys extends readonly any[],
  Values
> = Values extends readonly unknown[]
  ? Values extends { length: Keys['length'] }
    ? _MapEntries<Keys, Values>
    : MapEntriesResult<Keys[number], never>
  : _MapEntries<Keys, { [K in keyof Keys]: Values }>;

type MapEntriesResult<K, V> = readonly (readonly [K, V])[];

type _MapEntries<
  Keys extends readonly any[],
  Values extends readonly any[]
> = Keys extends readonly [infer K, ...infer KTail]
  ? Values extends readonly [infer V, ...infer VTail]
    ? readonly [[K, V], ..._MapEntries<KTail, VTail>]
    : []
  : [];

/**
 * Converts a tuple of entries into an object type.
 *
 * @example
 * type Example = EntriesToObject<[['a', 1], ['b', 2]]>; // { a: 1; b: 2 }
 */
export type EntriesToObject<T extends readonly any[]> = T extends readonly []
  ? {}
  : T extends readonly [[infer K, infer V], ...infer Rest]
    ? K extends string
      ? Rest extends readonly any[]
        ? { [P in K]: V } & EntriesToObject<Rest>
        : never
      : never
    : never;

/**
 * Validates whether a tuple `T` is a subset of the union `U`.
 * Returns `T` if valid, otherwise `never`.
 *
 * @example
 * type Valid1 = ValidateSubset<['a', 'b'], 'a' | 'b' | 'c'>; // ['a', 'b']
 * type Valid2 = ValidateSubset<[], 'a' | 'b'>; // []
 * type Invalid1 = ValidateSubset<['a', 'd'], 'a' | 'b' | 'c'>; // never
 * type Invalid2 = ValidateSubset<['a', 'a'], 'a' | 'b'>; // never
 */
export type ValidateSubset<
  T extends readonly any[],
  U extends string | number | symbol
> = T extends [infer Head, ...infer Tail]
  ? Head extends U
    ? Head extends Tail[number]
      ? never // Duplicate detected
      : ValidateSubset<Tail, U> // Recurse on Tail
    : never // Head not in U
  : T; // Base case: empty tuple is always a valid subset

/**
 * Recursively extracts nested keys from an object, including array indices.
 *
 * @example
 * type Example = Paths<{
 *   a: {
 *     b: string;
 *     c: number[];
 *   };
 *   d: boolean;
 * }>
 * // "a" | "a.b" | "a.c" | "a.c.0" | "a.c.1" | "d"
 * @see https://stackoverflow.com/a/67214945
 */
export type Paths<T> =
  T extends Array<infer U>
    ? `${number}` | `${number}.${Paths<U>}`
    : T extends object
      ? {
          [K in keyof T & (string | number)]: undefined extends T[K]
            ? K | `${K}.${Paths<NonNullable<T[K]>>}`
            : T[K] extends Array<infer U>
              ? K | `${K}.${number}.${Paths<U>}`
              : IsObject<T[K]> extends true
                ? K | `${K}.${Paths<T[K]>}`
                : K;
        }[keyof T & (string | number)]
      : never;

/**
 * Recursively extracts nested keys from an object, excluding array indices.
 *
 * @example
 * type Example = Paths<{
 *   a: {
 *     b: string;
 *     c: number[];
 *   };
 *   d: boolean;
 * }>
 * // "a" | "a.b" | "a.c" | "d"
 * @see https://stackoverflow.com/a/67214945
 */
export type PathsWithoutIndices<T> =
  T extends Array<infer U>
    ? PathsWithoutIndices<U>
    : T extends object
      ? {
          [K in keyof T & (string | number)]: undefined extends T[K]
            ? K | `${K}.${PathsWithoutIndices<NonNullable<T[K]>>}`
            : T[K] extends Array<infer U>
              ? K | `${K}.${PathsWithoutIndices<U>}`
              : IsObject<T[K]> extends true
                ? K | `${K}.${PathsWithoutIndices<T[K]>}`
                : K;
        }[keyof T & (string | number)]
      : never;

/**
 * Recursively extracts nested keys from an object that lead to array values, including array indices.
 *
 * @example
 * type Example = ArrayPaths<{
 *   a: {
 *     b: string;
 *     c: number[];
 *   };
 *   d: boolean;
 *   e: string[][];
 * }>
 * // "a.c" | "a.c.0" | "e" | "e.0" | "e.0.0"
 */
export type PathsArrays<T> =
  T extends Array<infer U>
    ? `${number}` | `${number}.${PathsArrays<U>}`
    : T extends object
      ? {
          [K in keyof T & (string | number)]: T[K] extends Array<infer U>
            ? K | `${K}.${PathsArrays<T[K]>}`
            : T[K] extends object
              ? `${K}.${PathsArrays<T[K]>}`
              : never;
        }[keyof T & (string | number)]
      : never;

/**
 * Recursively extracts nested keys from an object that lead to array values, excluding array indices.
 *
 * @example
 * type Example = ArrayPathsWithoutIndices<{
 *   a: {
 *     b: string;
 *     c: number[];
 *   };
 *   d: boolean;
 *   e: string[][];
 * }>
 * // "a.c" | "e"
 */
export type PathsArrayWithoutIndices<T> =
  T extends Array<infer U>
    ? PathsArrayWithoutIndices<U>
    : T extends object
      ? {
          [K in keyof T & (string | number)]: T[K] extends Array<any>
            ? K | `${K}.${PathsArrayWithoutIndices<T[K]>}`
            : T[K] extends object
              ? `${K}.${PathsArrayWithoutIndices<T[K]>}`
              : never;
        }[keyof T & (string | number)]
      : never;
