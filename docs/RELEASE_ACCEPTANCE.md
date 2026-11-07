# WardLens v0.22.9 — Release acceptance

WardLens is an evidence-first civic reporting prototype, **not** an official municipal feed. All reports and relationships remain unverified. The actual live Gnani model is **Prisma v2.5 speech-to-text**. Do not claim Timbre, Evon or real-user audio tests that have not been performed.

## Automated checks

From the repository root run: npm test

The tests use deterministic synthetic text/audio fixtures and mocked Gnani responses. They do not spend Gnani API credits or establish real microphone-to-model performance.

## Manual real-device checks before final submission

1. In Safari/Chrome on an iPhone, open the HTTPS production site, consent to voice transcription and confirm the app shows your own remaining daily attempts and the site-wide cap.
2. Speak an approximately 4-second sentence about a **fictional** blocked drain. Check the returned Gnani text and edit before saving.
3. Speak a different sentence, stopping the microphone after the new clip. Confirm a **new transcription**, not stale content.
4. Temporarily disconnect the network during transcription, then restore it and use Retry for **the same recording**. Check that nothing is automatically saved.
5. A true local quota-limit response must display reset time and offer the typed fallback. The Retry button must not pretend to bypass quota.
6. Check Hindi, Bengali and Hindi-English code-mixed recordings with consent. Preserve negation and place descriptions in the reviewed text.
7. Verify the 300 m proximity indicator includes GPS accuracy. When location permission is denied, the map may center on Delhi but must never assert Delhi as the user's real report pin.
8. Save two **fictional** nearby civic observations, inspect graph links and exact quotes. A possible relation is not proof of causation.
9. Enter unrelated food compliments. Verify the scope checker redirects rather than inventing an incident.
10. Export a redacted brief and confirm that exact personal coordinates and raw report data are not disclosed.

## Safeguards and quota policy

- Client quota: **4** server-side attempts per UTC day.
- Site-wide quota: **40** server-side attempts per UTC day.
- Valid voice requests reserve quota atomically *before* calling Gnani; failed upstream requests may consume one attempt.
- Browser displays remaining attempts returned by the backend; raw IP and API keys are never sent to the browser.
- Local daily-limit HTTP 429 includes Retry-After, reset timestamp and a machine-readable code.
- Upstream Gnani rate-limit responses are distinguished from recoverable failures.
- This is an intentionally bounded demonstration, not unlimited transcription infrastructure.

## Release discipline

Develop on reviewed branches and test previews. The GitHub main branch is linked to the Vercel production project, so merging to main may trigger a production build. Never remove abuse or consent safeguards to mask errors.
