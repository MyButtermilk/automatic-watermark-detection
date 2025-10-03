### Qwen 3 ASR Transcription Toolkit

The repository now also contains tooling that demonstrates how to interact with
the Qwen 3 Automatic Speech Recognition (ASR) API from both the command line and
an interactive dashboard.

#### Command-line helper

1. Install the lightweight dependency:
   ```bash
   pip install requests
   ```
2. Export your DashScope API key (or pass it via `--api-key`):
   ```bash
   export DASHSCOPE_API_KEY="sk-..."
   ```
3. Run the CLI with your audio file and desired model:
   ```bash
   python -m src.qwen_asr_transcription \
       --audio-path path/to/audio.wav \
       --model qwen-3.0-asr \
       --language de-DE \
       --output transcript.json
   ```

The command prints the raw JSON response or writes it to the file specified via
`--output`. Use the `--prompt` flag if you want to provide a custom context for
the transcription, and `--endpoint` to override the default DashScope service
URL. The helper now normalises popular file extensions and MIME types so you can
drop in MP3, M4A, AAC, FLAC, or WAV files without worrying about the API format
codes. Import the `extract_transcript_text` and `extract_segments` utilities if
you want to reuse the parsing logic in your own applications.  The
`enrich_transcript_with_gemini` function is also available to polish transcripts
and generate structured summaries via Gemini 2.5 Pro from any Python workflow.

#### Streamlit studio

For a richer experience, launch the new Streamlit interface which provides
waveform and spectrogram visualisations, segment timelines, a segment explorer,
audio playback, and easy transcript downloads.

1. Install the optional UI dependencies (add the microphone recorder component if you plan to capture audio in the browser, and `yt-dlp` if you want to ingest YouTube videos):
   ```bash
   pip install streamlit plotly librosa soundfile numpy audio-recorder-streamlit yt-dlp
   ```
2. Ensure your DashScope API key is available either via the
   `DASHSCOPE_API_KEY` environment variable or by entering it in the sidebar.
3. Start the dashboard:
   ```bash
   streamlit run src/qwen_asr_ui.py
   ```
4. Upload an audio file (WAV, MP3, M4A, OGG, FLAC, AAC) **or** record a fresh
   take with the glowing microphone panel to explore the interactive analytics
   and trigger a transcription.

The dashboard previews your audio with a detailed waveform, a frequency
spectrogram, loudness metrics, an interactive timeline, a tabular segment
summary (with average confidence), audio playback, in-browser microphone
recording, and a downloadable transcript once the API call succeeds.

##### Gemini-powered formatting & summaries

Set the `GEMINI_API_KEY` environment variable (or paste the key into the
sidebar) to unlock automatic post-processing with the Gemini 2.5 Pro API. When
enabled, every transcript is polished into Markdown paragraphs and accompanied
by a structured summary that surfaces the overview, key points, action items,
and notable quotes. Language detection and topic hints are also included in the
insights drawer. Toggle the *Gemini enrichment* checkbox in the sidebar to
control whether enrichment runs automatically after each transcription, or use
the contextual buttons inside each transcript panel to request insights on
demand.

##### YouTube search and batch transcription

Open the **Search YouTube** tab to look up public videos without leaving the
studio. Provide a YouTube Data API key via the `YOUTUBE_API_KEY` environment
variable (or the sidebar) to unlock the search field, pick up to ten matches,
and let the app fetch the audio track via `yt-dlp`. Each processed video
appears in its own expandable panel with playback, waveform, spectrogram,
timeline explorer, transcript download, and raw JSON details so you can compare
the results side by side.

##### Offline test mode & automated UI tests

If you need to demo the dashboard without real API access—or run automated
tests in an isolated environment—export `ASR_STUDIO_TEST_MODE=1` before launching
Streamlit. The studio will surface deterministic transcripts, Gemini summaries,
YouTube search results, and audio clips without making any external HTTP
requests. A banner at the top of the page reminds you that the app is running in
offline mode.

The repository now includes a Playwright end-to-end test that boots the
Streamlit server in offline mode, uploads a demo clip, runs Gemini enrichment,
and processes the synthetic YouTube batch flow. To execute it locally:

1. Install the UI and testing dependencies:
   ```bash
   pip install streamlit plotly librosa soundfile numpy pytest playwright
   playwright install chromium
   ```
2. Run the Playwright regression suite (the fixture handles launching and
   shutting down the Streamlit server):
   ```bash
   pytest tests/playwright/test_ui.py
   ```
