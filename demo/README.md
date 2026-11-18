# ResumeLens / one-minute demo

**Watch:** `output/resume-lens-demo.mp4` (1920 × 1080, 30 fps, 60 seconds, silent, H.264).

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

The original edit and on-screen copy are in `storyboard.json`. The 60-second walkthrough is now silent; its visuals and captions are preserved. `output/resume-lens-demo.srt` supplies companion text; the original captions remain burned into the application scenes. `output/poster.png` is a preview frame.

## Reproduce

Requires Node 22.13+, dependencies from the repository, Playwright/Chromium, FFmpeg with libx264 and drawtext, Python with ReportLab and Pillow, and a system font configured in `brand.py`. No provider credentials are required. Linux/Windows can substitute a system font configured in `brand.py`.

1. `npm run build`
2. Generate the synthetic PDF and title assets with `python3 demo/create-assets.py` (observe the PDF skill marker when using Codex).
3. `node --import tsx demo/server.ts` in one terminal. Each start creates a **fresh temporary database**, settings file, PDF store and queue. It never opens the production database or modifies user settings. The server binds only to `127.0.0.1:4317`.
4. In another terminal, install Playwright in a separate tools directory and run `node demo/record.mjs`. Use `PLAYWRIGHT_MODULE=/absolute/path/to/playwright` if the module is outside this project and `CHROMIUM_EXECUTABLE=/absolute/path/to/chromium` if using an existing browser. Browser screencast frames capture real UI actions; no provider credentials or external uploads are used.
5. `python3 demo/render.py` composes the screencast with title cards, chapter headings and captions; exports exactly 60 seconds with no audio track.
6. Check the video with `ffprobe` and inspect its rendered frames. Stop the demo server when finished.

`output/session.json` identifies the temporary data root for cleanup. Intermediate audio, frames and session metadata are ignored by Git; the final MP4, captions, poster and source scripts are retained. Rerun the recorder against a newly started server for a clean candidate history.

## Promotional cut

The separate [45-second promotional video](promo/output/resume-lens-promo-45s.mp4) uses recorded interactive platform mockups, animated scores and probabilities, a stock neural voice, and an original instrumental bed. See [promo production notes](promo/README.md).

Both videos and their source document now use the supplied R-Lens lockup and [shared brand tokens](../client/public/brand/tokens.css). The full manual is preserved under [docs/brand](../docs/brand/BRAND.md).
