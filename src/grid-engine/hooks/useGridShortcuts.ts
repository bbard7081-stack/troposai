import { useEffect, useState } from 'react';

interface UseGridShortcutsProps {
    rowIds: string[];
    onSelectRow: (id: string | null) => void;
    onOpenProfile: (id: string) => void;
    onTogglePeek: (id: string, state: boolean) => void;
    onFocusSearch: () => void;
    onToggleViews: () => void;
    onToggleFilters: () => void;
}

export const useGridShortcuts = ({
    rowIds,
    onSelectRow,
    onOpenProfile,
    onTogglePeek,
    onFocusSearch,
    onToggleViews,
    onToggleFilters
}: UseGridShortcutsProps) => {
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                if (e.key === 'Escape') {
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'arrowdown':
                    e.preventDefault();
                    setActiveIndex(prev => {
                        const next = Math.min(prev + 1, rowIds.length - 1);
                        onSelectRow(rowIds[next]);
                        return next;
                    });
                    break;
                case 'arrowup':
                    e.preventDefault();
                    setActiveIndex(prev => {
                        const next = Math.max(prev - 1, 0);
                        onSelectRow(rowIds[next]);
                        return next;
                    });
                    break;
                case 'enter':
                    if (activeIndex >= 0) {
                        onOpenProfile(rowIds[activeIndex]);
                    }
                    break;
                case 'a':
                    if (activeIndex >= 0) {
                        onTogglePeek(rowIds[activeIndex], true);
                    }
                    break;
                case 'f':
                    onToggleFilters();
                    break;
                case 'v':
                    onToggleViews();
                    break;
                case '/':
                    e.preventDefault();
                    onFocusSearch();
                    break;
                case 'escape':
                    onTogglePeek('', false);
                    setActiveIndex(-1);
                    onSelectRow(null);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [rowIds, activeIndex, onSelectRow, onOpenProfile, onTogglePeek, onFocusSearch, onToggleViews, onToggleFilters]);

    return { activeIndex };
};
