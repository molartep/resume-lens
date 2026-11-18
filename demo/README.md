# Resume Lens / one-minute demo

**Watch:** `output/resume-lens-demo.mp4` (1920 × 1080, 30 fps, 60 seconds, narrated English, H.264/AAC).

All candidate data and displayed predictions are fictional. The video labels simulated providers throughout. The app, HTTP routes, PDF viewer, SQLite queue, reload recovery, candidate history and rubric editor are real. Provider responses and their 2.6-second example latency are authored fixtures, not measured inference performance. The evaluation results live separately under `evaluations/results/`.

Timeline:

| Time | Moment |
|---|---|
| 00–05 | Evidence-first title |
| 05–11 | Upload and extraction progress |
| 11–21 | Professional evidence and required human review |
| 21–28 | Queued analysis and reconnect after reload |
| 28–38 | Individual dimensions and probability distributions |
| 38–45 | Original PDF and reviewed evidence |
| 45–55 | Saved candidate history and configurable rubrics |
| 55–60 | Closing title and fictional-data disclosure |

The narration and edit decisions are in `storyboard.json`. `output/resume-lens-demo.srt` supplies companion captions; captions are also burned into the application scenes. `output/poster.png` is a preview frame.

## Reproduce

Requires Node 22.13+, dependencies from the repository, Playwright/Chromium, FFmpeg with libx264 and drawtext, Python with ReportLab and Pillow, and macOS `say` with Samantha installed. No provider credentials are required. Linux/Windows can substitute generated WAV narration and a local font in `render.py`.

1. `npm run build`
2. Generate the synthetic PDF and title assets with `python3 demo/create-assets.py` (observe the PDF skill marker when using Codex).
3. `node --import tsx demo/server.ts` in one terminal. Each start creates a **fresh temporary database**, settings file, PDF store and queue. It never opens the production database or modifies user settings. The server binds only to `127.0.0.1:4317`.
4. In another terminal, install Playwright in a separate tools directory and run `node demo/record.mjs`. Use `PLAYWRIGHT_MODULE=/absolute/path/to/playwright` if the module is outside this project and `CHROMIUM_EXECUTABLE=/absolute/path/to/chromium` if using an existing browser. Browser screencast frames capture real UI actions; no provider credentials or external uploads are used.
5. `python3 demo/narrate.py` uses macOS local speech synthesis.
6. `python3 demo/render.py` composes the screencast with title cards, chapter headings, captions and narration; exports exactly 60 seconds.
7. Check the video with `ffprobe` and inspect its rendered frames. Stop the demo server when finished.

`output/session.json` identifies the temporary data root for cleanup. Intermediate audio, frames and session metadata are ignored by Git; the final MP4, captions, poster and source scripts are retained. Rerun the recorder against a newly started server for a clean candidate history.
