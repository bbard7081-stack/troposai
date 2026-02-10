
// Verification script for GridEngine Step 4
import { GridEngine } from './src/grid-engine/GridEngine.ts';

const mockRows = [
    { id: '1', name: 'John Doe', status: 'Pending' }
];

const mockColumns = [
    { id: 'name', type: 'text' }
];

console.log('--- Step 4: Verification ---');
const engine = new GridEngine(mockRows as any, mockColumns as any);

const initialSnapshot = engine.getSnapshot();

// Capture console.log output
const originalLog = console.log;
let logFound = false;
console.log = (...args) => {
    if (args[0] === '[GridEngine] Cell updated') {
        logFound = true;
    }
    originalLog(...args);
};

engine.updateCell('1', 'name', 'Antigravity');

const updatedSnapshot = engine.getSnapshot();

console.log('\n--- Results ---');
console.log('Logging detected:', logFound);
console.log('Value updated:', updatedSnapshot[0].name === 'Antigravity');
console.log('Snapshot is immutable:', initialSnapshot !== updatedSnapshot);

console.log = originalLog;
