# Production Stress Test Report

Generated: 2026-08-04T11:11:53.870Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory | PASS | 456 | - |
| S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion | PASS | 25 | - |
| S3 performance: 30 local songs stay fast with 0/200/500 history entries | PASS | 111 | - |
| S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials | PASS | 18439 | - |
| S5 extreme inputs are clamped and never execute script text | PASS | 255 | - |
| S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast | PASS | 3285 | - |
| S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo | PASS | 1 | - |
| S9 (v3.32) single pack of 80 songs: zero hook/title duplicates, trackNo 1..80 continuous | PASS | 110 | - |
| S8 API failure modes are mocked, retried, recoverable, and key-safe | PASS | 21 | - |


## Opening Sequence Stress Tests (v3.11)

Generated: 2026-08-04T11:11:02.576Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| OS1 long simulation: 18 weeks x 12 songs, every combo either succeeds with correct cold-open/flagship or fails gracefully with the known pool-exhaustion message | PASS | 14628 | - |
| OS2 contest load: k=3 contest runs 500x without crashing, average under 50ms | PASS | 338 | - |
| OS2 contest near pool exhaustion still returns a clear result, no infinite loop | PASS | 27 | - |
| OS3 extreme songCount inputs are clamped and never crash cold-open/flagship assignment | PASS | 416 | - |
| OS3 invalid openingStyle values safely fall back to a concrete resolution | PASS | 1 | - |
| OS3 a channel with no genres/moods selected does not crash dominant-context scoring | PASS | 15 | - |
| OS4 chained promotions (1 -> 2 -> 3, repeated 5x) keep state consistent | PASS | 21 | - |
| OS4 10 consecutive promotions never produce a hook collision | PASS | 21 | - |
| OS5 persona mode + cold-open seed stays within 1000 chars | PASS | 6 | - |
| OS5 batch preallocation assigns cold-open to track 1 and flagship to tracks 2-3 | PASS | 6 | - |
| OS5 batch chunking always puts track 1 (cold-open) in the first sub-batch | PASS | 2 | - |
| OS6 full regression: no crash across every archetype/language combination at pack scale | PASS | 775 | - |
