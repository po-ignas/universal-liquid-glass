# Benchmark

## Automated checks completed

Environment: macOS workspace, Node 24.9.0, npm 11.6.0.

| Check | Result |
|---|---|
| Strict TypeScript | pass |
| Unit tests | 2/2 pass |
| Production demo build | pass |
| npm audit | 0 vulnerabilities |
| Production demo bundle | 428.86 kB JS / 119.63 kB gzip (includes React and DOM capture dependency) |

## Browser performance procedure

Run `npm run demo`, open `http://127.0.0.1:5173/?debug=1`, and record the overlay after each case:

1. Idle for 10 seconds: capture count must stop changing except for the demo's deliberate 2.4-second DOM update.
2. Normal scroll for 10 seconds: confirm passive responsive scrolling, throttled capture count, and a final settled capture.
3. Fast scroll end-to-end three times: record worst capture duration and final tier.
4. Resize continuously for five seconds: confirm no capture storm and one final settled capture.
5. Let the demo DOM-update ticker run for 30 seconds: confirm one coalesced capture per update and stable texture dimensions.
6. In browser task manager/devtools, compare memory before and after five minutes; same-sized uploads should not repeatedly allocate GPU texture storage.

The repository environment did not expose its Chrome automation connection during this implementation pass. Browser FPS, capture time, scroll feel, screenshots, and cross-engine results are therefore intentionally not fabricated and remain to be filled in after an interactive Chrome/Safari/Firefox run.
