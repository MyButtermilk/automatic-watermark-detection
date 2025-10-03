"""Command line utility for transcribing audio with the Qwen 3 ASR API.

This module exposes a small helper that turns local audio files into
base64-encoded payloads that can be sent to the Qwen Automatic Speech
Recognition (ASR) endpoint.  The script can be used as a standalone CLI
by executing ``python -m src.qwen_asr_transcription`` and passing the
required arguments.

Example
-------
::

    python -m src.qwen_asr_transcription \
        --api-key "$DASHSCOPE_API_KEY" \
        --audio-path path/to/sample.wav \
        --model qwen-3.0-asr \
        --language de-DE

The module keeps the core HTTP logic in the :func:`transcribe` function so
it can be imported from other scripts as well.
"""

from __future__ import annotations

import argparse
import base64
import importlib
import json
import mimetypes
import os
import re
import tempfile
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, Iterable, List, Optional


DEFAULT_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/audio_transcription"
DEFAULT_ENV_VAR = "DASHSCOPE_API_KEY"

DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com"
DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"
GEMINI_ENV_VAR = "GEMINI_API_KEY"

_MIMETYPE_TO_FORMAT = {
    "mpeg": "mp3",
    "x-wav": "wav",
    "wave": "wav",
    "x-m4a": "m4a",
    "aac": "aac",
    "mp4": "m4a",
    "ogg": "ogg",
    "x-flac": "flac",
}

_EXTENSION_TO_FORMAT = {
    ".mp3": "mp3",
    ".wav": "wav",
    ".m4a": "m4a",
    ".aac": "aac",
    ".flac": "flac",
    ".ogg": "ogg",
    ".opus": "ogg",
}


class TranscriptionError(RuntimeError):
    """Raised when the Qwen ASR service returns an error."""


class GeminiError(RuntimeError):
    """Raised when the Gemini API fails to enrich a transcript."""


def _guess_audio_format(audio_path: Path) -> str:
    """Infer the audio format from the given file.

    Parameters
    ----------
    audio_path:
        Path to the local audio file.

    Returns
    -------
    str
        The format string expected by the API.  If the file type could
        not be determined, ``"wav"`` is used as a conservative default.
    """

    suffix = audio_path.suffix.lower()
    if suffix in _EXTENSION_TO_FORMAT:
        return _EXTENSION_TO_FORMAT[suffix]

    mime, _ = mimetypes.guess_type(audio_path)
    if mime and "/" in mime:
        subtype = mime.split("/")[-1]
        normalized = _MIMETYPE_TO_FORMAT.get(subtype, subtype)
        if normalized:
            return normalized

    return "wav"


def _load_audio_content(audio_path: Path) -> str:
    """Read an audio file and return a base64 encoded string."""

    with audio_path.open("rb") as audio_file:
        raw_bytes = audio_file.read()
    if not raw_bytes:
        raise ValueError(f"Audio file '{audio_path}' is empty.")
    return base64.b64encode(raw_bytes).decode("utf-8")


def build_payload(
    audio_path: Path,
    *,
    model: str,
    language: Optional[str] = None,
    prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Create the JSON payload expected by the Qwen 3 ASR API."""

    if not model:
        raise ValueError("A Qwen ASR model name must be provided.")

    audio_format = _guess_audio_format(audio_path)
    content = _load_audio_content(audio_path)

    payload: Dict[str, Any] = {
        "model": model,
        "input": [
            {
                "audio": {
                    "format": audio_format,
                    "content": content,
                }
            }
        ],
        "parameters": {},
    }

    if language:
        payload["parameters"]["language"] = language
    if prompt:
        payload["parameters"]["prompt"] = prompt

    return payload


def _load_requests() -> ModuleType:
    """Import and return the ``requests`` module on demand."""

    return importlib.import_module("requests")


def transcribe(
    api_key: str,
    audio_path: Path,
    *,
    model: str,
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    endpoint: str = DEFAULT_ENDPOINT,
    timeout: int = 60,
) -> Dict[str, Any]:
    """Send the transcription request to the Qwen 3 ASR API.

    Parameters
    ----------
    api_key:
        DashScope API key used to authenticate the request.
    audio_path:
        Path to the audio file that should be transcribed.
    model:
        Name of the Qwen ASR model (for example ``"qwen-3.0-asr"``).
    language:
        Optional BCP-47 language tag that hints the spoken language in
        the audio file.
    prompt:
        Optional text prompt that helps the recogniser.
    endpoint:
        URL of the ASR service.
    timeout:
        Timeout in seconds for the HTTP request.

    Returns
    -------
    dict
        JSON response parsed into a Python dictionary.

    Raises
    ------
    TranscriptionError
        If the API returned an unsuccessful status code or reported an
        error condition.
    """

    payload = build_payload(audio_path, model=model, language=language, prompt=prompt)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    requests_mod = _load_requests()

    try:
        response = requests_mod.post(
            endpoint,
            headers=headers,
            data=json.dumps(payload),
            timeout=timeout,
        )
    except requests_mod.RequestException as exc:  # pragma: no cover - network failure
        raise TranscriptionError(f"Failed to contact Qwen ASR service: {exc}") from exc

    if response.status_code != 200:
        raise TranscriptionError(
            f"Request failed with status {response.status_code}: {response.text}"
        )

    data = response.json()
    if data.get("status", "succeeded") not in {"succeeded", "success", "ok"}:
        raise TranscriptionError(f"Transcription failed: {data}")

    return data


def transcribe_audio_bytes(
    api_key: str,
    audio_content: bytes,
    *,
    model: str,
    audio_format: str = "wav",
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    endpoint: str = DEFAULT_ENDPOINT,
    timeout: int = 60,
) -> Dict[str, Any]:
    """Transcribe audio content already loaded into memory."""

    if not audio_content:
        raise ValueError("Audio content is empty.")

    normalized_format = audio_format.strip().lstrip(".") or "wav"
    suffix = f".{normalized_format}"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_content)
        tmp_path = Path(tmp.name)

    try:
        return transcribe(
            api_key,
            tmp_path,
            model=model,
            language=language,
            prompt=prompt,
            endpoint=endpoint,
            timeout=timeout,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)


def _extract_gemini_text(candidate: Dict[str, Any]) -> str:
    """Collect all text parts from a Gemini candidate into a single string."""

    content = candidate.get("content") or {}
    parts = content.get("parts") or []
    texts: List[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            texts.append(part["text"])
    return "\n".join(texts).strip()


def _parse_structured_json(text: str) -> Optional[Dict[str, Any]]:
    """Attempt to parse a JSON object from Gemini output."""

    if not text:
        return None

    block_match = _JSON_BLOCK_RE.search(text)
    if block_match:
        snippet = block_match.group(1)
        try:
            return json.loads(snippet)
        except json.JSONDecodeError:
            pass

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def enrich_transcript_with_gemini(
    api_key: str,
    transcript: str,
    *,
    model: str = DEFAULT_GEMINI_MODEL,
    endpoint: str = DEFAULT_GEMINI_ENDPOINT,
    timeout: int = 60,
    temperature: float = 0.2,
    context: Optional[str] = None,
) -> Dict[str, Any]:
    """Use Gemini 2.5 Pro to polish transcripts and produce summaries."""

    if not api_key:
        raise ValueError("A Gemini API key must be supplied.")
    if not transcript or not transcript.strip():
        raise ValueError("A non-empty transcript is required for enrichment.")

    normalized_endpoint = endpoint.rstrip("/")
    url = f"{normalized_endpoint}/v1beta/models/{model}:generateContent"
    params = {"key": api_key}

    prompt_lines = [
        "You are a world-class transcription editor.",
        "Polish the provided transcript into readable paragraphs and produce structured insights.",
        "Respond strictly with JSON matching this schema:",
        "{",
        '  "formatted_transcript": string,',
        '  "structured_summary": {',
        '    "overview": string,',
        '    "key_points": [string, ...],',
        '    "action_items": [string, ...],',
        '    "notable_quotes": [string, ...]',
        "  },",
        '  "metadata": {',
        '    "detected_language": string,',
        '    "topics": [string, ...]',
        "  }",
        "}",
        "Always include every field (use empty strings or arrays when needed).",
        "Use Markdown when formatting the transcript, without HTML.",
    ]
    if context:
        prompt_lines.append(f"Context: {context}")
    prompt_lines.append("Transcript:")
    prompt_lines.append(transcript.strip())
    prompt = "\n".join(prompt_lines)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": max(0.0, min(1.0, float(temperature))),
            "topP": 0.9,
            "topK": 40,
        },
    }

    requests_mod = _load_requests()

    try:
        response = requests_mod.post(url, params=params, json=payload, timeout=timeout)
    except requests_mod.RequestException as exc:  # pragma: no cover - depends on runtime network
        raise GeminiError(f"Failed to contact Gemini API: {exc}") from exc

    if response.status_code != 200:
        raise GeminiError(
            f"Gemini API returned {response.status_code}: {response.text[:2000]}"
        )

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise GeminiError("Gemini API response did not include any candidates.")

    text = _extract_gemini_text(candidates[0])
    structured = _parse_structured_json(text)

    return {
        "model": model,
        "raw_text": text,
        "structured": structured or {},
        "response": data,
    }


def extract_transcript_text(response: Dict[str, Any]) -> str:
    """Extract the transcript text from a Qwen ASR response."""

    outputs = response.get("output")
    if isinstance(outputs, dict):
        text = outputs.get("text") or outputs.get("transcription")
        if isinstance(text, str):
            return text
    return json.dumps(response, ensure_ascii=False, indent=2)


def extract_segments(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return a normalised list of transcript segments."""

    outputs = response.get("output", {})
    segments: List[Dict[str, Any]] = []

    if isinstance(outputs, dict):
        candidates: Iterable[Any] = outputs.get("segments") or outputs.get("result") or []
        if isinstance(candidates, dict):
            candidates = candidates.values()
        for segment in candidates:
            if not isinstance(segment, dict):
                continue
            segments.append(
                {
                    "text": segment.get("text") or segment.get("result"),
                    "start": segment.get("start_time") or segment.get("start"),
                    "end": segment.get("end_time") or segment.get("end"),
                    "confidence": segment.get("confidence"),
                }
            )

    return segments


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Transcribe audio with Qwen 3 ASR")
    parser.add_argument(
        "--api-key",
        dest="api_key",
        default=os.getenv(DEFAULT_ENV_VAR),
        help=(
            "DashScope API key. If omitted, the value is read from the "
            f"{DEFAULT_ENV_VAR} environment variable."
        ),
    )
    parser.add_argument(
        "--audio-path",
        required=True,
        type=Path,
        help="Path to the audio file that should be transcribed.",
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Name of the Qwen ASR model to use (e.g. 'qwen-3.0-asr').",
    )
    parser.add_argument(
        "--language",
        help="Optional language hint in BCP-47 format (for example 'de-DE').",
    )
    parser.add_argument(
        "--prompt",
        help="Optional custom prompt that guides the transcription.",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help="Override the default Qwen ASR endpoint URL.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="HTTP timeout in seconds (default: 60).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path to write the JSON response to disk.",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> None:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.api_key:
        parser.error(
            "No API key supplied. Provide --api-key or set the "
            f"{DEFAULT_ENV_VAR} environment variable."
        )

    if not args.audio_path.exists():
        parser.error(f"Audio file '{args.audio_path}' does not exist.")

    response = transcribe(
        args.api_key,
        args.audio_path,
        model=args.model,
        language=args.language,
        prompt=args.prompt,
        endpoint=args.endpoint,
        timeout=args.timeout,
    )

    if args.output:
        args.output.write_text(json.dumps(response, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(response, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
