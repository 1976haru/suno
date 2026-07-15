# Production Stress Test Report

Generated: 2026-07-15T21:54:53.214Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory | PASS | 571 | - |
| S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion | PASS | 68 | - |
| S3 performance: 30 local songs stay fast with 0/200/500 history entries | PASS | 78 | - |
| S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials | PASS | 4790 | - |
| S5 extreme inputs are clamped and never execute script text | PASS | 37 | - |
| S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast | PASS | 938 | - |
| S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo | PASS | 1 | - |
| S8 API failure modes are mocked, retried, recoverable, and key-safe | PASS | 46 | - |


## Opening Sequence Stress Tests (v3.11)

Generated: 2026-07-15T21:54:50.585Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| OS1 long simulation: 18 weeks x 12 songs, every combo either succeeds with correct cold-open/flagship or fails gracefully with the known pool-exhaustion message | PASS | 2623 | - |
| OS2 contest load: k=3 contest runs 500x without crashing, average under 50ms | PASS | 200 | - |
| OS2 contest near pool exhaustion still returns a clear result, no infinite loop | PASS | 17 | - |
| OS3 extreme songCount inputs are clamped and never crash cold-open/flagship assignment | PASS | 40 | - |
| OS3 invalid openingStyle values safely fall back to a concrete resolution | PASS | 1 | - |
| OS3 a channel with no genres/moods selected does not crash dominant-context scoring | PASS | 3 | - |
| OS4 chained promotions (1 -> 2 -> 3, repeated 5x) keep state consistent | PASS | 5 | - |
| OS4 10 consecutive promotions never produce a hook collision | PASS | 4 | - |
| OS5 persona mode + cold-open seed stays within 1000 chars | PASS | 2 | - |
| OS5 batch preallocation assigns cold-open to track 1 and flagship to tracks 2-3 | PASS | 1 | - |
| OS5 batch chunking always puts track 1 (cold-open) in the first sub-batch | PASS | 1 | - |
| OS6 full regression: no crash across every archetype/language combination at pack scale | PASS | 206 | - |
