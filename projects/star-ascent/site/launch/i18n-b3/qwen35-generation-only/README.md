# Qwen3.5 48-locale generation-only quarantine

This directory is an isolated, non-activating evaluation and workload harness for the 48 unresolved IAT locales. It is not connected to the runtime catalog, locale routing, public payload compiler, or activation scripts.

Current decision: `NO_GO_BULK_GENERATION_TIMEOUT`. The pinned official model passed file verification, but the CPU-only seven-case benchmark exceeded the ten-minute wall-clock cutoff without producing its atomic result. See `benchmark-timeout-evidence.json`. Tail-language quality therefore remains unproven, and even the optimistic observed rate projects to more than 73 days for the frozen workload.

Hard invariants:

- `activationAllowed` is always `false`.
- The only accepted source roster is the frozen 1,491-string evidence file with digest `5baff9a147d6390100a976e2d77b860ec0225db92f05ebb0d6361ac2c8981004`.
- The exact workload is 48 x 1,491 = 71,568 cells in deterministic locale/source order.
- Generated workload, checkpoint, benchmark, and draft files must be written under `E:\CodexCache`; source text is never sent to a remote service.
- Every model artifact is hash-verified before local loading.
- Greedy decoding, a pinned prompt, a one-string JSON response, and exact placeholder/ICU/URL/code/brand/number preservation are mandatory.
- Empty, protected-token-only, source-equivalent, English-echo, wrong-script, committed-heuristic wrong-language, and malformed outputs are rejected.
- Language heuristics are recomputed locally, are never caller-supplied proof, and never remove native-review requirements; replayed outputs remain explicitly unaccepted candidates.
- Any representative Guarani, Ayacucho Quechua, or Maltese benchmark failure stops bulk generation.
- Native review, locale-variant policy review, and training/output/redistribution legal review remain required.
- Activation requires a later, explicit change outside this directory.

The official model path is pinned in `model-provenance.json`. Apache-2.0 permits commercial use of the declared weights, but that fact is not a substitute for project legal review of training-data and generated-output risks.

Safe sequence:

1. Run the isolated tests with `node --test test/harness.test.mjs`.
2. Build the full external workload with `node build-workload.mjs --output-dir E:\CodexCache\iat-qwen35-workload`.
3. Download only the pinned official files into an external `E:` model cache and verify them with `verify-model-files.mjs`.
4. Run `tiny-benchmark.py` locally. It never calls an API and refuses model paths outside `E:\CodexCache`.
5. Run `node validate-benchmark.mjs --input E:\CodexCache\...\raw.json --output-dir E:\CodexCache\... --report-name validation.json`. The existing output parent is canonicalized, the report name must be one basename, and publishing is exclusive/no-overwrite. A single failed case leaves `bulkGenerationAllowed=false`.

No script here writes to `app/i18n`, `public`, `scripts`, package manifests, or runtime code.

The evaluated local runtime is pinned in `runtime-requirements.txt`. PyTorch must be installed from its official CPU wheel index; the remaining packages come from PyPI. Runtime package installation and all Hugging Face caches stay under `E:\CodexCache`.
