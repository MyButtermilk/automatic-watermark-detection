import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np
import pytest
from playwright.sync_api import expect, sync_playwright

STREAMLIT_PORT = 8501
BASE_URL = f"http://127.0.0.1:{STREAMLIT_PORT}"


def _write_demo_wav(path: Path, duration: float = 1.5, sample_rate: int = 16_000) -> None:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    waveform = 0.4 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 440 * t)
    clipped = np.clip(waveform, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())


@pytest.fixture(scope="session")
def test_audio_file(tmp_path_factory: pytest.TempPathFactory) -> Path:
    temp_dir = tmp_path_factory.mktemp("audio")
    audio_path = temp_dir / "demo.wav"
    _write_demo_wav(audio_path)
    return audio_path


@pytest.fixture(scope="session")
def streamlit_server(tmp_path_factory: pytest.TempPathFactory):
    repo_root = Path(__file__).resolve().parents[2]
    log_dir = tmp_path_factory.mktemp("logs")
    log_file = log_dir / "streamlit.log"

    env = os.environ.copy()
    env.update(
        {
            "ASR_STUDIO_TEST_MODE": "1",
            "DASHSCOPE_API_KEY": "test-dashscope",
            "YOUTUBE_API_KEY": "test-youtube",
            "GEMINI_API_KEY": "test-gemini",
            "STREAMLIT_BROWSER_GATHER_USAGE_STATS": "false",
            "STREAMLIT_SERVER_HEADLESS": "true",
            "STREAMLIT_SERVER_ADDRESS": "0.0.0.0",
            "STREAMLIT_SERVER_PORT": str(STREAMLIT_PORT),
        }
    )

    log_handle = log_file.open("w", encoding="utf-8")
    cmd = [
        sys.executable,
        "-m",
        "streamlit",
        "run",
        str(repo_root / "src" / "qwen_asr_ui.py"),
        f"--server.port={STREAMLIT_PORT}",
        "--server.address=0.0.0.0",
        "--server.headless=true",
        "--browser.gatherUsageStats=false",
    ]
    process = subprocess.Popen(
        cmd,
        cwd=str(repo_root),
        env=env,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
    )

    health_url = f"{BASE_URL}/_stcore/health"
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url) as response:  # noqa: S310 (local URL)
                if response.status == 200:
                    break
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.5)
    else:
        process.terminate()
        process.wait(timeout=10)
        log_handle.close()
        raise RuntimeError("Streamlit server did not start in time")

    yield BASE_URL

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
    log_handle.close()


def test_dashboard_upload_and_youtube_workflows(streamlit_server, test_audio_file: Path):
    base_url = streamlit_server
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.goto(base_url, wait_until="domcontentloaded")
        page.wait_for_timeout(1000)
        password_inputs = page.locator("input[type='password']")
        expect(password_inputs.nth(0)).to_be_visible(timeout=60000)
        password_inputs.nth(0).fill("test-dashscope")
        password_inputs.nth(1).fill("test-youtube")
        password_inputs.nth(2).fill("test-gemini")
        expect(page.get_by_text("offline test mode", exact=False)).to_be_visible(timeout=60000)

        page.get_by_role("tab", name="Upload file").click()
        page.locator("input[type='file']").set_input_files(str(test_audio_file))
        expect(page.get_by_text("Audio insights")).to_be_visible(timeout=60000)
        transcribe_button = page.get_by_role("button", name="Transcribe")
        expect(transcribe_button).to_be_visible(timeout=20000)
        transcribe_button.click()

        expect(page.get_by_text("Transcription completed successfully!")).to_be_visible(timeout=20000)
        expect(page.get_by_text("Gemini intelligence")).to_be_visible(timeout=20000)
        expect(
            page.get_by_text("This is a demo transcript generated", exact=False).first
        ).to_be_visible(timeout=20000)

        page.get_by_role("tab", name="Search YouTube").click()
        page.get_by_label("Search query").fill("test playlist")
        page.get_by_role("button", name="Search").click()

        expect(
            page.get_by_text("Demo watermarks explained", exact=False).first
        ).to_be_visible(timeout=20000)

        process_button = page.get_by_role(
            "button", name="Download audio & transcribe selected videos"
        )
        expect(process_button).to_be_enabled(timeout=20000)
        process_button.click()

        expect(page.get_by_text("Finished processing the selected YouTube videos.")).to_be_visible(timeout=20000)

        transcript_entry = page.get_by_text(
            "Transcript: Demo watermarks explained — Test Insights", exact=False
        )
        expect(transcript_entry.first).to_be_visible(timeout=20000)
        transcript_entry.first.click()

        expect(page.get_by_text("Gemini intelligence")).to_be_visible(timeout=20000)
        expect(
            page.get_by_text("Offline summary for deterministic automated tests.")
        ).to_be_visible(timeout=20000)

        browser.close()
