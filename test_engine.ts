
// Verification script for GridEngine
import { GridEngine } from './src/grid-engine/GridEngine.ts';

const mockRows = [
    { id: '1', name: 'John Doe', status: 'Pending' },
    { id: '2', name: 'Jane Smith', status: 'Active' }
];

const mockColumns = [
    { id: 'name', type: 'text' },
    { id: 'status', type: 'text' }
];

console.log('--- Initializing GridEngine ---');
const engine = new GridEngine(mockRows as any, mockColumns as any);

engine.subscribe((rows) => {
    console.log('Listener fired! Current rows count:', rows.length);
    console.log('Row 1 status:', rows.find(r => r.id === '1')?.status);
});

console.log('\n--- Test 1: Update single cell ---');
const initialRows = engine.getSnapshot();
engine.updateCell('1', 'status', 'Approved');

const updatedRows = engine.getSnapshot();
console.log('Is snapshot a new array?', initialRows !== updatedRows);
console.log('Is Row 1 a new object?', initialRows[0] !== updatedRows[0]);
console.log('Is Row 2 the same object?', initialRows[1] === updatedRows[1]);

console.log('\n--- Test 2: Bulk Update ---');
engine.bulkUpdate(['1', '2'], 'status', 'Completed');

console.log('\n--- Verification Finished ---');
