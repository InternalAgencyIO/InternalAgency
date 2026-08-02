from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

runtime = Path(os.environ.get("I18N_PYTHON_RUNTIME", "outputs/i18n-nllb-runtime")).resolve()
sys.path.insert(0, str(runtime))

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ROOT = Path.cwd()
CATALOG_PATH = ROOT / "app" / "i18n" / "messages.json"
FUTURE_COPY_PATH = ROOT / "app" / "future" / "future-copy.json"
MODEL_ID = "facebook/nllb-200-distilled-600M"

LANGUAGES = {
    "zh": "zho_Hans", "es": "spa_Latn", "hi": "hin_Deva", "fr": "fra_Latn", "ar": "arb_Arab",
    "bn": "ben_Beng", "pt": "por_Latn", "id": "ind_Latn", "ur": "urd_Arab", "ru": "rus_Cyrl",
    "de": "deu_Latn", "ja": "jpn_Jpan", "pcm": "pcm_Latn", "tr": "tur_Latn", "sq": "als_Latn", "ca": "cat_Latn",
    "be": "bel_Cyrl", "nl": "nld_Latn", "bs": "bos_Latn", "bg": "bul_Cyrl", "hr": "hrv_Latn",
    "el": "ell_Grek", "cs": "ces_Latn", "da": "dan_Latn", "et": "est_Latn", "fi": "fin_Latn",
    "hu": "hun_Latn", "is": "isl_Latn", "ga": "gle_Latn", "it": "ita_Latn", "lv": "lvs_Latn",
    "lt": "lit_Latn", "lb": "ltz_Latn", "mk": "mkd_Cyrl", "mt": "mlt_Latn", "no": "nob_Latn",
    "pl": "pol_Latn", "ro": "ron_Latn", "sr": "srp_Cyrl", "sk": "slk_Latn", "sl": "slv_Latn",
    "sv": "swe_Latn", "uk": "ukr_Cyrl", "ht": "hat_Latn", "gn": "grn_Latn", "qu": "quy_Latn",
    "hy": "hye_Armn", "az": "azj_Latn", "ka": "kat_Geor",
}

PROTECTED_TERMS = [
    "Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana", "Model T", "Genesis",
    "APY", "CCC-Agent", "Radiance", "Ellie", "Alia", "UTC", "İSTANBUL",
]
APPROVED_EQUIVALENTS = {
    "tr": {"Internal Agency": "İleri Akıl", "Genesis": "Başlangıç"},
}
TURKISH_WORDS = {
    "açık", "başlangıç", "beklet", "bir", "bu", "cüzdan", "değil", "doğrulama", "göre", "henüz",
    "her", "için", "ile", "işlem", "kanıt", "kamu", "kadar", "olarak", "önce", "sonra", "ve", "veya",
    "yalnızca", "yayın", "yok",
}
TRANSLATION_ALGORITHM_VERSION = 2
PROTECTED_PATTERN = re.compile(
    "(" + "|".join([
        *(re.escape(term) for term in sorted(PROTECTED_TERMS, key=len, reverse=True)),
        r"https?://[^\s]+",
        r"@[A-Za-z0-9_]+",
        r"\$[A-Z][A-Z0-9_-]*",
        r"\bT\+\d+(?:[.,:]\d+)*\b",
        r"(?<![\w])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\w])",
    ]) + ")",
    flags=re.IGNORECASE,
)


def exact_tokens(value: str) -> list[str]:
    return [match.group(0) for match in PROTECTED_PATTERN.finditer(value)]


def preserves_exact_tokens(source: str, translated: str, locale: str = "") -> bool:
    equivalents = APPROVED_EQUIVALENTS.get(locale, {})
    return all(
        token in translated or bool(equivalents.get(token) and equivalents[token] in translated)
        for token in exact_tokens(source)
    )


def source_language(value: str) -> str:
    if re.search(r"[çğıöşüÇĞİÖŞÜı]", value):
        return "tur_Latn"
    words = {word.lower() for word in re.findall(r"[^\W\d_]+", value, flags=re.UNICODE)}
    return "tur_Latn" if len(words & TURKISH_WORDS) >= 2 else "eng_Latn"


def segment_source(source: str) -> list[tuple[str, str, str, str]]:
    """Split protected protocol data from prose so the model cannot drop it."""
    segments: list[tuple[str, str, str, str]] = []
    cursor = 0
    for match in PROTECTED_PATTERN.finditer(source):
        if match.start() > cursor:
            segments.extend(prose_segment(source[cursor:match.start()]))
        segments.append(("literal", match.group(0), "", ""))
        cursor = match.end()
    if cursor < len(source):
        segments.extend(prose_segment(source[cursor:]))
    return segments or [("literal", source, "", "")]


def prose_segment(value: str) -> list[tuple[str, str, str, str]]:
    if not re.search(r"[^\W\d_]", value, flags=re.UNICODE):
        return [("literal", value, "", "")]
    leading = re.match(r"^\s*", value).group(0)
    trailing = re.search(r"\s*$", value).group(0)
    end = len(value) - len(trailing) if trailing else len(value)
    core = value[len(leading):end]
    return [("prose", core, leading, trailing)]


def translate_segmented_sources(model, tokenizer, device, target_language: str, sources: list[str], model_batch_size: int) -> dict[str, str]:
    structures = [segment_source(source) for source in sources]
    prose = [segment[1] for structure in structures for segment in structure if segment[0] == "prose"]
    translated_prose: list[str] = []
    for start in range(0, len(prose), model_batch_size):
        inputs = tokenizer(
            prose[start:start + model_batch_size],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=384,
        ).to(device)
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_language),
                max_length=384,
                num_beams=1,
                no_repeat_ngram_size=3,
                repetition_penalty=1.15,
            )
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
        translated_prose.extend(value.strip() for value in decoded)

    translated_iter = iter(translated_prose)
    output: dict[str, str] = {}
    for source, structure in zip(sources, structures, strict=True):
        pieces: list[str] = []
        for kind, value, leading, trailing in structure:
            if kind == "literal":
                pieces.append(value)
            else:
                translated = next(translated_iter, "") or value
                pieces.append(f"{leading}{translated}{trailing}")
        output[source] = "".join(pieces).strip()
    return output


def translate_sources_for_language(model, tokenizer, device, target_language: str, sources: list[str], model_batch_size: int) -> dict[str, str]:
    protected = [source for source in sources if PROTECTED_PATTERN.search(source)]
    plain = [source for source in sources if not PROTECTED_PATTERN.search(source)]
    output: dict[str, str] = {}
    for start in range(0, len(plain), model_batch_size):
        plain_batch = plain[start:start + model_batch_size]
        inputs = tokenizer(
            plain_batch,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=384,
        ).to(device)
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_language),
                max_length=384,
                num_beams=1,
                no_repeat_ngram_size=3,
                repetition_penalty=1.15,
            )
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
        output.update({source: translated.strip() or source for source, translated in zip(plain_batch, decoded, strict=True)})
    if protected:
        output.update(translate_segmented_sources(model, tokenizer, device, target_language, protected, model_batch_size))
    return output


def translate_sources(model, tokenizer, device, target_language: str, sources: list[str], model_batch_size: int) -> dict[str, str]:
    output: dict[str, str] = {}
    for detected_language in ("eng_Latn", "tur_Latn"):
        language_sources = [source for source in sources if source_language(source) == detected_language]
        if not language_sources:
            continue
        tokenizer.src_lang = detected_language
        output.update(translate_sources_for_language(model, tokenizer, device, target_language, language_sources, model_batch_size))
    return output


def collect_pairs(source, translated, output: dict[str, str]) -> None:
    if isinstance(source, str) and isinstance(translated, str):
        output[source] = translated
        return
    if isinstance(source, dict) and isinstance(translated, dict):
        for key in source.keys() & translated.keys():
            collect_pairs(source[key], translated[key], output)
        return
    if isinstance(source, list) and isinstance(translated, list):
        for left, right in zip(source, translated, strict=False):
            collect_pairs(left, right, output)


def persist(catalog: dict) -> None:
    temporary = CATALOG_PATH.with_suffix(".json.tmp")
    payload = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    temporary.write_text(payload, encoding="utf-8")
    for attempt in range(5):
        try:
            temporary.replace(CATALOG_PATH)
            return
        except PermissionError:
            if attempt == 4:
                raise
            time.sleep(0.5 * (attempt + 1))


def main() -> None:
    checkpoint = CATALOG_PATH.with_suffix(".json.tmp")
    catalog_path = checkpoint if checkpoint.exists() and checkpoint.stat().st_mtime > CATALOG_PATH.stat().st_mtime else CATALOG_PATH
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    sources = list(catalog["messages"]["en"].keys())
    if len(sources) < 250:
        raise RuntimeError(f"Expected a whole-site English catalog; found {len(sources)} strings")

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, src_lang="eng_Latn")
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, torch_dtype=dtype)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device).eval()
    print(f"Loaded {MODEL_ID} on {device} for {len(sources)} canonical strings.", flush=True)

    future_overrides: dict[str, str] = {}
    future_copy = json.loads(FUTURE_COPY_PATH.read_text(encoding="utf-8"))
    collect_pairs(future_copy["en"], future_copy["tr"], future_overrides)
    future_overrides = {
        source: translated for source, translated in future_overrides.items()
        if preserves_exact_tokens(source, translated, "tr")
    }

    prompt_overrides: dict[str, dict[str, str]] = {}
    english_prompt = catalog["prompts"]["en"]
    for locale, prompt in catalog["prompts"].items():
        prompt_overrides[locale] = {
            english_prompt[key]: prompt[key] for key in english_prompt.keys() & prompt.keys()
            if preserves_exact_tokens(english_prompt[key], prompt[key], locale)
        }

    if catalog.get("meta", {}).get("translationAlgorithmVersion") != TRANSLATION_ALGORITHM_VERSION:
        catalog["messages"] = {"en": catalog["messages"]["en"]}
        catalog["meta"]["translationAlgorithmVersion"] = TRANSLATION_ALGORITHM_VERSION
        persist(catalog)

    batch_size = int(os.environ.get("I18N_BATCH_SIZE", "112" if device.type == "cuda" else "8"))
    for locale, target_language in LANGUAGES.items():
        existing = catalog.get("messages", {}).get(locale, {})
        missing_sources = [
            source for source in sources
            if not isinstance(existing.get(source), str) or not existing[source].strip()
        ]
        if not missing_sources:
            print(f"Reusing complete {locale} catalog.", flush=True)
            continue

        dictionary: dict[str, str] = dict(existing)
        print(f"Translating {len(missing_sources)} missing strings to {locale} ({target_language})...", flush=True)
        dictionary.update(translate_sources(model, tokenizer, device, target_language, missing_sources, batch_size))

        dictionary.update(prompt_overrides.get(locale, {}))
        if locale == "tr":
            dictionary.update(future_overrides)
        catalog["messages"][locale] = {source: dictionary[source] for source in sources}
        persist(catalog)
        print(f"Completed {locale}.", flush=True)

    catalog["messages"] = {
        locale: catalog["messages"][locale]
        for locale in ["en", *LANGUAGES.keys()]
    }
    catalog["meta"]["translationEngine"] = MODEL_ID
    catalog["meta"]["translationMode"] = "local GPU generation; static committed output; no runtime translation service"
    persist(catalog)
    print(f"Completed {len(LANGUAGES) + 1} locale catalogs.", flush=True)


if __name__ == "__main__":
    main()
