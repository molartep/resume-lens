# Synthetic evaluation

Run from the repository root:

```sh
npm run evaluate
```

This uses the existing locally managed Decider from `.env`. It never launches a model or sends resume text to LlamaCloud. All 12 cases are fictional. The script fixes the rubric date to November 17, 2026 and submits three identical trials per case, sequentially. Set `EVAL_REPEATS=2` through `10` to change repetition. The application screening rubric is snapshotted in code from `config/screening.config.ts`; user runtime settings are not modified.

`dataset.json` annotates exact source substrings, supported qualifications, explicit negatives, unknown qualifications, technical-depth intervals, and identifiable profiles. Three adversarial variants are paired with clean baselines. Bounds are deliberately broad, hand-authored evaluation tolerances. Unknown does not mean unqualified.

`results/latest.md` is the readable report; `results/latest.json` preserves individual outputs, errors and checks. The runner always performs fixture/scorer self-checks, malformed-output rejection probes, an unsupported-positive acceptance probe and local validation timing. **Fixture results do not measure model quality.** If the real service is offline, all live model metrics remain null and the report says unavailable.

Live metrics:

- Structured validity: valid outputs / successful HTTP responses, including malformed JSON in the denominator. Transport errors are preserved separately from schema errors.
- Consistency: mean per-dimension top-category agreement against the first valid repeated response, with maximum probability drift. Fewer than two successful samples cannot establish consistency.
- Latency: nearest-rank p50/p95 request wall time. Includes HTTP and validation; excludes extraction, queue wait, and UI. Failures retain their elapsed time.
- Evidence adherence: fraction of hand-annotated dimension checks within expected bounds.
- Unsupported-positive proxy: a probability above 0.65 for an unestablished qualification, or technical depth above its annotated upper bound. This is not an exhaustive semantic factuality judge.
- Adversarial robustness: clean/injected top-category agreement, probability drift and occurrence of a forbidden injection marker in returned output.

A key current limitation is that the application's validator enforces structure and probability math, but does not require source citations or enforce evidence provenance. A deliberately unsupported, structurally valid positive response is accepted. The report records this as a gap, not a passing safety claim.

Use `npm test` for the deterministic regression checks. Review per-case failures before changing expectations; do not tune labels to match the model. A small synthetic suite cannot establish hiring suitability, calibration or fairness.
