# Analysis model connections

ResumeLens supports Local Strands Decider, OpenAI Decisions, Google Gemini, Anthropic Claude, and Groq. Each connection has a stable ID, display name, editable model ID, enabled flag, official API origin and request timeout. You can create multiple connections for a provider. Local Decider remains selected by default; existing installations do not switch to a paid provider automatically.

## Configure and select

1. Set `ADMIN_API_TOKEN` to a random secret of at least 32 characters in `.env`, then restart the API. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. Open **Settings → Analysis models → Administrator access** and enter that token. Admin sessions expire after 30 minutes and restart; cookies are HTTP-only and SameSite Strict. Lock the screen when finished. The server also accepts the token as a Bearer credential for management API clients.
3. Edit a seeded connection or add one. Enter the model ID supported by your account, the API key and relevant parameters; enable and save it. Blank key preserves the saved credential. Removing a stored key restores the environment fallback if configured.
4. **Test saved connection** checks model metadata using the saved settings (local Decider uses its health endpoint). No evidence or paid inference is sent. Passing metadata access does not guarantee structured-output compatibility, quota or inference availability.
5. Select the connection under **Active model**. Selection applies to future analyses. Model selection is available to local workspace users; creating, editing, testing and deleting connections requires admin access.

Credentials can instead come from `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `GROQ_API_KEY`. Stored credentials take precedence. Model selection never changes LlamaCloud PDF parsing configuration.

## Official API contracts

The adapters use `fetch`, send credentials in headers, reject redirects and validate the complete normalized response before saving any analysis. The following official references informed the integration:

| Provider | API and authentication | Adaptation and settings | Official documentation |
| --- | --- | --- | --- |
| Local Strands Decider | Loopback `GET /health`, `POST /v1/systemone` | Existing state/questions contract; server manages model loading. Connection controls origin and analysis timeout. | Existing `server/services/deciderService.ts` contract |
| OpenAI Decisions | `POST /v1/decisions`, Bearer API key | Maps yes/no dimensions to predicates, categories to choices, rubric indices to score levels. Preserves native distributions and confidence. Optional organization/project headers. Does not send temperature or output-token controls; limits each request to 400 dimensions. Seed: `gpt-6-luna`. | [Decisions guide](https://developers.openai.com/api/docs/guides/decisions), [create reference](https://developers.openai.com/api/reference/resources/decisions/methods/create) |
| Gemini | `POST /{version}/models/{model}:generateContent`, `x-goog-api-key` | `generationConfig.responseMimeType` and `responseJsonSchema`; system instruction plus reviewed professional evidence. Configurable API version, maximum output tokens and optional temperature. Enter the model ID without `models/`. Seed: `gemini-3.8-flash`, `v1beta`. | [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [generateContent](https://ai.google.dev/api/generate-content), [API keys](https://ai.google.dev/gemini-api/docs/api-key) |
| Anthropic | `POST /v1/messages`, `x-api-key`, `anthropic-version` | `output_config.format` JSON schema, system policy and user evidence. Configurable API version and `max_tokens`. Default API version `2026-10-21` removes temperature; validation rejects it for this version and later. Seed: `claude-sonnet-4-6`. | [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [versioning](https://platform.claude.com/docs/en/api/versioning) |
| Groq | `POST /openai/v1/chat/completions`, Bearer API key | Strict `response_format.json_schema`, maximum completion tokens and optional temperature. Choose a model supporting strict structured outputs. Seed: `openai/gpt-oss-20b`. | [Structured outputs](https://console.groq.com/docs/structured-outputs), [API reference](https://console.groq.com/docs/api-reference) |

Model IDs are editable because account access and model catalogs change. Provider limits may be stricter than the application's parameter bounds. Unsupported combinations fail with a configuration error; the application does not silently substitute another model. Official cloud origins are allowlisted; local origins must use HTTP on `127.0.0.1`. Arbitrary API proxies are deliberately unsupported.

## Input and output processing

Only reviewer-approved professional evidence and the resolved rubric are submitted for analysis. Display names, UI labels, ordering and application review thresholds are not model instructions. The shared policy treats document instructions as untrusted, excludes sensitive-attribute inference and keeps employment decisions with humans.

Generated structured outputs (Gemini, Claude, Groq) contain a closed set of dimensions and probability maps. The server validates exact keys, finite values, probability bounds and distribution totals, then computes the highest-probability choice and weighted rubric score itself. Rubric legends always come from the configured rubric. These models' probabilities and confidence values are **generated estimates**, not calibrated accuracy; results show this distinction. Native Decisions and local Decider outputs retain their distribution semantics. Provider identity, connection ID, model, token usage and raw successful provider response accompany saved results. Malformed, truncated, refused and safety-blocked responses fail without saving an analysis.

The response parser is bounded to 8 MiB. Requests have a timeout covering response reading. Provider error bodies and credentials are not returned to the browser or written into error records. There are no automatic inference POST retries or provider fallbacks: timeouts can leave a remotely processing/charged request. Queue retries are explicit, retain the original model parameters and obey a minimum one-minute cooldown (up to 15 minutes for provider `Retry-After`). The existing successful-response checkpoint avoids calling the provider again when only database persistence needs retrying.

## Persistence and access

`config/model-connections.json` is server-only, excluded from Git and atomically written with owner-only file permissions (`0600`). It contains saved keys in plaintext; use environment credentials if you do not want keys persisted in that file. Back up and restrict the host accordingly. API responses contain only credential presence/source, never key values. The server does not place keys in jobs, analysis metadata or browser storage. Jobs accepted before this feature continue using the original local Decider. New queued jobs persist a secret-free model/parameter snapshot; execution resolves the latest credential for that connection so rotation works. Removing a connection prevents unfinished jobs using it from executing until the connection is restored.

This is the existing loopback workspace application, with admin protection specifically for model management; it is not a multi-tenant authentication system. Active-model selection is shared across local users. Do not expose it publicly without a broader authentication and authorization layer.

## API surface

- `GET /api/models`: public sanitized catalog and admin session state.
- `POST /api/models/active`: `{ "id": "connection-id" }` selects an enabled, configured connection.
- `POST /api/admin/session`: `{ "token": "..." }`; `DELETE` logs out.
- `PUT /api/admin/models/:id`: `{ "profile": { ... }, "apiKey": "..." }`; omit key to preserve, use `null` to clear. Provider is immutable for an existing ID.
- `DELETE /api/admin/models/:id`: remove an inactive connection.
- `POST /api/admin/models/:id/test`: metadata/health test using saved parameters.

## Validation

`tests/models.test.ts` exercises mocked official request/response contracts for all four hosted APIs, normalization of all dimension types, malformed/refused/truncated output, error redaction, cooldowns, private storage, key rotation, environment fallback, parameter/origin validation and admin sessions. These deterministic checks do not establish live provider reliability, calibration, hiring fairness or model access. Live inference requires your own credentials and a deliberate evaluation run.
