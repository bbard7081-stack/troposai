import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GridEngine, GridRow, GridColumn } from './GridEngine';
import * as api from '../../services/api';

interface GridEngineContextType {
    snapshot: GridRow[];
    engine: GridEngine | null;
    canUndo: boolean;
    canRedo: boolean;
    isSyncing: boolean;
    lastAction: { message: string; timestamp: number } | null;
    undo: () => void;
    redo: () => void;
    createRecord: (data: Partial<GridRow>, source: string) => Promise<GridRow | null>;
    layer: number;
    setLayer: (layer: number) => void;
    conflict: { record: GridRow; message: string } | null;
    clearConflict: () => void;
}

const GridEngineContext = createContext<GridEngineContextType>({
    snapshot: [],
    engine: null,
    getRowById: () => undefined,
    canUndo: false,
    canRedo: false,
    isSyncing: false,
    lastAction: null,
    undo: () => { },
    redo: () => { },
    createRecord: async () => null,
    layer: 1,
    setLayer: () => { },
    conflict: null,
    clearConflict: () => { }
});

export const useGridEngine = () => useContext(GridEngineContext);

interface GridEngineProviderProps {
    initialRows: GridRow[];
    columns: GridColumn[];
    children: React.ReactNode;
}

export const GridEngineProvider: React.FC<GridEngineProviderProps> = ({
    initialRows: _notUsed, // We fetch data once at bootstrap now
    columns,
    children,
}) => {
    // Initialize the engine once with empty rows
    const engine = useMemo(() => new GridEngine([], columns), []);

    // Local state for the snapshot to trigger React re-renders
    const [snapshot, setSnapshot] = useState<GridRow[]>(engine.getSnapshot());
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastAction, setLastAction] = useState<{ message: string; timestamp: number } | null>(null);
    const [conflict, setConflict] = useState<{ record: GridRow; message: string } | null>(null);
    const [layer, setLayerState] = useState<number>(engine.layer);

    useEffect(() => {
        // Subscribe to engine changes
        const unsubscribe = engine.subscribe((newRows) => {
            setSnapshot(newRows);
        });

        return () => {
            unsubscribe();
        };
    }, [engine]);

    // Bootstrap Hydration Effect
    useEffect(() => {
        async function bootstrap() {
            try {
                console.log('[GridEngine] Bootstrapping...');
                const rawData = await api.fetchContacts();

                // Normalization: Ensure backend fields match engine expectations
                // Backend currently returns row.crmStatus as crmStatus or filters it.
                // We'll normalize any potential casing differences here.
                const normalized = rawData.map((row: any) => ({
                    ...row,
                    crm_status: row.crmStatus || row.crm_status || 'Disconnected'
                }));

                engine.hydrateOnce(normalized);
            } catch (error) {
                console.error('[GridEngine] Bootstrap failed:', error);
            }
        }
        bootstrap();
    }, [engine]);

    // Debounced Flusher for Backend Sync
    useEffect(() => {
        const queue = engine.getAndClearQueue();
        if (queue.length === 0) return;

        console.log(`[GridEngine] Flushing ${queue.length} changes...`);

        const timeout = setTimeout(async () => {
            setIsSyncing(true);
            // Group changes by rowId to minimize API calls
            const updatesByRow: Record<string, Partial<GridRow>> = {};
            queue.forEach(change => {
                if (!updatesByRow[change.rowId]) {
                    updatesByRow[change.rowId] = {};
                }
                updatesByRow[change.rowId][change.columnId] = change.value;
            });

            // Flush each row's updates
            for (const [rowId, updates] of Object.entries(updatesByRow)) {
                try {
                    await api.updateContact(rowId, updates);
                    console.log(`[GridEngine] Flushed updates for row ${rowId}`, updates);
                } catch (error) {
                    console.error(`[GridEngine] Save failed for row ${rowId}:`, error);
                }
            }
            console.log(`[GridEngine] Flushed ${Object.keys(updatesByRow).length} rows.`);
            setIsSyncing(false);
        }, 1000);

        return () => clearTimeout(timeout);
    }, [snapshot, engine]);

    const getRowById = (rowId: string) => {
        return snapshot.find(r => r.id === rowId);
    };

    const undo = () => {
        engine.undo();
        setLastAction({ message: 'Undo successful', timestamp: Date.now() });
    };

    const redo = () => {
        engine.redo();
        setLastAction({ message: 'Redo successful', timestamp: Date.now() });
    };

    const setLayer = (newLayer: number) => {
        engine.setLayer(newLayer);
        setLayerState(newLayer);
    };

    const clearConflict = () => setConflict(null);

    const createRecord = async (data: Partial<GridRow>, source: string) => {
        setIsSyncing(true);
        setConflict(null);
        try {
            console.log(`[GridEngineProvider] Creating record via Pipeline (Source: ${source})...`);
            const response = await api.createContact(data, source);

            // Check if successful creation
            if (response && response.id) {
                engine.addRow(response);
                setLastAction({ message: `Record Created: ${response.name}`, timestamp: Date.now() });
                return response;
            }
            return null;
        } catch (error: any) {
            console.error('[GridEngineProvider] Creation failed:', error);

            // Handle Spine Conflict (409 Duplicate)
            if (error.status === 409 || (error.response && error.response.status === 409)) {
                const details = error.data || (await error.response?.json()) || {};
                console.warn('[GridEngineProvider] Conflict detected:', details);

                // Fetch the existing record if not provided in conflict details
                // (Optimistically, the Spine might provide the existing record payload in a future update)
                setConflict({
                    record: details.record || { id: details.id, name: 'Existing Contact' },
                    message: details.message || 'A record with this phone or email already exists.'
                });
            } else {
                setLastAction({ message: `Error: ${error.message}`, timestamp: Date.now() });
            }
            return null;
        } finally {
            setIsSyncing(false);
        }
    };

    const value = useMemo(() => ({
        snapshot,
        engine,
        getRowById,
        canUndo: engine.canUndo,
        canRedo: engine.canRedo,
        isSyncing,
        lastAction,
        undo,
        redo,
        createRecord,
        layer,
        setLayer,
        conflict,
        clearConflict
    }), [snapshot, engine, isSyncing, lastAction, layer, conflict]);

    return (
        <GridEngineContext.Provider value={value}>
            {children}
        </GridEngineContext.Provider>
    );
};
