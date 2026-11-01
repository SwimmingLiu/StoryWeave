import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  const ancestors = new Set();
  const normalize = (item) => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (!item || typeof item !== 'object') throw new TypeError('Only JSON values can be fingerprinted.');
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('Only JSON objects can be fingerprinted.');
    if (ancestors.has(item)) throw new TypeError('Cyclic values cannot be fingerprinted.');
    ancestors.add(item);
    const result = Array.isArray(item)
      ? item.map(normalize)
      : Object.fromEntries(Object.keys(item).sort().filter((key) => item[key] !== undefined).map((key) => [key, normalize(item[key])]));
    ancestors.delete(item);
    return result;
  };
  return JSON.stringify(normalize(value));
}

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashValue(value) {
  return hashBytes(canonicalJson(value));
}

export function freezeJson(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}
