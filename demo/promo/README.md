# ResumeLens / 45-second promotional film

[Watch the promo](output/resume-lens-promo-45s.mp4). 1920 × 1080, 30 fps, exactly 45 seconds, H.264/AAC. [Companion captions](output/resume-lens-promo-45s.srt) and a [poster](output/poster.png) are included.

The revised film shows recorded **interactive video mockups** of a user working with the platform: typing a criterion, changing a review threshold, running an analysis, watching scores load, and opening reviewed evidence. The narration describes the action currently on screen.

## What changed

- Criterion typing: “Production system ownership,” followed by the professional evidence to evaluate and a save action.
- Threshold editing: the user changes the mentorship review threshold from 50% to 70%, then saves it.
- Review workflow: the user clicks Analyze candidate and the job progresses to completion.
- Animated evidence: the production `DimensionCard` component displays the fictional result. Its numbers and distribution bars animate together from zero. Mentorship reaches **92.0% Yes / 8.0% No**, and production ownership reaches **3.50**, with two rubric-level probabilities of **50.0%**.
- Source review: the complete original résumé page and reviewed evidence appear in a fixed window. There is no upward camera movement or panning.
- Every UI video is recorded in a complete 1100 × 800 viewport and fitted into its presentation window using **contain**, never cover/crop. Text, form fields, panels, and the PDF image are checked against the viewport bounds.
- The bottom-right informative text is removed. The left footer and brand treatment remain.

The mockups live in `mockup.tsx`, `mockup.css`, and `mockup.html`. They reuse the actual application `DimensionCard` component and visually match the platform's editor and review controls. They use fictional data and local presentation state, not a live model, saved candidate records, or production settings. No application component was changed for the film. The animations are a presentation of authored values, not a recording of incremental model predictions.

## Voice and edit

`story.json` contains the revised narration and visual brief. `output/timeline.json` records final timings and pronunciation strings. A locally generated Kokoro stock neural voice, `af_heart`, speaks at its natural speed. Résumé is explicitly phonemized as **REZ-yoo-may**, with stress on the first syllable. No person's voice is cloned.

The original synthesized music bed is retained and ducks beneath the narration. The windows remain fixed while the user interactions provide motion; only short scene dissolves and text fades are used. The supplied ResumeLens R-Lens lockup, deep-evergreen/neutral palette, and system-font typography are shared with the platform through `demo/brand.py`. The independent lime accent and search icon are removed.

## Reproduce

1. Install the repository dependencies, then bundle the film-only UI:
   ```sh
   node_modules/.bin/esbuild demo/promo/mockup.tsx --bundle --format=iife --jsx=automatic --outfile=demo/promo/assets/player/mockup.js
   ```
2. Generate narration with `demo/promo/voice.py` in a Python 3.12 environment containing `kokoro-onnx` and `soundfile`. Set `KOKORO_MODEL_DIR` to the directory containing `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the [upstream release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1). Keep model weights outside the repository.
3. Record interactions with `node demo/promo/record-interactions.mjs`. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` if using separate Playwright/browser installations. The mockup opens locally from `mockup.html`; no API server, provider credentials, or external uploads are required.
4. Run `demo/promo/render.py` with Python's Pillow/NumPy and FFmpeg available. It uses the recorded frames at their original timing, holds their final state for brief editorial pauses, and exports exactly 45 seconds. No platform-window motion or frame cropping is added. Set the platform system-font fallback in `demo/brand.py` on other operating systems if needed.
5. Inspect the entire MP4 with FFprobe and an end-to-end decode. Check chapter frames and the narration/music mix. `output/quality.json` stores media inspection; `output/interaction-quality.json` stores layout checks and sampled values from the probability animation.

Voice engine: [Kokoro ONNX](https://github.com/thewh1teagle/kokoro-onnx). Model and voice licenses remain with their respective upstream projects. Bundled player code, neural weights, raw recordings and intermediate audio are not committed; source, final media, captions and QA reports remain available.

The original 60-second walkthrough remains separate and silent. Its visuals are unchanged.

Brand reference: [complete supplied manual](../../docs/brand/BRAND.md) and [implementation record](../../docs/brand/IMPLEMENTATION.md).
