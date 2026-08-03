const inspectCustom = Symbol.for("nodejs.util.inspect.custom");

function printable(value) {
  if (typeof value === "bigint") return `${value}n`;
  if (value instanceof Uint8Array) return Array.from(value);
  return value;
}

// Switchboard uses util.inspect only to render OracleQuote debug output. This
// cycle-safe formatter preserves that non-protocol diagnostic surface without
// bundling a Node runtime implementation.
export function inspect(value, options = {}) {
  const seen = new WeakSet();
  const spacing = options.compact === false ? 2 : 0;
  const rendered = JSON.stringify(
    value,
    (_key, nested) => {
      const normalized = printable(nested);
      if (normalized && typeof normalized === "object") {
        if (seen.has(normalized)) return "[Circular]";
        seen.add(normalized);
      }
      return normalized;
    },
    spacing,
  );
  return rendered === undefined ? String(value) : rendered;
}

inspect.custom = inspectCustom;

const utilBrowserShim = { inspect };

export default utilBrowserShim;
