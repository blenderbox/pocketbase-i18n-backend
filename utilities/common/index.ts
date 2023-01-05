/**
 * A function that takes an array and returns an object with the keys being the result of the getKey function and the values being the result of the transform function.
 * @param array The array to transform.
 * @param getKey A function that takes an item from the array and returns a string to use as the key in the output object.
 * @param transform A function that takes an item from the array and returns a value to use as the value in the output object.
 * @returns An object with the keys being the result of the getKey function and the values being the result of the transform function.
 * @example
 * const array = [
 *  { id: "1", name: "John" },
 *  { id: "2", name: "Jane" },
 *  { id: "3", name: "Jack" },
 * ];
 * const output = arrayToObject(array, (item) => item.id, (item) => item.name);
 * // output = { "1": "John", "2": "Jane", "3": "Jack" }
 */
export function arrayToObject<
  T extends unknown = unknown,
  Transformed extends unknown = T
>(
  array: Maybe<Array<T>>,
  getKey: (item: NonNullable<T>) => Maybe<string>,
  transform: (item: NonNullable<T>) => Transformed = (item) =>
    item as Transformed
): Record<string, Transformed> {
  if (!array) return {};

  const output: Record<string, Transformed> = {};

  for (const item of array) {
    if (!item) continue;

    const key = getKey(item);

    if (!key) continue;

    const transformed = transform(item);

    output[key] = transformed;
  }

  return output;
}
