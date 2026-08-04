#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { normalizeAccountabilityLabel } from "./normalize-accountability-label.mjs";

assert.equal(
  normalizeAccountabilityLabel("ARCH\u0130VE OWNER"),
  normalizeAccountabilityLabel("Archive owner"),
  "Turkish dotted-I variants must not represent separate reviewers",
);
assert.equal(
  normalizeAccountabilityLabel("\uff21\uff52\uff43\uff48\uff49\uff56\uff45 Owner"),
  normalizeAccountabilityLabel("archive owner"),
  "full-width variants must not represent separate reviewers",
);
assert.equal(
  normalizeAccountabilityLabel("Rele\u0301ase Owner"),
  normalizeAccountabilityLabel("R\u00e9lease Owner"),
  "composed and decomposed labels must compare identically",
);
assert.equal(
  normalizeAccountabilityLabel("  Release\t\nOwner  "),
  normalizeAccountabilityLabel("Release Owner"),
  "padding and repeated Unicode whitespace must not represent separate reviewers",
);
assert.equal(
  normalizeAccountabilityLabel("Release\u200b Owner"),
  normalizeAccountabilityLabel("Release Owner"),
  "zero-width format characters must not represent separate reviewers",
);

console.log("Accountability-label normalization regression passes.");
