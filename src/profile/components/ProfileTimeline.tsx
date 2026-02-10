import React from 'react';
import { TimelineEvent } from '@/types';

interface ProfileTimelineProps {
    events: TimelineEvent[];
}

export const ProfileTimeline: React.FC<ProfileTimelineProps> = ({ events }) => {
    return (
        <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
            {events.map((event) => (
                <div key={event.id} className="relative pl-10 group">
                    {/* DOT */}
                    <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full bg-white border-4 border-slate-100 flex items-center justify-center z-10 group-hover:border-blue-200 transition-colors" />

                    {/* CONTENT */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                                {event.title}
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-xs text-slate-500 leading-relaxed max-w-lg italic">
                                {event.description}
                            </p>
                        )}
                        <div className="flex items-center space-x-3 text-[9px] font-black uppercase tracking-wider text-slate-300">
                            <span>{event.source}</span>
                            {event.direction && (
                                <span className={`px-1 rounded ${event.direction === 'Inbound' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                    {event.direction}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* END MARKER */}
            <div className="pl-10">
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    End of History
                </div>
            </div>
        </div>
    );
};
