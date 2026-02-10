
// Verification script for GridEngine Step 6
import { GridEngine } from './src/grid-engine/GridEngine.ts';

const mockRows = [{ id: '1', name: 'Original' }];
const newRows = [{ id: '1', name: 'Hydrated' }];

console.log('--- Step 6: Hydration Guard Verification ---');
const engine = new GridEngine([], []);

// Test 1: Update before hydration
console.log('Test 1: updateCell before hydration (should warn)');
engine.updateCell('1', 'name', 'Fail');

// Test 2: Hydrate once
console.log('Test 2: hydrateOnce');
engine.hydrateOnce(newRows as any);
console.log('Snapshot after hydration:', JSON.stringify(engine.getSnapshot()));

// Test 3: Hydrate again (should warn/ignore)
console.log('Test 3: hydrateOnce again (should warn)');
engine.hydrateOnce([{ id: '1', name: 'Second Hydration' }] as any);
console.log('Snapshot after second hydration attempt:', JSON.stringify(engine.getSnapshot()));

if (engine.getSnapshot()[0].name === 'Hydrated') {
    console.log('✅ HYDRATION GUARD VERIFIED');
} else {
    console.log('❌ HYDRATION GUARD FAILED');
}
