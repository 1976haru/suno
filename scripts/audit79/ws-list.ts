import { workspaceDefinitions } from '../../src/data/workspaces';
for (const w of workspaceDefinitions) console.log(`${w.id} | ${(w as any).labelKo ?? (w as any).nameKo ?? ''} | ${w.archetypeIds.join(',')}`);
