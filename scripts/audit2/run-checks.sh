#!/bin/sh
OUT=scripts/audit2/out
mkdir -p "$OUT"
for c in node reachability gates settings archetype coverage workspace-registration choices version budget genre-overlap consumption genre-completeness vocal-floor vocal-genre-fit concept-coverage concept-language genre-fidelity genre-utilization option-utilization vocal-technique era-palette-conflict concept-vocal-axis vocal-articulation; do
  echo "=== check:$c ==="
  npm run --silent "check:$c" > "$OUT/$c.txt" 2>&1
  echo "exit=$?"
done
