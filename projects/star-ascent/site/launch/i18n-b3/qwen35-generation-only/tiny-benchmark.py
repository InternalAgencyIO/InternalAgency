#!/usr/bin/env python3
"""Local-only deterministic benchmark for the pinned official Qwen3.5-0.8B files."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"

MODEL_REVISION = "2fc06364715b967f1860aea9cf38778875588b17"
CACHE_ROOT = Path(r"E:\CodexCache").resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--threads", type=int, default=min(os.cpu_count() or 1, 16))
    parser.add_argument("--max-new-tokens", type=int, default=160)
    parser.add_argument("--max-total-seconds", type=int, default=600)
    return parser.parse_args()


def require_cache_child(raw_path: str, kind: str) -> Path:
    target = Path(raw_path).resolve()
    try:
        relative = target.relative_to(CACHE_ROOT)
    except ValueError as exc:
        raise SystemExit(f"{kind} must be under {CACHE_ROOT}: {target}") from exc
    if not relative.parts:
        raise SystemExit(f"{kind} must be a child of {CACHE_ROOT}")
    return target


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_model_files(model_dir: Path, provenance: dict) -> list[dict]:
    verified = []
    for expected in provenance["files"]:
        file_path = model_dir / expected["path"]
        if not file_path.is_file():
            raise SystemExit(f"missing pinned model file: {expected['path']}")
        size = file_path.stat().st_size
        if size != expected["bytes"]:
            raise SystemExit(f"{expected['path']} size {size} != {expected['bytes']}")
        digest = sha256_file(file_path)
        if digest != expected["sha256"]:
            raise SystemExit(f"{expected['path']} SHA-256 {digest} != {expected['sha256']}")
        verified.append({"path": expected["path"], "bytes": size, "sha256": digest})
    return verified


def render_prompt(template: str, locale_entry: dict, source: str, protected_counts: list[dict]) -> str:
    values = {
        "{{TARGET_LOCALE}}": locale_entry["locale"],
        "{{TARGET_LANGUAGE}}": locale_entry["targetLanguage"],
        "{{TARGET_SCRIPT}}": locale_entry["script"],
        "{{PROTECTED_TOKENS_JSON}}": json.dumps(protected_counts, ensure_ascii=False, separators=(",", ":")),
        "{{SOURCE_JSON}}": json.dumps(source, ensure_ascii=False),
    }
    result = template
    for marker, value in values.items():
        if marker not in result:
            raise SystemExit(f"prompt marker missing: {marker}")
        result = result.replace(marker, value)
    if "{{" in result or "}}" in result:
        raise SystemExit("unresolved prompt marker")
    return result


def main() -> int:
    args = parse_args()
    model_dir = require_cache_child(args.model_dir, "model directory")
    output = require_cache_child(args.output, "benchmark output")
    if output.exists():
        raise SystemExit(f"refusing to replace benchmark output: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    here = Path(__file__).resolve().parent
    provenance = json.loads((here / "model-provenance.json").read_text(encoding="utf-8"))
    locale_map = json.loads((here / "locale-map.json").read_text(encoding="utf-8"))
    fixture_bytes = (here / "fixtures" / "tiny-benchmark-cases.json").read_bytes()
    fixtures = json.loads(fixture_bytes.decode("utf-8"))
    prompt_bytes = (here / "prompt-template.txt").read_bytes()
    prompt_template = prompt_bytes.decode("utf-8")
    prompt_sha256 = hashlib.sha256(prompt_bytes).hexdigest()
    if provenance["model"]["revision"] != MODEL_REVISION or provenance["activationAllowed"] is not False:
        raise SystemExit("model provenance invariant failed")
    if fixtures["model"] != {"repository": provenance["model"]["repository"], "revision": MODEL_REVISION}:
        raise SystemExit("committed fixture model identity mismatch")
    if fixtures["promptTemplateSha256"] != prompt_sha256:
        raise SystemExit("committed fixture prompt digest mismatch")
    if args.max_new_tokens != fixtures["generation"]["maxNewTokens"] or args.max_total_seconds != fixtures["generation"]["maxTotalSeconds"]:
        raise SystemExit("benchmark CLI bounds do not match committed fixture")
    verified_files = verify_model_files(model_dir, provenance)

    import torch
    import transformers
    from transformers import AutoModelForCausalLM, AutoTokenizer

    if args.device == "cuda" and not torch.cuda.is_available():
        raise SystemExit("CUDA was requested but is unavailable")
    torch.set_num_threads(args.threads)
    random.seed(0)
    torch.manual_seed(0)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(0)
    torch.use_deterministic_algorithms(True)

    load_started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(
        str(model_dir),
        local_files_only=True,
        trust_remote_code=False,
    )
    model = AutoModelForCausalLM.from_pretrained(
        str(model_dir),
        local_files_only=True,
        trust_remote_code=False,
        dtype=torch.bfloat16,
    )
    device = torch.device(args.device)
    model.to(device)
    model.eval()
    load_seconds = time.perf_counter() - load_started

    locale_by_code = {entry["locale"]: entry for entry in locale_map["locales"]}
    results = []
    generation_started = time.perf_counter()
    for case in fixtures["cases"]:
        locale_entry = locale_by_code[case["locale"]]
        prompt = render_prompt(
            prompt_template,
            locale_entry,
            fixtures["source"],
            fixtures["protectedTokenCounts"],
        )
        messages = [{"role": "user", "content": prompt}]
        encoded = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            enable_thinking=False,
            return_tensors="pt",
            return_dict=True,
        )
        encoded = {key: value.to(device) for key, value in encoded.items()}
        input_tokens = int(encoded["input_ids"].shape[-1])
        started = time.perf_counter()
        with torch.inference_mode():
            generated = model.generate(
                **encoded,
                do_sample=False,
                num_beams=1,
                max_new_tokens=args.max_new_tokens,
                use_cache=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        elapsed_seconds = time.perf_counter() - started
        output_ids = generated[0, input_tokens:]
        output_json = tokenizer.decode(output_ids, skip_special_tokens=True).strip()
        output_tokens = int(output_ids.shape[-1])
        results.append({
            "id": case["id"],
            "locale": case["locale"],
            "class": case["class"],
            "sourceSha256": hashlib.sha256(fixtures["source"].encode("utf-8")).hexdigest(),
            "modelRevision": MODEL_REVISION,
            "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "elapsedSeconds": elapsed_seconds,
            "tokensPerSecond": output_tokens / elapsed_seconds if elapsed_seconds else None,
            "outputJson": output_json,
        })
        print(json.dumps({
            "status": "BENCHMARK_CASE_DONE",
            "id": case["id"],
            "locale": case["locale"],
            "outputTokens": output_tokens,
            "elapsedSeconds": elapsed_seconds,
        }), flush=True)
        if time.perf_counter() - generation_started > args.max_total_seconds:
            print(json.dumps({
                "status": "BENCHMARK_TIME_BUDGET_EXHAUSTED",
                "completedCases": len(results),
                "maximumSeconds": args.max_total_seconds,
            }), flush=True)
            break
    generation_seconds = time.perf_counter() - generation_started

    record = {
        "schema": "iat-b3-qwen35-tiny-benchmark-record/v1",
        "createdAtUtc": datetime.now(timezone.utc).isoformat(),
        "status": "RAW_LOCAL_BENCHMARK_REQUIRES_VALIDATION",
        "activationAllowed": False,
        "bulkGenerationAllowed": False,
        "networkUsedForInference": False,
        "fixtureFileSha256": hashlib.sha256(fixture_bytes).hexdigest(),
        "model": {
            "repository": provenance["model"]["repository"],
            "revision": MODEL_REVISION,
            "directory": str(model_dir),
            "verifiedFiles": verified_files,
        },
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "processor": platform.processor(),
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "device": str(device),
            "cudaAvailable": torch.cuda.is_available(),
            "cudaDevice": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "threads": args.threads,
            "dtype": "bfloat16",
            "deterministicAlgorithms": True,
        },
        "generation": {
            "doSample": False,
            "numBeams": 1,
            "temperature": None,
            "topP": None,
            "topK": None,
            "seed": 0,
            "thinking": False,
            "maxNewTokens": args.max_new_tokens,
            "maxTotalSeconds": args.max_total_seconds,
            "promptTemplateSha256": prompt_sha256,
            "responseContract": "ONE_JSON_OBJECT_ONE_STRING_TRANSLATION_KEY",
        },
        "timing": {
            "modelLoadSeconds": load_seconds,
            "generationSeconds": generation_seconds,
        },
        "fixture": fixtures,
        "results": results,
    }
    temporary = output.with_name(f"{output.name}.tmp-{os.getpid()}")
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    temporary.replace(output)
    print(json.dumps({
        "status": record["status"],
        "output": str(output),
        "cases": len(results),
        "generationSeconds": generation_seconds,
        "activationAllowed": False,
        "bulkGenerationAllowed": False,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
