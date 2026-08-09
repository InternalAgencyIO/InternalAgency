/**
 * Dependency-free validator for the Draft-07 keywords used by this proposal.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This is not a general JSON Schema implementation. Portable consumers should
 * use any conforming Draft-07 validator; this module keeps proposal tests
 * reproducible without adding a dependency.
 */

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function instanceType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveLocalRef(rootSchema, reference) {
  if (typeof reference !== "string" || !reference.startsWith("#/")) {
    throw new Error("ONLY_LOCAL_SCHEMA_REFS_SUPPORTED");
  }
  let current = rootSchema;
  for (const segment of reference.slice(2).split("/").map(decodePointerSegment)) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      throw new Error("SCHEMA_REF_NOT_FOUND");
    }
    current = current[segment];
  }
  return current;
}

export function validateJsonSchemaSubset(schema, instance) {
  const errors = [];
  const add = (instancePath, schemaPath, keyword, message) => {
    errors.push({ instancePath, schemaPath, keyword, message });
  };
  const visit = (node, value, instancePath, schemaPath) => {
    if (node.$ref) {
      visit(resolveLocalRef(schema, node.$ref), value, instancePath, node.$ref);
      return;
    }
    if (Object.hasOwn(node, "const") && !deepEqual(value, node.const)) {
      add(instancePath, `${schemaPath}/const`, "const", "must equal the fixed value");
      return;
    }
    if (node.enum && !node.enum.some((candidate) => deepEqual(value, candidate))) {
      add(instancePath, `${schemaPath}/enum`, "enum", "must equal one allowed value");
      return;
    }
    if (node.type) {
      const actual = instanceType(value);
      const allowed = Array.isArray(node.type) ? node.type : [node.type];
      const typeMatches = allowed.some((type) =>
        type === actual || (type === "number" && actual === "integer"),
      );
      if (!typeMatches) {
        add(instancePath, `${schemaPath}/type`, "type", `must be ${allowed.join(" or ")}`);
        return;
      }
    }
    if (typeof value === "string") {
      if (node.pattern && !(new RegExp(node.pattern)).test(value)) {
        add(instancePath, `${schemaPath}/pattern`, "pattern", "must match the fixed pattern");
      }
      if (node.minLength !== undefined && value.length < node.minLength) {
        add(instancePath, `${schemaPath}/minLength`, "minLength", "is too short");
      }
      if (node.maxLength !== undefined && value.length > node.maxLength) {
        add(instancePath, `${schemaPath}/maxLength`, "maxLength", "is too long");
      }
    }
    if (Array.isArray(value)) {
      if (node.minItems !== undefined && value.length < node.minItems) {
        add(instancePath, `${schemaPath}/minItems`, "minItems", "has too few items");
      }
      if (node.maxItems !== undefined && value.length > node.maxItems) {
        add(instancePath, `${schemaPath}/maxItems`, "maxItems", "has too many items");
      }
      if (node.uniqueItems === true) {
        const serialized = value.map((item) => JSON.stringify(item));
        if (new Set(serialized).size !== serialized.length) {
          add(instancePath, `${schemaPath}/uniqueItems`, "uniqueItems", "has duplicate items");
        }
      }
      if (Array.isArray(node.items)) {
        value.forEach((item, index) => {
          const itemSchema = node.items[index];
          if (itemSchema) visit(itemSchema, item, `${instancePath}/${index}`, `${schemaPath}/items/${index}`);
          else if (node.additionalItems === false) {
            add(`${instancePath}/${index}`, `${schemaPath}/additionalItems`, "additionalItems", "is not allowed");
          }
        });
      } else if (node.items) {
        value.forEach((item, index) =>
          visit(node.items, item, `${instancePath}/${index}`, `${schemaPath}/items`),
        );
      }
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const required of node.required ?? []) {
        if (!Object.hasOwn(value, required)) {
          add(instancePath, `${schemaPath}/required`, "required", `missing ${required}`);
        }
      }
      for (const [key, child] of Object.entries(value)) {
        if (node.properties?.[key]) {
          visit(
            node.properties[key],
            child,
            `${instancePath}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
            `${schemaPath}/properties/${key}`,
          );
        } else if (node.additionalProperties === false) {
          add(
            `${instancePath}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
            `${schemaPath}/additionalProperties`,
            "additionalProperties",
            "is not allowed",
          );
        }
      }
    }
  };
  visit(schema, instance, "", "#");
  return errors;
}

export function applyJsonPointerMutation(value, mutation) {
  if (!mutation || !["add", "remove", "replace"].includes(mutation.operation)) {
    throw new Error("UNSUPPORTED_EXAMPLE_MUTATION");
  }
  if (typeof mutation.path !== "string" || !mutation.path.startsWith("/")) {
    throw new Error("INVALID_EXAMPLE_MUTATION_PATH");
  }
  const clone = structuredClone(value);
  const segments = mutation.path.slice(1).split("/").map(decodePointerSegment);
  const final = segments.pop();
  let parent = clone;
  for (const segment of segments) {
    if (!parent || typeof parent !== "object" || !(segment in parent)) {
      throw new Error("EXAMPLE_MUTATION_PARENT_NOT_FOUND");
    }
    parent = parent[segment];
  }
  if (mutation.operation === "add") {
    parent[final] = structuredClone(mutation.value);
  } else {
    if (!Object.hasOwn(parent, final)) throw new Error("EXAMPLE_MUTATION_TARGET_NOT_FOUND");
    if (mutation.operation === "remove") delete parent[final];
    else parent[final] = structuredClone(mutation.value);
  }
  return clone;
}
