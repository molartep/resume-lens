# Resume Lens synthetic evaluation

Generated: 2026-11-17T22:36:59.135Z

12 hand-authored cases; expected evidence spans, incomplete histories, ambiguous ownership, explicit negatives and three paired prompt injections. Fixed evaluation date: 2026-11-17. Repeats per live case: 3.

## Live model measurements

Status: **unavailable**. Local Decider service was offline. No live model metrics were produced.

| Metric | Result |
|---|---|
| Structured-output validity | Not measured |
| Evidence-bound checks | Not measured |
| Unsupported-positive proxy | Not measured |
| Repeated top-category agreement | Not measured |
| HTTP latency p50 / p95 | Not measured |

## Deterministic application findings

Fixture benchmark: 36 validations; 100% schema-valid; 100% repeated top-category agreement (authored deterministic inputs). Validation-only latency p50 **0.048 ms**, p95 **0.095 ms**. These are measured local validator timings, not inference latency or model consistency.

- Invalid structured responses rejected: **6/6**.
- Dataset and scorer self-checks: **12/12** authored cases pass their annotation bounds. These are harness checks, not model accuracy.
- **Unsupported positives are accepted when structurally valid:** the application validator accepted a deliberately false high-probability response on the incomplete skills-only resume (3 flagged unsupported-positive opportunities). The app labels outputs as model probabilities and requires human evidence review, but does not enforce evidence provenance. Avoiding unsupported claims is therefore **not established**.

## Limitations

- Unsupported-positive rate is a rubric-based proxy: probabilities >0.65 for unestablished qualifications, or technical depth above the annotated interval. It is not a full semantic factuality audit.
- Missing evidence does not prove a qualification is absent. Unknown expectations allow probabilities through 0.65.
- Current structured output has no required evidence citations or abstention for every dimension. Valid schema does not guarantee supported claims.
- A tiny synthetic dataset does not establish production accuracy, fairness, or calibration.
- Latency includes the local HTTP request and validation; it excludes cloud PDF parsing, UI and queue wait. No values are reported without real calls.

The JSON report preserves every live result, error, latency and per-case check for inspection. Run `npm run evaluate` with the local Decider online to populate the live measurements.
