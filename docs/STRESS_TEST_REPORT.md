# Production Stress Test Report

Generated: 2026-07-14T21:59:43.800Z

| 시나리오 | 결과 | 소요시간(ms) | 비고 |
|---|---:|---:|---|
| S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory | PASS | 387 | - |
| S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion | PASS | 30 | - |
| S3 performance: 30 local songs stay fast with 0/200/500 history entries | PASS | 34 | - |
| S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials | PASS | 3541 | - |
| S5 extreme inputs are clamped and never execute script text | PASS | 35 | - |
| S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast | PASS | 910 | - |
| S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo | PASS | 1 | - |
| S8 API failure modes are mocked, retried, recoverable, and key-safe | PASS | 30 | - |
