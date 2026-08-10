# Production Stress Test Report

Generated: 2026-08-10T08:29:22.348Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory | PASS | 637 | - |
| S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion | PASS | 29 | - |
| S3 performance: 30 local songs stay fast with 0/200/500 history entries | PASS | 179 | - |
| S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials | PASS | 29680 | - |
| S5 extreme inputs are clamped and never execute script text | PASS | 361 | - |
| S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast | PASS | 4976 | - |
| S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo | PASS | 4 | - |
| S9 (v3.32) single pack of 80 songs: zero hook/title duplicates, trackNo 1..80 continuous | PASS | 144 | - |
| S8 API failure modes are mocked, retried, recoverable, and key-safe | PASS | 24 | - |


## Opening Sequence Stress Tests (v3.11)

Generated: 2026-08-10T08:28:54.195Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| OS1 long simulation: 18 weeks x 12 songs, every combo either succeeds with correct cold-open/flagship or fails gracefully with the known pool-exhaustion message | PASS | 6369 | - |
| OS2 contest load: k=3 contest runs 500x without crashing, average under 50ms | PASS | 205 | - |
| OS2 contest near pool exhaustion still returns a clear result, no infinite loop | PASS | 20 | - |
| OS3 extreme songCount inputs are clamped and never crash cold-open/flagship assignment | PASS | 409 | - |
| OS3 invalid openingStyle values safely fall back to a concrete resolution | PASS | 1 | - |
| OS3 a channel with no genres/moods selected does not crash dominant-context scoring | PASS | 14 | - |
| OS4 chained promotions (1 -> 2 -> 3, repeated 5x) keep state consistent | PASS | 30 | - |
| OS4 10 consecutive promotions never produce a hook collision | PASS | 22 | - |
| OS5 persona mode + cold-open seed stays within 1000 chars | PASS | 6 | - |
| OS5 batch preallocation assigns cold-open to track 1 and flagship to tracks 2-3 | PASS | 6 | - |
| OS5 batch chunking always puts track 1 (cold-open) in the first sub-batch | PASS | 1 | - |
| OS6 full regression: no crash across every archetype/language combination at pack scale | PASS | 700 | - |
