"""Streamlit interface for Qwen 3 ASR speech transcription."""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import plotly.graph_objects as go
import requests
import streamlit as st
from streamlit.errors import StreamlitAPIException

try:
    from audio_recorder_streamlit import audio_recorder
except ImportError:  # pragma: no cover - optional dependency at runtime
    audio_recorder = None

try:
    import librosa
except ImportError as exc:  # pragma: no cover - handled at runtime
    raise ImportError(
        "The Streamlit UI requires the 'librosa' package. Install optional UI dependencies."
    ) from exc

try:
    import yt_dlp
except ImportError:  # pragma: no cover - optional dependency at runtime
    yt_dlp = None



SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from qwen_asr_transcription import (
    DEFAULT_ENDPOINT,
    DEFAULT_ENV_VAR,
    DEFAULT_GEMINI_ENDPOINT,
    DEFAULT_GEMINI_MODEL,
    GEMINI_ENV_VAR,
    GeminiError,
    TranscriptionError,
    enrich_transcript_with_gemini,
    extract_segments,
    extract_transcript_text,
    transcribe_audio_bytes,
)

YOUTUBE_ENV_VAR = "YOUTUBE_API_KEY"
YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEO_URL = "https://www.youtube.com/watch?v={video_id}"
MAX_YOUTUBE_SELECTION = 10

TEST_MODE = os.getenv("ASR_STUDIO_TEST_MODE", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _generate_demo_audio(duration: float = 2.0, sample_rate: int = 16_000) -> tuple[bytes, str]:
    """Return a deterministic sine wave clip for offline demos and tests."""

    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    waveform = 0.25 * np.sin(2 * np.pi * 440 * t) + 0.25 * np.sin(2 * np.pi * 660 * t)
    clipped = np.clip(waveform, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())
    return buffer.getvalue(), ".wav"


_DEMO_TRANSCRIPT_TEXT = (
    "This is a demo transcript generated while running Qwen 3 ASR Studio in test mode."
)
_DEMO_SEGMENTS = [
    {
        "text": "Welcome to the automated testing scenario.",
        "start": 0.0,
        "end": 1.6,
        "confidence": 0.98,
    },
    {
        "text": "We explore waveform, spectrogram, and Gemini insights.",
        "start": 1.6,
        "end": 3.8,
        "confidence": 0.96,
    },
    {
        "text": "Deterministic outputs keep the dashboard offline friendly.",
        "start": 3.8,
        "end": 6.0,
        "confidence": 0.97,
    },
]


def _build_demo_transcription(source: str, audio_format: str) -> Dict[str, Any]:
    """Create a fake transcription payload used when the UI runs offline."""

    decorated_segments = [
        {
            **segment,
            "text": f"{segment['text']} (source: {source})",
        }
        for segment in _DEMO_SEGMENTS
    ]
    return {
        "status": "succeeded",
        "output": {
            "text": f"{_DEMO_TRANSCRIPT_TEXT} Source: {source}.",
            "segments": decorated_segments,
            "metadata": {
                "detected_language": "en-US",
                "topics": ["demo", "testing", source],
                "audio_format": audio_format,
            },
        },
    }


def _demo_gemini_enrichment(transcript: str, context: str | None) -> Dict[str, Any]:
    """Return a deterministic Gemini enrichment payload for offline testing."""

    return {
        "model": DEFAULT_GEMINI_MODEL,
        "raw_text": "\n".join(
            [
                "### Gemini test mode",
                "This offline enrichment mirrors the live workflow without network calls.",
                transcript,
            ]
        ),
        "structured": {
            "formatted_transcript": f"**Gemini formatted transcript**\n\n{transcript}",
            "structured_summary": {
                "overview": "Offline summary for deterministic automated tests.",
                "key_points": [
                    "Demonstrates waveform and spectrogram rendering",
                    "Exercises Gemini enrichment panels",
                    "Runs without external API traffic",
                ],
                "action_items": ["Celebrate the passing UI tests"],
                "notable_quotes": ["\"Testing mode activated.\""],
            },
            "metadata": {
                "detected_language": "en-US",
                "topics": ["demo", "testing", context or "ui"],
            },
        },
        "response": {"test_mode": True, "context": context},
    }


if TEST_MODE:
    _DEMO_YOUTUBE_RESULTS = [
        {
            "video_id": "demo-video-1",
            "title": "Demo watermarks explained",
            "channel": "Test Insights",
            "published_at": "2024-01-15T12:00:00Z",
            "description": "An offline-friendly clip generated for automated tests.",
            "thumbnail": None,
        },
        {
            "video_id": "demo-video-2",
            "title": "Qwen ASR Studio walkthrough",
            "channel": "AI Tutorials",
            "published_at": "2024-02-10T09:30:00Z",
            "description": "A showcase of transcription and Gemini enrichment capabilities.",
            "thumbnail": None,
        },
        {
            "video_id": "demo-video-3",
            "title": "Offline automation demo",
            "channel": "Quality Assurance",
            "published_at": "2024-03-20T17:45:00Z",
            "description": "Highlights Playwright-driven regression testing.",
            "thumbnail": None,
        },
    ]


    def _transcribe_audio(
        api_key: str,
        audio_content: bytes,
        *,
        model: str,
        audio_format: str = "wav",
        language: str | None = None,
        prompt: str | None = None,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout: int = 60,
    ) -> Dict[str, Any]:
        if not api_key:
            raise TranscriptionError("A DashScope API key must be supplied.")
        label = prompt or language or model or "demo"
        return _build_demo_transcription(label, audio_format)


    def _enrich_transcript(
        api_key: str,
        transcript: str,
        *,
        model: str = DEFAULT_GEMINI_MODEL,
        endpoint: str = DEFAULT_GEMINI_ENDPOINT,
        timeout: int = 60,
        temperature: float = 0.2,
        context: str | None = None,
    ) -> Dict[str, Any]:
        if not api_key:
            raise ValueError("A Gemini API key must be supplied.")
        if not transcript.strip():
            raise ValueError("Transcript is empty.")
        return _demo_gemini_enrichment(transcript, context)

else:
    _transcribe_audio = transcribe_audio_bytes
    _enrich_transcript = enrich_transcript_with_gemini


def _load_default_api_key() -> str:
    env_key = os.getenv(DEFAULT_ENV_VAR, "")
    if env_key:
        return env_key
    try:
        return st.secrets.get("dashscope_api_key", "")
    except StreamlitAPIException:
        return ""


def _load_default_youtube_api_key() -> str:
    env_key = os.getenv(YOUTUBE_ENV_VAR, "")
    if env_key:
        return env_key
    try:
        return st.secrets.get("youtube_api_key", "")
    except StreamlitAPIException:
        return ""


def _load_default_gemini_api_key() -> str:
    env_key = os.getenv(GEMINI_ENV_VAR, "")
    if env_key:
        return env_key
    try:
        return st.secrets.get("gemini_api_key", "")
    except StreamlitAPIException:
        return ""


@st.cache_data(show_spinner=False, ttl=300)
def _search_youtube_videos(
    api_key: str,
    query: str,
    *,
    max_results: int = 12,
    region_code: str | None = None,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "part": "snippet",
        "type": "video",
        "q": query,
        "maxResults": max(1, min(max_results, 50)),
        "key": api_key,
    }
    if region_code:
        params["regionCode"] = region_code

    if TEST_MODE:
        limit = max(1, min(max_results, len(_DEMO_YOUTUBE_RESULTS)))
        return _DEMO_YOUTUBE_RESULTS[:limit]

    response = requests.get(YOUTUBE_SEARCH_ENDPOINT, params=params, timeout=15)
    if response.status_code != 200:
        raise RuntimeError(
            f"YouTube search failed with status {response.status_code}: {response.text}"
        )

    data = response.json()
    items = data.get("items", [])
    results: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        snippet = item.get("snippet") or {}
        video_id = item.get("id", {}).get("videoId")
        if not video_id:
            continue
        results.append(
            {
                "video_id": video_id,
                "title": snippet.get("title", "(untitled)"),
                "channel": snippet.get("channelTitle", ""),
                "published_at": snippet.get("publishedAt"),
                "description": snippet.get("description", ""),
                "thumbnail": (snippet.get("thumbnails", {}) or {}).get("medium", {}).get("url"),
            }
        )
    return results


def _format_video_label(video: Dict[str, Any]) -> str:
    channel = video.get("channel")
    if channel:
        return f"{video.get('title', 'Video')} — {channel}"
    return video.get("title", "Video")


def _download_youtube_audio(video_id: str) -> tuple[bytes, str]:
    if TEST_MODE:
        audio_bytes, suffix = _generate_demo_audio()
        return audio_bytes, suffix

    if yt_dlp is None:  # pragma: no cover - optional dependency at runtime
        raise RuntimeError(
            "Install the optional 'yt-dlp' package to enable YouTube audio downloads."
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "%(id)s.%(ext)s")
        downloader = yt_dlp.YoutubeDL(
            {
                "format": "bestaudio/best",
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "outtmpl": output_template,
            }
        )
        info = downloader.extract_info(YOUTUBE_VIDEO_URL.format(video_id=video_id), download=True)
        audio_path = Path(downloader.prepare_filename(info))
        if not audio_path.exists():
            raise RuntimeError("Failed to download audio track for the selected video.")
        audio_bytes = audio_path.read_bytes()
        suffix = audio_path.suffix or ".m4a"
        audio_path.unlink(missing_ok=True)
    return audio_bytes, suffix


def _render_waveform(samples: np.ndarray, sample_rate: int) -> None:
    times = np.arange(len(samples)) / sample_rate
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=times,
            y=samples,
            mode="lines",
            line=dict(color="#2563eb", width=1.5),
            name="Waveform",
        )
    )
    fig.update_layout(
        title="Waveform",
        xaxis_title="Time (s)",
        yaxis_title="Amplitude",
        template="plotly_white",
        margin=dict(l=40, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


def _render_spectrogram(samples: np.ndarray, sample_rate: int) -> None:
    stft = np.abs(librosa.stft(samples, n_fft=2048, hop_length=512))
    db_spectrogram = librosa.amplitude_to_db(stft + 1e-10, ref=np.max)
    time_axis = librosa.frames_to_time(
        np.arange(db_spectrogram.shape[1]), sr=sample_rate, hop_length=512
    )
    freq_axis = librosa.fft_frequencies(sr=sample_rate, n_fft=2048)

    heatmap = go.Heatmap(
        z=db_spectrogram,
        x=time_axis,
        y=freq_axis,
        colorscale="Viridis",
        zmin=db_spectrogram.min(),
        zmax=db_spectrogram.max(),
        colorbar=dict(title="dB"),
    )
    fig = go.Figure(data=[heatmap])
    fig.update_layout(
        title="Spectrogram",
        xaxis_title="Time (s)",
        yaxis_title="Frequency (Hz)",
        template="plotly_white",
        margin=dict(l=40, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


def _render_timeline(segments: List[Dict[str, Any]]) -> None:
    durations: List[float] = []
    labels: List[str] = []
    bases: List[float] = []

    for idx, segment in enumerate(segments, start=1):
        start = segment.get("start")
        end = segment.get("end")
        if start is None or end is None:
            continue
        labels.append(f"Segment {idx}")
        bases.append(float(start))
        durations.append(max(float(end) - float(start), 1e-6))

    if not durations:
        return

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=durations,
            y=labels,
            base=bases,
            orientation="h",
            marker=dict(color="#38bdf8"),
            hovertemplate="<b>%{y}</b><br>Start: %{base:.2f}s<br>Duration: %{x:.2f}s<extra></extra>",
        )
    )
    fig.update_layout(
        title="Segment timeline",
        xaxis_title="Time (s)",
        yaxis_title="",
        template="plotly_white",
        margin=dict(l=60, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


def _highlight_transcript(segments: List[Dict[str, Any]]) -> None:
    if not segments:
        return

    for idx, segment in enumerate(segments, start=1):
        text = segment.get("text") or ""
        start = segment.get("start")
        end = segment.get("end")
        confidence = segment.get("confidence")
        caption = f"Segment {idx}"
        if start is not None and end is not None:
            caption += f" ({start:.2f}s – {end:.2f}s)"
        if confidence is not None:
            caption += f" — confidence: {confidence:.2%}"
        st.markdown(f"**{caption}**")
        st.info(text)


def _download_button(transcript_text: str, filename: str) -> None:
    if not transcript_text:
        return
    st.download_button(
        label="Download transcript",
        data=transcript_text.encode("utf-8"),
        file_name=filename,
        mime="text/plain",
    )


def _render_json(response: Dict[str, Any]) -> None:
    st.json(response)


def _render_gemini_insights(enrichment: Dict[str, Any]) -> None:
    if not enrichment:
        return

    st.subheader("Gemini intelligence")
    structured = enrichment.get("structured") or {}

    formatted = structured.get("formatted_transcript") if isinstance(structured, dict) else None
    if isinstance(formatted, str) and formatted.strip():
        st.markdown("#### Polished transcript")
        st.markdown(formatted)

    summary = structured.get("structured_summary") if isinstance(structured, dict) else None
    if isinstance(summary, dict):
        overview = summary.get("overview")
        if isinstance(overview, str) and overview.strip():
            st.markdown("#### Overview")
            st.info(overview)

        def _render_list(title: str, items: Any) -> None:
            if isinstance(items, list) and items:
                st.markdown(f"#### {title}")
                st.markdown("\n".join(f"- {item}" for item in items if isinstance(item, str) and item.strip()))

        _render_list("Key points", summary.get("key_points"))
        _render_list("Action items", summary.get("action_items"))
        _render_list("Notable quotes", summary.get("notable_quotes"))

    metadata = structured.get("metadata") if isinstance(structured, dict) else None
    if isinstance(metadata, dict):
        cols = st.columns(2)
        detected_lang = metadata.get("detected_language")
        if isinstance(detected_lang, str) and detected_lang.strip():
            cols[0].metric("Detected language", detected_lang)
        topics = metadata.get("topics")
        if isinstance(topics, list) and topics:
            cols[1].metric("Topics", ", ".join(str(topic) for topic in topics[:5]))

    if not structured:
        raw_text = enrichment.get("raw_text")
        if isinstance(raw_text, str) and raw_text.strip():
            st.markdown(raw_text)

    raw_response = enrichment.get("response")
    if isinstance(raw_response, dict):
        with st.expander("Gemini raw response", expanded=False):
            _render_json(raw_response)


@st.cache_data(show_spinner=False)
def _analyse_audio(content: bytes, suffix: str) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        temp_path = Path(tmp.name)

    try:
        samples, sample_rate = librosa.load(str(temp_path), sr=None, mono=True)
    finally:
        temp_path.unlink(missing_ok=True)

    duration = len(samples) / sample_rate if sample_rate else 0
    rms = float(np.sqrt(np.mean(np.square(samples)))) if samples.size else 0
    peak = float(np.max(np.abs(samples))) if samples.size else 0

    return {
        "samples": samples,
        "sample_rate": int(sample_rate),
        "duration": float(duration),
        "rms": rms,
        "peak": peak,
    }


def _render_mic_recorder() -> bytes | None:
    """Render a stylised microphone recorder and return captured bytes."""

    st.markdown(
        """
        <style>
        .mic-wrapper {
            border-radius: 18px;
            padding: 1.5rem;
            background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(236,72,153,0.12));
            border: 1px solid rgba(59,130,246,0.25);
            box-shadow: 0 20px 45px rgba(59, 130, 246, 0.15);
        }
        .mic-wrapper h3 {
            margin: 0 0 0.75rem 0;
            font-weight: 700;
            color: #1f2937;
        }
        .mic-wrapper p {
            margin-bottom: 1rem;
            color: #374151;
        }
        .mic-tips {
            font-size: 0.85rem;
            color: #4b5563;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    st.markdown(
        """
        <div class="mic-wrapper">
            <h3>🎤 Capture audio from your microphone</h3>
            <p>Tap the glowing microphone to start recording and speak clearly. Tap again to stop. Your recording stays on this device until you submit it for transcription.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if audio_recorder is None:
        st.warning(
            "Install the optional 'audio-recorder-streamlit' package to enable in-browser recording."
        )
        return None

    recorded_audio = audio_recorder(
        text="Tap to record", icon_name="microphone-lines", icon_size="4x", neutral_color="#e5e7eb"
    )

    if recorded_audio:
        st.success("Microphone capture ready! Preview below before transcribing.")

    st.caption(
        "Pro tip: Wear headphones to avoid echo in the recording for the cleanest transcript."
    )
    st.caption(
        "Reduce background noise and keep the microphone close to your mouth for the highest accuracy."
    )

    return recorded_audio


def main() -> None:
    st.set_page_config(
        page_title="Qwen 3 ASR Studio",
        page_icon="🎙️",
        layout="wide",
        menu_items={
            "Get Help": "https://help.aliyun.com/document_detail/2630413.html",
            "Report a bug": "https://github.com/AlibabaResearch",
        },
    )

    st.title("🎙️ Qwen 3 ASR Studio")
    st.caption(
        "An immersive dashboard for exploring Qwen's automatic speech transcription with live analytics."
    )

    if TEST_MODE:
        st.info(
            "The studio is running in offline test mode. All transcriptions, Gemini insights, and YouTube results are generated deterministically without contacting external services."
        )

    sidebar = st.sidebar
    sidebar.header("Configuration")
    default_key = _load_default_api_key()
    api_key = sidebar.text_input(
        "DashScope API key",
        value=default_key or st.session_state.get("api_key", ""),
        type="password",
        help=f"You can also set the {DEFAULT_ENV_VAR} environment variable before starting the app.",
    )
    if api_key:
        st.session_state["api_key"] = api_key

    model = sidebar.text_input("Model", value="qwen-3.0-asr")
    language = sidebar.text_input("Language (BCP-47)", value="")
    prompt = sidebar.text_area("Prompt", value="")
    endpoint = sidebar.text_input("Endpoint", value=DEFAULT_ENDPOINT)
    timeout = sidebar.slider("Timeout (s)", min_value=10, max_value=120, value=60, step=5)

    youtube_default = _load_default_youtube_api_key()
    youtube_api_key = sidebar.text_input(
        "YouTube API key",
        value=youtube_default or st.session_state.get("youtube_api_key", ""),
        type="password",
        help=(
            "Provide a YouTube Data API key to search for videos from within the studio. "
            f"You can also export it via the {YOUTUBE_ENV_VAR} environment variable."
        ),
    )
    if youtube_api_key:
        st.session_state["youtube_api_key"] = youtube_api_key

    region_code = sidebar.text_input(
        "YouTube region code",
        value=st.session_state.get("youtube_region_code", "US"),
        max_chars=2,
        help="Optional two-letter region code to bias YouTube search results.",
    ).upper()
    st.session_state["youtube_region_code"] = region_code

    sidebar.markdown("---")
    sidebar.markdown("### Gemini enrichment")
    gemini_default = _load_default_gemini_api_key()
    gemini_api_key = sidebar.text_input(
        "Gemini API key",
        value=gemini_default or st.session_state.get("gemini_api_key", ""),
        type="password",
        help=(
            "Optional key for the Gemini 2.5 Pro API. Set the "
            f"{GEMINI_ENV_VAR} environment variable or provide it here to unlock intelligent summaries."
        ),
    )
    st.session_state["gemini_api_key"] = gemini_api_key

    gemini_enabled_default = st.session_state.get("gemini_enabled", bool(gemini_api_key or gemini_default))
    gemini_enabled = sidebar.checkbox(
        "Enrich transcripts with Gemini",
        value=gemini_enabled_default,
        help="Automatically request formatted transcripts, summaries, and insights from Gemini.",
    )
    st.session_state["gemini_enabled"] = gemini_enabled
    if gemini_enabled and not gemini_api_key:
        sidebar.warning("Provide a Gemini API key to activate enrichment.")

    gemini_model = sidebar.text_input(
        "Gemini model",
        value=st.session_state.get("gemini_model", DEFAULT_GEMINI_MODEL),
        help="Override the Gemini model identifier if needed.",
    ) or DEFAULT_GEMINI_MODEL
    st.session_state["gemini_model"] = gemini_model

    gemini_endpoint = sidebar.text_input(
        "Gemini endpoint",
        value=st.session_state.get("gemini_endpoint", DEFAULT_GEMINI_ENDPOINT),
        help="Base endpoint for the Gemini API.",
    ) or DEFAULT_GEMINI_ENDPOINT
    st.session_state["gemini_endpoint"] = gemini_endpoint

    gemini_timeout = sidebar.slider(
        "Gemini timeout (s)",
        min_value=10,
        max_value=120,
        value=int(st.session_state.get("gemini_timeout", 60)),
        step=5,
    )
    st.session_state["gemini_timeout"] = gemini_timeout

    gemini_temperature = sidebar.slider(
        "Gemini creativity",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("gemini_temperature", 0.2)),
        step=0.05,
        help="Lower values keep the enrichment focused and deterministic.",
    )
    st.session_state["gemini_temperature"] = gemini_temperature

    sidebar.markdown("---")
    sidebar.markdown("### Tips")
    sidebar.info(
        "Upload mono WAV files for the best results. You can visualise both waveform and spectrogram before transcribing."
    )

    st.session_state.setdefault("yt_search_results", [])
    st.session_state.setdefault("yt_selected_ids", [])
    st.session_state.setdefault("yt_transcriptions", {})

    upload_tab, record_tab, youtube_tab = st.tabs(
        ["Upload file", "Record with microphone", "Search YouTube"]
    )

    audio_bytes: bytes | None = None
    suffix = ".wav"
    audio_label = "uploaded_audio.wav"
    uploaded_audio_bytes: bytes | None = None
    uploaded_suffix = ".wav"
    uploaded_label = "uploaded_audio.wav"
    recorded_audio_bytes: bytes | None = None
    recorded_label = "microphone_capture.wav"

    with upload_tab:
        uploaded_file = st.file_uploader(
            "Upload audio",
            type=["wav", "mp3", "m4a", "ogg", "flac", "aac"],
            help="Drag an audio clip here to preview and transcribe.",
        )
        if uploaded_file is not None:
            uploaded_audio_bytes = uploaded_file.getvalue()
            uploaded_suffix = Path(uploaded_file.name).suffix or ".wav"
            uploaded_label = uploaded_file.name

    with record_tab:
        recorded_audio = _render_mic_recorder()
        if recorded_audio:
            st.session_state["mic_audio"] = recorded_audio
        stored_mic_audio = st.session_state.get("mic_audio")
        if stored_mic_audio:
            st.audio(stored_mic_audio, format="audio/wav")
            st.caption("Preview of your captured microphone clip.")
            if st.button("Discard recording", key="discard-mic"):
                st.session_state.pop("mic_audio", None)
                stored_mic_audio = None
            else:
                recorded_audio_bytes = stored_mic_audio

    with youtube_tab:
        st.markdown(
            "Search for up to ten public YouTube videos and transcribe their narration without leaving the dashboard."
        )
        if not youtube_api_key:
            st.info("Provide a YouTube Data API key in the sidebar to enable video search.")
        else:
            query = st.text_input("Search query", key="yt-query")
            max_results = st.slider(
                "Results", min_value=3, max_value=25, value=10, help="Number of videos to retrieve."
            )
            search_triggered = st.button("Search", key="yt-search", type="primary")
            if search_triggered and query:
                with st.spinner("Searching YouTube..."):
                    try:
                        results = _search_youtube_videos(
                            youtube_api_key,
                            query,
                            max_results=max_results,
                            region_code=region_code or None,
                        )
                    except Exception as exc:  # pragma: no cover - runtime feedback only
                        st.error(f"Failed to search YouTube: {exc}")
                    else:
                        st.session_state["yt_search_results"] = results
                        st.session_state["yt_selected_ids"] = [
                            vid
                            for vid in st.session_state.get("yt_selected_ids", [])
                            if any(r["video_id"] == vid for r in results)
                        ]
            results = st.session_state.get("yt_search_results", [])
            if results:
                if TEST_MODE and not st.session_state.get("yt_selected_ids"):
                    st.session_state["yt_selected_ids"] = [
                        video["video_id"] for video in results[:MAX_YOUTUBE_SELECTION]
                    ][:2]
                options = {video["video_id"]: _format_video_label(video) for video in results}
                selected_ids = st.multiselect(
                    "Select videos to transcribe",
                    options=list(options.keys()),
                    default=[
                        vid
                        for vid in st.session_state.get("yt_selected_ids", [])
                        if vid in options
                    ],
                    format_func=lambda vid: options.get(vid, vid),
                    help=f"Choose up to {MAX_YOUTUBE_SELECTION} videos.",
                )
                if len(selected_ids) > MAX_YOUTUBE_SELECTION:
                    st.error(
                        f"You selected {len(selected_ids)} videos. Please keep the selection to {MAX_YOUTUBE_SELECTION}."
                    )
                st.session_state["yt_selected_ids"] = selected_ids

                for video in results:
                    with st.expander(_format_video_label(video), expanded=False):
                        if video.get("thumbnail"):
                            st.image(video["thumbnail"], width=240)
                        if video.get("description"):
                            st.caption(video["description"])
                        video_url = YOUTUBE_VIDEO_URL.format(video_id=video["video_id"])
                        st.markdown(f"[Open on YouTube]({video_url})")

                if yt_dlp is None and not TEST_MODE:
                    st.warning(
                        "Install the optional 'yt-dlp' package to download audio tracks for transcription."
                    )

                process_disabled = (
                    not selected_ids
                    or len(selected_ids) > MAX_YOUTUBE_SELECTION
                    or (yt_dlp is None and not TEST_MODE)
                    or not api_key
                )

                if not api_key:
                    st.warning(
                        "Add your DashScope API key in the sidebar to transcribe the selected videos."
                    )

                if st.button(
                    "Download audio & transcribe selected videos",
                    key="yt-process",
                    disabled=process_disabled,
                    type="primary",
                ):
                    transcripts = st.session_state.get("yt_transcriptions", {})
                    with st.spinner("Processing selected videos..."):
                        for video_id in selected_ids:
                            video_meta = next(
                                (item for item in results if item["video_id"] == video_id), None
                            )
                            if video_meta is None:
                                continue
                            try:
                                audio_bytes, suffix = _download_youtube_audio(video_id)
                                analysis = _analyse_audio(audio_bytes, suffix)
                                response = _transcribe_audio(
                                    api_key,
                                    audio_bytes,
                                    model=model,
                                    audio_format=suffix.lstrip(".") or "wav",
                                    language=language or None,
                                    prompt=prompt or None,
                                    endpoint=endpoint,
                                    timeout=timeout,
                                )
                                transcript_text = extract_transcript_text(response)
                                gemini_enrichment = None
                                if gemini_enabled and gemini_api_key:
                                    with st.spinner(
                                        f"Requesting Gemini insights for {video_meta['title']}..."
                                    ):
                                        try:
                                            gemini_enrichment = _enrich_transcript(
                                                gemini_api_key,
                                                transcript_text,
                                                model=gemini_model,
                                                endpoint=gemini_endpoint,
                                                timeout=gemini_timeout,
                                                temperature=gemini_temperature,
                                                context=(
                                                    f"YouTube video '{video_meta.get('title', '')}'"
                                                ),
                                            )
                                        except (GeminiError, ValueError) as exc:
                                            st.warning(
                                                f"Gemini enrichment failed for {video_meta['title']}: {exc}"
                                            )
                            except TranscriptionError as error:
                                st.error(f"Transcription failed for {video_meta['title']}: {error}")
                                continue
                            except Exception as exc:  # pragma: no cover - runtime feedback only
                                st.error(f"Failed to process {video_meta['title']}: {exc}")
                                continue

                            transcripts[video_id] = {
                                "meta": video_meta,
                                "audio_bytes": audio_bytes,
                                "suffix": suffix,
                                "analysis": analysis,
                                "response": response,
                                "transcript_text": transcript_text,
                                "gemini": gemini_enrichment,
                            }
                    st.session_state["yt_transcriptions"] = transcripts
                    st.success("Finished processing the selected YouTube videos.")

            stored_transcripts = st.session_state.get("yt_transcriptions", {})
            for video_id in st.session_state.get("yt_selected_ids", []):
                transcript_entry = stored_transcripts.get(video_id)
                if not transcript_entry:
                    continue
                meta = transcript_entry["meta"]
                analysis = transcript_entry["analysis"]
                response = transcript_entry["response"]
                audio_bytes = transcript_entry["audio_bytes"]
                suffix = transcript_entry["suffix"]
                segments = extract_segments(response)
                transcript_text = transcript_entry.get("transcript_text") or extract_transcript_text(
                    response
                )
                gemini_entry = transcript_entry.get("gemini")

                with st.expander(f"Transcript: {_format_video_label(meta)}", expanded=False):
                    col1, col2, col3 = st.columns(3)
                    col1.metric("Sample rate", f"{analysis['sample_rate']:,} Hz")
                    col2.metric("Duration", f"{analysis['duration']:.2f} s")
                    col3.metric("Peak", f"{analysis['peak']:.2f}")
                    st.caption("RMS level: {:.4f}".format(analysis["rms"]))
                    st.audio(audio_bytes, format=f"audio/{suffix.lstrip('.') or 'wav'}")
                    _render_waveform(analysis["samples"], analysis["sample_rate"])
                    _render_spectrogram(analysis["samples"], analysis["sample_rate"])
                    st.subheader("Raw transcript")
                    st.write(transcript_text)
                    _download_button(
                        transcript_text,
                        Path(meta.get("title", "video")).stem + "_transcript.txt",
                    )
                    if gemini_entry:
                        _render_gemini_insights(gemini_entry)
                    elif gemini_api_key and not gemini_enabled:
                        if st.button(
                            "Generate Gemini insights",
                            key=f"yt-gemini-{video_id}",
                            help="Run Gemini enrichment for this transcript.",
                        ):
                            with st.spinner(
                                f"Requesting Gemini insights for {meta.get('title', video_id)}..."
                            ):
                                try:
                                    gemini_entry = _enrich_transcript(
                                        gemini_api_key,
                                        transcript_text,
                                        model=gemini_model,
                                        endpoint=gemini_endpoint,
                                        timeout=gemini_timeout,
                                        temperature=gemini_temperature,
                                        context=f"YouTube video '{meta.get('title', video_id)}'",
                                    )
                                except (GeminiError, ValueError) as exc:
                                    st.warning(f"Gemini enrichment failed: {exc}")
                                else:
                                    st.session_state["yt_transcriptions"][video_id][
                                        "gemini"
                                    ] = gemini_entry
                                    _render_gemini_insights(gemini_entry)
                    elif gemini_enabled and gemini_api_key:
                        st.info(
                            "Gemini enrichment was requested but did not return insights for this transcript."
                        )
                    if segments:
                        st.subheader("Timeline explorer")
                        _render_timeline(segments)
                        _highlight_transcript(segments)
                        with st.expander("Segment details", expanded=False):
                            st.dataframe(segments, use_container_width=True)
                            confidences = [
                                s.get("confidence") for s in segments if s.get("confidence") is not None
                            ]
                            if confidences:
                                avg_confidence = sum(confidences) / len(confidences)
                                st.metric("Average confidence", f"{avg_confidence:.2%}")
                    st.subheader("Raw response")
                    _render_json(response)

    if recorded_audio_bytes is not None:
        audio_bytes = recorded_audio_bytes
        suffix = ".wav"
        audio_label = recorded_label
    elif uploaded_audio_bytes is not None:
        audio_bytes = uploaded_audio_bytes
        suffix = uploaded_suffix
        audio_label = uploaded_label

    if audio_bytes is None:
        if not st.session_state.get("yt_transcriptions"):
            st.info(
                "Upload or record an audio sample, or use the Search YouTube tab to begin your transcription journey."
            )
        return

    try:
        analysis = _analyse_audio(audio_bytes, suffix)
    except Exception as exc:  # pragma: no cover - streamlit runtime only
        st.error(f"Failed to analyse audio: {exc}")
        return

    samples = analysis["samples"]
    sample_rate = analysis["sample_rate"]
    duration = analysis["duration"]

    st.subheader("Audio insights")
    col1, col2, col3 = st.columns(3)
    col1.metric("Sample rate", f"{sample_rate:,} Hz")
    col2.metric("Duration", f"{duration:.2f} s")
    col3.metric("Peak", f"{analysis['peak']:.2f}")
    st.caption("RMS level: {:.4f}".format(analysis["rms"]))

    st.audio(audio_bytes, format=f"audio/{suffix.lstrip('.') or 'wav'}")

    _render_waveform(samples, sample_rate)
    _render_spectrogram(samples, sample_rate)

    if not api_key:
        st.warning(
            "Provide your DashScope API key in the sidebar to enable transcription."
        )
        return

    if st.button("Transcribe", type="primary"):
        with st.spinner("Contacting Qwen 3 ASR..."):
            try:
                response = _transcribe_audio(
                    api_key,
                    audio_bytes,
                    model=model,
                    audio_format=suffix.lstrip(".") or "wav",
                    language=language or None,
                    prompt=prompt or None,
                    endpoint=endpoint,
                    timeout=timeout,
                )
            except TranscriptionError as error:
                st.error(str(error))
                return

        st.success("Transcription completed successfully!")

        transcript = extract_transcript_text(response)
        segments = extract_segments(response)
        gemini_result = None
        if gemini_enabled and gemini_api_key:
            with st.spinner("Requesting Gemini intelligence..."):
                try:
                    gemini_result = _enrich_transcript(
                        gemini_api_key,
                        transcript,
                        model=gemini_model,
                        endpoint=gemini_endpoint,
                        timeout=gemini_timeout,
                        temperature=gemini_temperature,
                        context=f"Audio sample '{audio_label}' lasting {duration:.2f} seconds",
                    )
                except (GeminiError, ValueError) as exc:
                    st.warning(f"Gemini enrichment failed: {exc}")
        elif gemini_api_key and not gemini_enabled:
            st.info("Enable Gemini enrichment in the sidebar to generate formatted insights.")

        st.subheader("Raw transcript")
        st.write(transcript)
        _download_button(transcript, Path(audio_label).stem + "_transcript.txt")

        if gemini_result:
            _render_gemini_insights(gemini_result)

        if segments:
            st.subheader("Timeline explorer")
            _render_timeline(segments)
            _highlight_transcript(segments)
            with st.expander("Segment details", expanded=False):
                st.dataframe(segments, use_container_width=True)
                confidences = [s.get("confidence") for s in segments if s.get("confidence") is not None]
                if confidences:
                    avg_confidence = sum(confidences) / len(confidences)
                    st.metric("Average confidence", f"{avg_confidence:.2%}")

        st.subheader("Raw response")
        _render_json(response)


if __name__ == "__main__":
    main()
