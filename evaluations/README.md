# Synthetic evaluation

`npm run evaluate` performs offline fixture, annotation and validator checks. It makes **no network requests**. The output is `results/fixtures/latest.json`; authored fixtures never contribute to model quality, consistency or inference latency.

Live inference is a deliberate local action, disabled whenever `CI` is set:

```sh
npm run evaluate -- --live --profiles groq --repeats 3 --max-requests 36 --max-tokens 3000000 --max-seconds 600 --max-output-tokens 2048
```

Use profile IDs from Settings; omit `--profiles` to evaluate every enabled configured profile. The runner calls `modelService.decide`, using the same local, OpenAI Decisions, Gemini Decisions/generation, Anthropic and Groq adapters and credential resolution as production. It never loads saved résumés, PDFs, parsing services or application analyses. No retries are made. Disabled connections are excluded; missing credentials become separately classified adapter failures.

All four budget arguments are required for live runs. Request count is a hard global cap. Each request reserves a conservative estimate of input tokens plus its configured output cap, and must fit entirely within the remaining wall-time allowance using its timeout. Skipped trials are counted; budget exhaustion is explicit. Token reservations are admission estimates, not measured billing or a currency ceiling. Generated APIs receive the capped output setting; native Decisions APIs and local Decider manage their own output behavior. A hard request/time budget remains effective for every adapter. Runs are sequential, so smaller budgets may exhaust before later profiles are reached; select profiles explicitly for targeted comparisons.

Only the pinned, reviewed public synthetic `dataset.json` is accepted. Editing it requires reviewing privacy and updating the SHA-256 pin in the script. Reports snapshot this fictional evidence and its annotations, fixed as-of date, rubric, evaluation version, model ID, generation parameters and a hash of the profile ID. Endpoints, organization/project, profile names, credentials, raw response bodies, arbitrary model extensions and exception messages are omitted. Model answers are reconstructed from allowlisted numeric fields and rubric labels. Live JSON and Markdown reports use private file permissions under gitignored `results/live/`. Do not upload that directory or configuration/storage directories as CI artifacts. CI should run only fixtures and tests.

The twelve cases include incomplete histories, ambiguous ownership, explicit negatives, three clean/injected pairs, and the January 2021–December 2024 regression: **48 months = 4 years**. The default experience question now has type `experience`, is calculated locally, and has no rubric index or probability distribution. Historical SCORE configurations still map four years to index 2; a model index of 4 means the eight-year level and is flagged as conflicting. Year-only and missing dates always require review.

Live measurements are reported per profile, preserving native-distribution versus generated-estimate provenance:

- Structured validity: valid / (valid + malformed output), including malformed JSON. Transport, authentication, timeout, refusals and adapter/configuration failures are counted separately.
- Evidence adherence: annotated semantic bounds, for model dimensions. Deterministic duration checks are recorded separately and excluded from model adherence, agreement and probability drift. Unsupported positives count unestablished qualifications above 0.65, technical depth above bounds and inflated experience indices. Unknown evidence does not prove absent ability.
- Repeated agreement and maximum probability drift: valid repeats compared with the first valid result for the same case/profile; fewer than two results gives null, never invented agreement.
- p50/p95: nearest-rank wall time through the production adapter, validation and experience calculation. Failure latency is separate.
- Adversarial pairs: baseline/injected agreement and drift; injection marker detection occurs before unsafe output extensions are discarded.

These broad semantic proxies and a tiny synthetic corpus do not establish factuality, calibration, fairness or hiring suitability. The structural validator still accepts unsupported schema-valid claims; semantic checks report this limitation. `npm test` covers deterministic regressions and mocked provider contracts. Live failures and semantic regressions exit 1; incomplete budget-exhausted runs exit 2; reports remain available for review.

# Experience policy

`shared/experience.ts` extracts supported date ranges only within explicit Experience / Work History / Employment sections. Every interval includes source line, character offsets and exact quote. Inclusive calendar months are unioned, so overlapping jobs and duplicates count once, gaps contribute nothing, and present resolves to the saved as-of month. Month-name and YYYY-MM date formats are supported. Year-only starts/ends produce lower/upper union bounds; missing, reversed, future and unsupported intervals require review. The result describes documented evidence, not verified employment or proof of a complete career. Unrecognized layouts need manual review.

The default `experience` dimension has no criteria or rubric and supports a `documented_years` review threshold. Incomplete or ambiguous evidence always raises a review warning, even without a numeric threshold. It is excluded from every provider request; a configuration containing only deterministic questions needs no model connection.

For historical configurations, a score dimension can define `experienceMonths`, strictly increasing from zero with one anchor per rubric level. Duration maps by linear interpolation between those anchors and saturates at the last level. No mapping is inferred from label wording. Incomplete/ambiguous evidence has no exact mapping. The application retains the model's expected index separately, and flags disagreement greater than 0.25 index units. The UI displays duration, source intervals and issues. Historical SCORE results additionally show their rubric mapping and model distribution. Existing historical analyses without deterministic experience metadata are unchanged.
