
// Verification script for GridEngine Step 5
import { GridEngine } from './src/grid-engine/GridEngine.ts';

const mockRows = [
    { id: '1', name: 'John Doe', status: 'Pending' }
];

const mockColumns = [
    { id: 'name', type: 'text' }
];

console.log('--- Step 5: Engine Logic Verification ---');
const engine = new GridEngine(mockRows as any, mockColumns as any);

engine.updateCell('1', 'name', 'Persisted Name');

const queue = engine.getAndClearQueue();
console.log('\n--- Results ---');
console.log('Queue length:', queue.length);
console.log('Queue content:', JSON.stringify(queue[0]));
console.log('Is queue cleared?', engine.getAndClearQueue().length === 0);

if (queue.length === 1 && queue[0].value === 'Persisted Name') {
    console.log('✅ ENGINE LOGIC VERIFIED');
} else {
    console.log('❌ ENGINE LOGIC FAILED');
}
