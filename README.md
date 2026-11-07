# WardLens

**Evidence-first, multilingual civic reporting for local infrastructure issues.**

WardLens lets people record or type observations about roads, drainage, standing water, waste, streetlights, and other civic conditions, then inspect source-grounded incident summaries and **possible** connections on an OpenStreetMap map and evidence graph. Suggested links are hypotheses, **not verified causes**.

- Live site: https://awaazgraph.vercel.app/
- Demo video: https://wardlens-demo-2026.vercel.app/
- Project: Gnani AI Great Indian AI Internship Challenge 2026
- This repository tracks the **v0.22.9 voice-reliability candidate**, with bounded per-visitor/site-wide usage feedback and reviewed transcription flow.

## Features

- Explicitly consented voice transcription through a protected server-side Gnani Prisma endpoint; Hindi, Bengali, English, and mixed-language input.
- Voice-note re-recording, a retry button for failed transcription, and fresh transcription when the recording or language changes.
- Typed reporting with conservative relevance filtering, evidence extraction, clarification prompts, and human transcript review.
- Real OpenStreetMap basemap, search by place name, and device-proximity estimates using a **300 m** threshold and GPS accuracy. Missing/uncertain GPS readings are **not proof of location**.
- Report-level evidence inspector and an interactive graph of *unverified* possible relationships.
- Browser-private reports; optional local-device persistence and redacted Markdown export.

## Run locally

This is a small browser-module app. From the repository root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. The map and typed reports can run in the browser. The `/api/voice/transcribe` endpoint requires a server deployment and its **server-only** Gnani credentials; local static serving does not provide live speech-to-text.

## Deploy

The existing Vercel project is `awaazgraph`. Vercel builds this repository with `vercel.json`. To publish a reviewed release, link to the correct Vercel project, test a preview, and only then deploy production. Keep all private tokens in the **Vercel environment** (never source files).

```bash
vercel link --project awaazgraph --scope shubh1s-projects
vercel deploy --scope shubh1s-projects
# After verification and if the deployment quota permits:
vercel deploy --prod --scope shubh1s-projects
```

Do not commit `.env*`, `.vercel/`, recording files, or personal report exports. The GitHub repository is public.

## Important limitations

- Reports, coordinates, transcription, incident categories and possible links are **unverified user-supplied data**, not an official municipal feed.
- GPS proximity is an estimate derived from browser-provided coordinates and accuracy, not proof of physical presence.
- Public place search sends the query string to a third-party geocoder; maps load tiles from OpenStreetMap.
- The separately labelled `/demo/` route contains **fictional tutorial data**, not live incidents.
- Short audio is sent for transcription only with consent; WardLens does not intentionally store audio. The browser keeps reports in memory, or locally if the user chooses.
- This software is a hackathon prototype; do not treat it as emergency or government reporting infrastructure.

## Source notes

The source matches the tested Vercel v0.22.7 preview deployment, including `workspace.js`, `report-scope.js`, `engine.js`, `geo-map.js` and the existing serverless API code. Some legacy package metadata and provenance text retain older version labels. Do not mistake those labels for missing features.

See `DATA_PROVENANCE.txt` and `demo/DATA_PROVENANCE.txt` for further limitations.

## Automated tests and submission

Run the local deterministic tests with **npm test**. They use mocks and do not consume live Gnani credits.

- Release acceptance checklist: docs/RELEASE_ACCEPTANCE.md
- Hackathon rules, submission copy and checklist: docs/GNANI_SUBMISSION.md

A preview must pass checks before any release to the Git-connected production site.
