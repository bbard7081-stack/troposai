
export type GridRow = {
    id: string;
    [key: string]: any;
};

export type GridColumn = {
    id: string;
    type: 'text' | 'number' | 'dropdown' | 'date';
    visible?: boolean;
    width?: number;
    locked?: boolean;
};

export enum GridLayer {
    OPERATOR = 1, // Calm, minimal, fast
    POWER = 2,    // Show/hide, reorder, multi-sort
    ADVANCED = 3, // Rule-based, permissions
    INTELLIGENCE = 4 // Predictive, behavior-aware
}

export type SavedView = {
    id: string;
    name: string;
    columns: string[]; // Order and visibility
    filters: any[];
    sorts: any[];
};

export class GridEngine {
    private rows: GridRow[];
    private columns: GridColumn[];
    private listeners: Set<(rows: GridRow[]) => void> = new Set();
    private saveQueue: Array<{ rowId: string, columnId: string, value: any }> = [];
    private hasHydrated = false;
    private sourceLog: Array<{ timestamp: string, rowId: string, updates: Partial<GridRow>, source: string }> = [];
    private pastStates: GridRow[][] = [];
    private futureStates: GridRow[][] = [];
    private currentLayer: GridLayer = GridLayer.OPERATOR;
    private savedViews: SavedView[] = [];
    private activeViewId: string | null = null;
    private readonly MAX_HISTORY = 50;

    constructor(rows: GridRow[], columns: GridColumn[]) {
        this.rows = [...rows];
        this.columns = [...columns];
    }

    /**
     * Hydrates the engine with initial data.
     * Can only be called once.
     */
    hydrateOnce(rows: GridRow[]): void {
        if (this.hasHydrated) {
            console.warn('[GridEngine] hydrateOnce called more than once. Ignoring.');
            return;
        }
        this.rows = [...rows];
        this.hasHydrated = true;
        console.log('[GridEngine] Hydrated with', rows.length, 'rows.');
        this.notifySubscribers();
    }

    /**
     * Returns a snapshot of the current rows.
     */
    getSnapshot(): GridRow[] {
        return this.rows;
    }

    /**
     * Internal helper to push current state to history.
     */
    private pushToHistory(): void {
        // We push a shallow copy of the array. 
        // Since our mutations always create new row objects, this preserves structural snapshots.
        this.pastStates.push([...this.rows]);
        if (this.pastStates.length > this.MAX_HISTORY) {
            this.pastStates.shift();
        }
        // New actions clear the redo stack
        this.futureStates = [];
    }

    /**
     * Returns the current save queue and clears it.
     */
    getAndClearQueue() {
        const queue = [...this.saveQueue];
        this.saveQueue = [];
        return queue;
    }

    /**
     * @deprecated Use updateContact(rowId, { [columnId]: value }, source) instead for external calls.
     * This remains for backward compatibility but routes through updateContact.
     */
    updateCell(rowId: string, columnId: string, value: any): void {
        this.updateContact(rowId, { [columnId]: value }, 'system');
    }

    /**
     * The authoritative entry point for all contact mutations.
     * @param rowId The ID of the contact to update.
     * @param partialUpdate An object containing the fields to update.
     * @param source The origin of the update for audit logging.
     */
    updateContact(rowId: string, partialUpdate: Partial<GridRow>, source: 'grid' | 'profile' | 'call' | 'system'): void {
        if (!this.hasHydrated) {
            console.warn(`[GridEngine][Source: ${source}] updateContact called before hydration.`);
        }

        console.log(`[GridEngine][Source: ${source}] Updating contact ${rowId}:`, partialUpdate);

        // Audit logging
        this.sourceLog.push({
            timestamp: new Date().toISOString(),
            rowId,
            updates: partialUpdate,
            source
        });

        let changed = false;
        const nextRows = this.rows.map(row => {
            if (row.id === rowId) {
                const updatesToApply: any = {};
                let rowUpdated = false;

                for (const [key, value] of Object.entries(partialUpdate)) {
                    if (row[key] !== value) {
                        updatesToApply[key] = value;
                        rowUpdated = true;
                        changed = true;
                        // Queue for backend sync
                        this.saveQueue.push({ rowId, columnId: key, value });
                    }
                }

                if (rowUpdated) {
                    return { ...row, ...updatesToApply };
                }
                return row;
            }
            return row;
        });

        if (changed) {
            this.pushToHistory();
            this.rows = nextRows;
            this.notifySubscribers();
        }
    }

    /**
     * Reverts to the previous state in history.
     */
    undo(): void {
        if (!this.canUndo) {
            console.log('[GridEngine] Nothing to undo.');
            return;
        }

        const currentSnapshot = [...this.rows];
        const previousSnapshot = this.pastStates.pop()!;

        // Push current to redo stack
        this.futureStates.push(currentSnapshot);

        // Sync changes back to backend
        this.calculateAndQueueDiffs(currentSnapshot, previousSnapshot);

        this.rows = previousSnapshot;
        console.log(`[GridEngine] Undo performed. ${this.pastStates.length} states remaining in history.`);
        this.notifySubscribers();
    }

    /**
     * Reapplies a state from the redo stack.
     */
    redo(): void {
        if (!this.canRedo) {
            console.log('[GridEngine] Nothing to redo.');
            return;
        }

        const currentSnapshot = [...this.rows];
        const nextSnapshot = this.futureStates.pop()!;

        // Push current to undo stack
        this.pastStates.push(currentSnapshot);

        // Sync changes back to backend
        this.calculateAndQueueDiffs(currentSnapshot, nextSnapshot);

        this.rows = nextSnapshot;
        console.log(`[GridEngine] Redo performed. ${this.futureStates.length} states remaining in redo stack.`);
        this.notifySubscribers();
    }

    /**
     * Compares two snapshots and queues diffs for backend sync.
     */
    private calculateAndQueueDiffs(from: GridRow[], to: GridRow[]): void {
        to.forEach(toRow => {
            const fromRow = from.find(f => f.id === toRow.id);
            if (!fromRow) return;

            for (const [key, value] of Object.entries(toRow)) {
                if (fromRow[key] !== value) {
                    this.saveQueue.push({ rowId: toRow.id, columnId: key, value });
                    console.log(`[GridEngine][Sync] Queued diff for ${toRow.id}.${key} during history transition`);
                }
            }
        });
    }

    /**
     * @deprecated Use updateBulkContacts instead for external calls.
     */
    bulkUpdate(rowIds: string[], columnId: string, value: any): void {
        this.updateBulkContacts(rowIds, { [columnId]: value }, 'system');
    }

    /**
     * Authoritative entry point for bulk mutations.
     */
    updateBulkContacts(rowIds: string[], partialUpdate: Partial<GridRow>, source: 'grid' | 'system'): void {
        if (!this.hasHydrated) {
            console.warn(`[GridEngine][Source: ${source}] updateBulkContacts called before hydration.`);
        }

        console.log(`[GridEngine][Source: ${source}] Bulk updating ${rowIds.length} contacts:`, partialUpdate);

        const rowIdSet = new Set(rowIds);
        let globalChanged = false;

        const nextRows = this.rows.map(row => {
            if (rowIdSet.has(row.id)) {
                const updatesToApply: any = {};
                let rowUpdated = false;

                for (const [key, value] of Object.entries(partialUpdate)) {
                    if (row[key] !== value) {
                        updatesToApply[key] = value;
                        rowUpdated = true;
                        globalChanged = true;
                        // Queue for backend sync
                        this.saveQueue.push({ rowId: row.id, columnId: key, value });
                    }
                }

                if (rowUpdated) {
                    return { ...row, ...updatesToApply };
                }
            }
            return row;
        });

        if (globalChanged) {
            this.pushToHistory();
            this.rows = nextRows;
            this.notifySubscribers();
        }
    }

    /**
     * Authoritative entry point for adding a new record to the engine state.
     * Records should be validated/normalized by the Ingestion Pipeline before being added here.
     */
    addRow(row: GridRow): void {
        console.log(`[GridEngine] Adding new record: ${row.id}`, row);
        this.pushToHistory();
        this.rows = [row, ...this.rows]; // Add to top of list
        this.notifySubscribers();
    }

    /**
     * Adds a subscriber to state changes.
     * @returns An unsubscribe function.
     */
    subscribe(listener: (rows: GridRow[]) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Returns true if there are states to undo.
     */
    get canUndo(): boolean {
        return this.pastStates.length > 0;
    }

    /**
     * Returns true if there are states to redo.
     */
    get canRedo(): boolean {
        return this.futureStates.length > 0;
    }

    /**
     * Set the current capability layer.
     */
    setLayer(layer: GridLayer): void {
        console.log(`[GridEngine] Switching to Layer ${layer}`);
        this.currentLayer = layer;
        this.notifySubscribers();
    }

    /**
     * Returns the current layer.
     */
    get layer(): GridLayer {
        return this.currentLayer;
    }

    private notifySubscribers(): void {
        this.listeners.forEach(listener => listener(this.rows));
    }
}
