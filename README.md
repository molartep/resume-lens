# Resume Lens

A local portfolio application for AI-assisted resume review. Separate screening dimensions, model distributions, and parsed evidence help a human reviewer interpret a resume. There is no overall candidate score, candidate ranking, or automatic employment decision.

## Prerequisites and quick start

- Node.js 22.12+ (Node 24 supported), npm, and internet access for LlamaCloud parsing.
- A LlamaCloud API key with parsing access and available credits.
- Your existing Strands Decider server, separately managed at `http://127.0.0.1:1209`, serving `StrandsAgents/strands-decider-2B-hobson-v19`.
- SQLite requires no server. Prisma and its local engine are installed by npm.

```sh
cp .env.example .env
# Edit .env and set LLAMAINDEX_API_KEY.
npm install
npx prisma migrate dev
npm run check:decider
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Express listens on port 3000. Vite proxies `/api` to Express. If changing `PORT`, also change the proxy target in `client/vite.config.ts`.

The install hook generates Prisma Client and creates an empty `prisma/dev.db` only if absent. It never overwrites an existing database. The committed initial migration creates the tables. `.env`, database files, and uploaded resumes are excluded from version control.

## LlamaIndex configuration

The integration uses the official LlamaParse v2 HTTP API, verified against:

- [Upload file](https://developers.llamaindex.ai/reference/resources/files/methods/create/): multipart `POST /api/v1/beta/files`, `purpose=parse`, PDF file. Returns `id`.
- [Create parse job](https://developers.llamaindex.ai/reference/resources/parsing/methods/create/): JSON `POST /api/v2/parse` with `file_id`, `tier=agentic`, `version=latest`.
- [Get parse job](https://developers.llamaindex.ai/reference/resources/parsing/methods/get/): `GET /api/v2/parse/{id}?expand=markdown`. Reads `job.status` and `markdown.pages[].markdown`. Failed pages cause an error rather than an incomplete screening.
- [Delete file](https://developers.llamaindex.ai/reference/resources/files/methods/delete/) and [delete parse job](https://developers.llamaindex.ai/reference/resources/parsing/methods/delete/): best-effort cleanup after completion or failure.

Set `LLAMAINDEX_API_KEY` server-side and `LLAMAINDEX_API_URL=https://api.cloud.llamaindex.ai` (or the official regional host). The base URL does not include `/api`. HTTPS is required and redirects are rejected. Optional project/organization IDs are sent as documented query parameters. No extractor ID is needed: this application parses rather than running the separate Extract API.

LlamaIndex status “Configured” checks required environment values; it is not an authenticated live connectivity check. Actual credential, quota, and parsing errors appear when uploading. Parsing can incur LlamaCloud charges. The full PDF is sent to this explicitly configured provider; use synthetic resumes for the portfolio demo. Remote cleanup can fail, and provider retention policies still apply.

## Decider lifecycle

Start or check your existing Decider through your established external process manager before analysis. This application never installs, launches, stops, or loads Decider. Keep exactly one model process, bound to localhost. The Node client only calls `GET /health` and `POST /v1/systemone`.

### Start the existing environment on this Mac

In a separate macOS Terminal (zsh/bash), use the existing installation:

```sh
cd /Users/molartep/Developer/strands-decider
source .venv/bin/activate
strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --host 127.0.0.1 --port 1209
```

Alternatively, skip activation and invoke the environment's executable directly:

```sh
cd /Users/molartep/Developer/strands-decider
./.venv/bin/strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --host 127.0.0.1 --port 1209
```

Use only one of these startup methods. Keep the terminal open while using the app and wait for the model to finish loading. The verified installation selects `mps` automatically for the Mac GPU. This path is specific to the current Mac; adjust it on another machine.

From a second terminal, verify readiness:

```sh
curl --fail http://127.0.0.1:1209/health
```

A ready server returns `"status":"ok"`. The application's `.env` should contain `STRANDS_DECIDER_URL=http://127.0.0.1:1209`. Click **Refresh status** in the app after startup. If port 1209 is already occupied, check the existing server's health instead of starting another model process.

For PowerShell on macOS, replace the activation line with `./.venv/bin/Activate.ps1`; the `strands-decider serve` command is the same.

From the Node application folder, you can also check readiness with:

```sh
npm run check:decider
```

The script checks health before any real analysis. The API also checks health immediately before sending a request. `STRANDS_DECIDER_URL` accepts only `http://127.0.0.1:<port>` so resumes cannot be forwarded to a remote Decider host.

The request/response shapes are based on the official [Decider schema](https://github.com/strands-labs/strands-decider/blob/main/src/strands_decider/schema.py) and [server](https://github.com/strands-labs/strands-decider/blob/main/src/strands_decider/server.py). All dimensions are sent in one request. NOUL retains `noul` as P(true); CHOICE retains `choice`, `probabilities`, `confidence`; SCORE retains expected `score`, ordered `legend`, `probabilities`, and `confidence`. Raw output, usage and latency are saved without thresholding or explanation generation.

`DECIDER_TIMEOUT_MS` defaults to 120 seconds. An HTTP timeout does not cancel inference in the external process; wait before retrying. The app serializes processing calls to avoid overlapping normal UI requests. The server has a finite context window (4096 tokens in the verified local health response). Its default behavior can truncate long state or questions. Keep reviewed evidence concise and preserve relevant professional details. For stronger guarantees, configure strict-window behavior through your external Decider management; the app does not change its launch flags. The UI exposes raw usage but cannot prove that no truncation occurred.

## Workflow and product boundary

1. Choose/drop a single PDF. Filename and size appear immediately. The backend validates extension, MIME type, magic header, non-empty content, and a 10 MB limit.
2. LlamaIndex extracts the resume into markdown. After successful parsing, the PDF and extracted text are saved locally, and the upload buffer is released. New Analysis offers **Upload new PDF** or **Use saved PDF**. Selecting a saved PDF loads its extraction without calling LlamaIndex again. Review confirmation is required for every new analysis.
3. Review the extracted text and edit **professional evidence** before clicking **Analyze Candidate**. This deliberate review step implements the demographic boundary instead of forwarding the full resume blindly. Suggestions start with the full parsed resume, removing an opening name/contact block when contact markers identify it, and complete sections labeled as personal/contact information or sensitive personal details. Markdown heading levels determine section boundaries; recognized plain-text headings also act as boundaries. Other content, including unfamiliar professional sections and project links, is preserved. This is not reliable automatic de-identification: inline personal disclosures, unusual headings, and locations can remain and must be reviewed. Saved PDFs also generate fresh suggestions from their full stored extraction when reused; historical analyses are unchanged.
4. Remove names, contacts, photos, addresses, age, nationality and all sensitive personal disclosures. Keep professional dates, experience, project descriptions, technologies, education, certifications and contributions. Confirm the review checkbox. Explicit sensitive-field detection is a backstop, not a guarantee. Developer configuration and reviewer input are trusted and must respect the boundary.
5. Decider evaluates all configured questions together. The candidate and analysis are saved atomically in SQLite after success.
6. Explore individual distributions and source evidence. Each dimension says “Review resume evidence”; there is no fabricated reason or exact decision-to-evidence attribution.
7. Use Candidates to reopen history. “Analyze another resume” on a candidate adds an analysis to that specific record. People are never automatically merged using filenames or inferred identity.

The required display name is entered by the reviewer and stored locally; it is never sent to Decider. Email and phone fields exist in the schema but are not extracted or populated in this version. The unmodified parsed text is retained locally for auditing extraction, along with the exact reviewed evidence sent to Decider. Do not use protected or sensitive attributes as criteria. The built-in configuration guard blocks common prohibited screening terms, but it cannot certify arbitrary configuration or text. This portfolio demo depends on responsible human review and is not a production hiring system.

## Screening configuration

Edit `config/screening.config.ts` and restart the server (development watch restarts automatically). Add/remove internal IDs or edit instructions/criteria without changing service code. `shared/types.ts` defines the discriminated configuration types.

Each dimension has `label`, numeric `order`, `type`, and `instructions` (string or structured object). CHOICE has 2–255 named criteria (subject to your model's own limits); SCORE has 2–10 ordered string levels; NOUL accepts optional `true`/`false` descriptions. Optional `categoryLabels` changes UI labels separately from internal option IDs. No NOUL thresholds are configured; probabilities remain probabilities.

`{{CURRENT_DATE}}` is replaced recursively server-side immediately before submission, using `APP_TIMEZONE` (default America/New_York). Configuration validation fails safely for malformed schemas and prohibited criteria. Every successful analysis stores the **resolved** configuration, labels and ordering. Historical displays use their snapshot, not today's configuration. Candidate-list talent profile is an optional view of the `primary_talent_profile` dimension; removing it results in a dash.

Expected SCORE values are indices in the ordered rubric, **not literal years**. The UI shows all criteria and distributions. CHOICE confidence differs from the highest category probability. NOUL has no separate confidence field in the API. Results are claims about resume evidence, not verified capabilities; absence of evidence may reflect omissions in a resume.

## Persistence and architecture

```text
client/                   React dashboard and Vite
config/screening.config.ts Developer-controlled screening dimensions
shared/types.ts           Shared configuration and presentation contracts
server/routes/api.ts      Upload, review-draft, analysis, history and health routes
server/services/          Isolated LlamaIndex and Decider clients, normalization, validation
server/repositories/      Prisma access and transactional persistence
prisma/schema.prisma      Candidate -> many ResumeAnalysis records
prisma/migrations/        Initial SQLite migration
scripts/                  Decider health check and safe SQLite file preparation
tests/                    Unit, mocked application, and real SQLite persistence tests
```

Pipeline: PDF → LlamaParse → normalization → professional-evidence review → single Decider request → transactional SQLite save → dashboard.

`DATABASE_URL="file:./dev.db"` is relative to `prisma/schema.prisma`, so data lives at `prisma/dev.db`. UUID primary keys identify candidates, analyses and parsed resume documents. The `ResumeDocument` table stores each filename, PDF key, parsed text and parser metadata independently of screening results. Analyses store parsed text, reviewed evidence, raw screening JSON, resolved config JSON, parser job/page metadata, timestamp, Decider latency, original filename and the saved PDF key. API keys are never stored. Repository factories encapsulate Prisma queries. A failed analysis produces no partial candidate/analysis record; its successfully parsed resume remains reusable. Saved PDFs from earlier analyses are added to the document library by the migration. Selecting an assigned PDF pre-fills its candidate display name and adds the next analysis to that candidate’s history; unassigned PDFs require a display name. Every analysis uses current screening settings and preserves a fresh configuration snapshot.

Short-lived review tokens stay in memory for 20 minutes (at most 10 drafts). Restart clears these tokens, but saved PDF documents and extracted text remain available in the picker. PDFs are briefly staged in `storage/resumes/.drafts/` while the parsed document is saved. Abandoned staging files are cleaned after one hour. Successfully parsed PDFs are retained in `storage/resumes/`, even before their first analysis, with UUID filenames and restrictive file permissions. The Resume evidence section renders the original PDF locally using [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/), with page controls and open/download links. The worker and library are bundled with the app; PDFs are never sent to a document viewer service. Only one page is rendered at a time, with bounded canvas dimensions to limit memory use. Each historical analysis references its original saved PDF. Reusing a PDF shares the same local file without extra copies. Older analyses show a fallback message because their original PDFs were not saved. Back up both `prisma/dev.db` and `storage/resumes/` together. The storage folder is excluded from version control; files are served only through an analysis-ID API route. The app has no authentication and binds only to `127.0.0.1`. Cross-origin writes are rejected, API responses use `no-store`, filenames are sanitized, React displays text without interpreting resume HTML, and errors never include full resumes or credentials. Do not expose this demo to a network. SQLite records are local and unencrypted; control access to the workspace and avoid retaining real candidate data unnecessarily.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Parser configuration, Decider and database status |
| GET | `/api/config` | Validated dimensions, no secrets |
| GET | `/api/candidates` | Candidates in latest-update order (not a merit ranking) |
| GET | `/api/candidates/:id` | Candidate metadata |
| GET | `/api/candidates/:id/analyses` | Full analysis history with original snapshots |
| GET | `/api/resumes` | Previously parsed PDFs with filename, saved date and associated candidate, when available |
| POST | `/api/resumes/:id/reuse` | Create a fresh review draft from saved extraction; no parser request |
| GET | `/api/analyses/:id/resume` | Original PDF, inline by default; `?download=1` downloads it |
| POST | `/api/resumes/parse` | Multipart `resume` PDF; returns token, parsed text and suggested evidence |
| POST | `/api/resumes/analyze` | JSON `{token,evidence,reviewed:true,name,candidateId?}`; returns candidate, parsedResume, screening, analysis and metadata |

The two-step API deliberately separates parsing and reviewed screening. A draft token is required; callers cannot submit an arbitrary filename and claim it was parsed. Review is required even if calling the API directly. Errors have `{error:{code,message}}`. Offline services, invalid PDF, size limits, malformed config, empty/partial parse, timeout, invalid model output and database failures are handled. Server logs retain technical categories/statuses rather than resume contents.

## Development and validation

```sh
npm test                 # mocks external services; actual temporary SQLite DB for persistence
npm run build            # TypeScript, Vite client, bundled Express entry
npm start                # production build on http://127.0.0.1:3000
npm run prisma:migrate
npm run prisma:studio
```

Tests cover config validation, dynamic requests, date/timezone substitution, NOUL/CHOICE/SCORE validation, raw output preservation, parser contract/cleanup, review requirements, file validation, cross-origin writes, offline/timeout handling, candidate persistence, configuration history and atomic rollback. Test databases are temporary and removed afterward. No automated test sends a real resume externally or starts another model process.

Assumptions: LlamaCloud account access is supplied by the developer; its `latest` parser version may change. The Decider process is already managed externally. Human-reviewed text is required because heuristic redaction cannot enforce arbitrary personal-information removal. No authentication, queues, containers, cloud deployment or extra services are included.

## Settings tab

Use **Settings** in the sidebar to edit LlamaParse tier (`fast`, `cost_effective`, `agentic`, `agentic_plus`), parser version, extraction instructions, cache bypass, parsing timeout and polling interval. Fast parsing is rule-based, so custom instructions are omitted for that tier. Dated versions must be supported by the chosen tier; unsupported combinations are reported by LlamaIndex when parsing.

Settings also includes Decider analysis/health timeouts, PDF size limits (1–20 MB), parsed draft expiry (1–60 minutes), pending draft limits (1–20), the date-resolution timezone, while the separate Screening Dimensions tab configures questions, criteria, labels, ordering and review thresholds. Click **Save settings** to apply changes. Saves are validated and atomic; invalid input leaves the previous settings intact. Settings cannot be saved during a resume operation. Existing drafts keep their original expiry, and historical analyses retain their screening snapshot and parser metadata.

Settings are stored locally in `config/runtime.settings.json`, excluded from version control, with no API keys. Before the first save, defaults come from `config/screening.config.ts` and the existing timeout/timezone environment variables. After a save, the local settings file controls these runtime parameters. Editing the default screening config file then affects only workspaces without saved overrides; edit saved dimensions through Screening Dimensions. Restarting the app preserves saved settings. To restore developer defaults, move the local settings file aside and reload Settings.

Service URLs, API credentials, project/organization IDs, backend port and database location remain in `.env`. Their configuration status is shown read-only in Settings, and the API key is never returned. Changing `.env` requires restarting Node. Decider model/process settings remain under your external process manager; Settings does not launch or modify the model server. Fixed source-only parsing instructions and the human evidence review requirement remain in place.

`GET /api/settings` returns current runtime settings and sanitized environment status. `PUT /api/settings` validates and saves the full runtime settings object. As with all local admin features in this demo, there is no authentication; keep the application bound to localhost.

## Screening Dimensions and manual review thresholds

**Screening Dimensions** provides a form editor for display labels, question types, instructions, optional NOUL descriptions, choice categories and labels, and score levels. Internal dimension IDs are generated from display labels: lowercase, remove special characters, and replace spaces with underscores. Collisions receive numeric suffixes. Drag dimensions to change their display order; drag score cards to rearrange levels. Arrow buttons provide a keyboard-accessible alternative. A small grey advanced control at the end of each dimension expands the JSON editor; IDs and display order are calculated automatically. Changes remain drafts until **Save dimensions**. The dedicated `PUT /api/config` route validates dimensions and preserves unrelated runtime settings. Renaming a label changes its ID for future analyses; saved analyses retain their original snapshots.

Each dimension can enable its own manual-review threshold. Select a metric, below/above comparison, and threshold. NOUL supports Yes probability. CHOICE supports highest category probability, a specific category probability, or model confidence. SCORE supports expected level index or confidence. Probability/confidence controls use percentages; score controls use the rubric's zero-based index. Only values strictly below/above are flagged, not equality. Thresholds start disabled until explicitly configured; no employment criteria or cutoffs are assumed.

Candidate analysis cards show a red **Manual review needed** warning when the applicable threshold is violated. The warning shows the actual value, threshold and source as application interpretation. It never changes the raw model output, hides distributions, assigns an overall score or makes an employment decision. Threshold configuration is saved with every new analysis and is never sent to Decider.

For previously saved analyses, current thresholds apply immediately only when internal ID, type, instructions and criteria match the saved model-facing definition (with CURRENT_DATE resolution allowed). Label/order changes do not change the rubric. Otherwise, the threshold stored in that analysis is used. Cards identify the source. Older analyses without a compatible current rule or saved threshold have no automatic flag. Editing questions or criteria therefore cannot silently reinterpret a historical result against a different rubric.
