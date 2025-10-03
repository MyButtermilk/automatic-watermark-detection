## Automatic watermark detection and removal
This was a project that was built as part of project for CS663 (Digital Image Processing).
This is a crude Python implementation of the paper "On The Effectiveness Of Visible Watermarks", Tali Dekel, Michael Rubinstein, Ce Liu and William T. Freeman,
Conference on Computer Vision and Pattern Recongnition (CVPR), 2017.

### Rough sketch of the algorithm
A watermarked image `J` is obtained by imposing a watermark `W` over an unwatermarked image `I` with a blend factor <a href="https://www.codecogs.com/eqnedit.php?latex=\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a>. Specifically, we have the following equation:

<div align="center">
<a href="https://www.codecogs.com/eqnedit.php?latex=J(p)&space;=&space;\alpha(p)W(p)&space;&plus;&space;(1-\alpha(p))I(p)" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J(p)&space;=&space;\alpha(p)W(p)&space;&plus;&space;(1-\alpha(p))I(p)" title="J(p) = \alpha(p)W(p) + (1-\alpha(p))I(p)" /></a>
</div>

Where `p = (x, y)` is the pixel location. For a set of `K` images, we have:
<div align="center"><a href="https://www.codecogs.com/eqnedit.php?latex=J_k&space;=&space;\alpha&space;W&space;&plus;&space;(1-\alpha)I_k,\quad&space;k=1,2....K" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J_k&space;=&space;\alpha&space;W&space;&plus;&space;(1-\alpha)I_k,\quad&space;k=1,2....K" title="J_k = \alpha W + (1-\alpha)I_k,\quad k=1,2....K" /></a></div>

Although we have a lot of unknown quantities (<a href="https://www.codecogs.com/eqnedit.php?latex=J_k,&space;W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?J_k,&space;W,&space;\alpha" title="J_k, W, \alpha" /></a>), we can make use of the structural properties of the image to determine its location and estimate its structure. The coherency of <a href="https://www.codecogs.com/eqnedit.php?latex=\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a> and W over all the images can be exploited to solve the above problem with good accuracy. The steps followed to determine these values are:
- Initial watermark estimation and detection
- Estimating the matted watermark
- Compute the median of the watermarked image gradients, independently in the `x` and `y` directions, at every pixel location `p`.

<div align="center"><a href="https://www.codecogs.com/eqnedit.php?latex=\nabla{\hat{W_m}(p)}&space;=&space;median_k(\nabla{J_k(p)})" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\nabla{\hat{W_m}(p)}&space;=&space;median_k(\nabla{J_k(p)})" title="\nabla{\hat{W_m}(p)} = median_k(\nabla{J_k(p)})" /></a></div>

- Crop `W_m` to remove boundary regions by computing its magnitude and taking the bounding box of the edge map. The initial estimated watermark <a href="https://www.codecogs.com/eqnedit.php?latex=\hat{W}_m&space;\approx&space;W_m" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\hat{W}_m&space;\approx&space;W_m" title="\hat{W}_m \approx W_m" /></a> is estimated using Poisson reconstruction. Here is an estimated watermark using a dataset of 450+ Fotolia images.
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/watermark.png?raw=True" alt="watermark_est"/>

- Watermark detection: Obtain a verbose edge map (using Canny edge detector) and compute
its Euclidean distance transform, which is then correlated with <a href="https://www.codecogs.com/eqnedit.php?latex=\nabla{\hat{W_m}}" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\nabla{\hat{W_m}}" title="\nabla{\hat{W_m}}" /></a>
to get the Chamfer distance from each pixel to the closest edge.
Lastly, the watermark position is taken to be the pixel with minimum
distance in the map.

#### Multi-image matting and reconstruction
- Estimate <a href="https://www.codecogs.com/eqnedit.php?latex=I_k,&space;W_k" target="_blank"><img src="https://latex.codecogs.com/gif.latex?I_k,&space;W_k" title="I_k, W_k" /></a> keeping <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?W,&space;\alpha" title="W, \alpha" /></a> fixed.
- Watermark update - Update the value of <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?W" title="W" /></a> keeping the rest fixed.
- Matte update - Update the value of <a href="https://www.codecogs.com/eqnedit.php?latex=W,&space;\alpha" target="_blank"><img src="https://latex.codecogs.com/gif.latex?\alpha" title="\alpha" /></a> keeping the rest fixed.
	
Please refer to the paper and supplementary for a more in-depth description and derivation of the algorithm. 

Results
--------
Here are some of the results for watermarked and watermark removed images: 

<div align="center">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_137840668.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/137840668.jpg?raw=True" width="45%"> <br>

<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_168668046.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/168668046.jpg?raw=True" width="45%"> <br>

<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/fotolia_168668150.jpg?raw=True" width="45%">
<img src="https://github.com/rohitrango/automatic-watermark-detection/blob/master/final/168668150.jpg?raw=True" width="45%"> <br>
</div>

However, this is a rough implementation and the removal of watermark leaves some "traces" in form of texture distortion or artifacts. I believe this can be corrected by appropriate parameter tuning. 

More information
-------
For more information, refer to the original paper [here](http://openaccess.thecvf.com/content_cvpr_2017/papers/Dekel_On_the_Effectiveness_CVPR_2017_paper.pdf)

Disclaimer
--------
I do not encourage or endorse piracy by making this project public. The code is free for academic/research purpose. Please feel free to send pull requests for bug fixes/optimizations, etc.







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
