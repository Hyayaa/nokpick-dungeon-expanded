/**
 * Removes inactive animation records without allocating a replacement array.
 * The renderer owns these arrays exclusively, so stable identity is safe and
 * avoids several short-lived allocations on every animation frame.
 */
export function retainInPlace<T>(
  items: T[],
  keep: (item: T, index: number) => boolean,
) {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
    const item = items[readIndex];
    if (!keep(item, readIndex)) continue;
    items[writeIndex] = item;
    writeIndex += 1;
  }
  items.length = writeIndex;
  return items;
}
