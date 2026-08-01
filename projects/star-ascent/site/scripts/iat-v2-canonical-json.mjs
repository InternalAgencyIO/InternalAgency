import { createHash } from "node:crypto";

const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function assertUnicode(value, path) {
  if (loneSurrogate.test(value)) throw new TypeError(`${path} contains a lone Unicode surrogate`);
}

export function canonicalizeRfc8785(value) {
  const ancestors = new Set();

  function serialize(current, path) {
    if (current === null) return "null";
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "string") {
      assertUnicode(current, path);
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new TypeError(`${path} contains a non-finite number`);
      return JSON.stringify(current);
    }
    if (typeof current !== "object") throw new TypeError(`${path} contains unsupported ${typeof current} data`);
    if (ancestors.has(current)) throw new TypeError(`${path} contains a cycle`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getOwnPropertySymbols(current).length !== 0) throw new TypeError(`${path} contains symbol keys`);
        const extraKeys = Object.keys(current).filter((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= current.length);
        if (extraKeys.length !== 0) throw new TypeError(`${path} contains non-JSON array properties`);
        const items = [];
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.hasOwn(current, index)) throw new TypeError(`${path}[${index}] is a sparse array entry`);
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}[${index}] must be a data property`);
          items.push(serialize(current[index], `${path}[${index}]`));
        }
        return `[${items.join(",")}]`;
      }
      if (Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
        throw new TypeError(`${path} must contain only plain JSON objects`);
      }
      if (Object.getOwnPropertySymbols(current).length !== 0) throw new TypeError(`${path} contains symbol keys`);
      const enumerableKeys = Object.keys(current);
      if (Object.getOwnPropertyNames(current).length !== enumerableKeys.length) throw new TypeError(`${path} contains non-enumerable data`);
      const entries = [];
      for (const key of enumerableKeys.sort()) {
        assertUnicode(key, `${path} key`);
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError(`${path}.${key} must be a data property`);
        entries.push(`${JSON.stringify(key)}:${serialize(descriptor.value, `${path}.${key}`)}`);
      }
      return `{${entries.join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  }

  return serialize(value, "$root");
}

export function sha256CanonicalJson(value) {
  const canonicalUtf8 = Buffer.from(canonicalizeRfc8785(value), "utf8");
  return createHash("sha256").update(canonicalUtf8).digest("hex");
}
