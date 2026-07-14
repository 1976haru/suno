# Production Stress Test Report

Generated: 2026-07-14T22:37:51.918Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory | PASS | 398 | - |
| S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion | PASS | 35 | - |
| S3 performance: 30 local songs stay fast with 0/200/500 history entries | PASS | 39 | - |
| S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials | PASS | 3824 | - |
| S5 extreme inputs are clamped and never execute script text | PASS | 33 | - |
| S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast | PASS | 932 | - |
| S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo | PASS | 1 | - |
| S8 API failure modes are mocked, retried, recoverable, and key-safe | PASS | 32 | - |
