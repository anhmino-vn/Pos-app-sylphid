import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subDays, format } from 'date-fns';
import { useDateFilterStore } from '../store/useDateFilterStore';

export type DateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

interface DateFilterProps {
  onFilterChange?: (range: DateRange) => void;
  className?: string;
}

export function DateFilter({ onFilterChange, className }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { filterType, setFilter } = useDateFilterStore();
  const [customRange, setCustomRange] = useState<DateRange>({ startDate: null, endDate: null });

  const handleRangeSelect = (rangeType: string) => {
    setIsOpen(false);
    
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (rangeType) {
      case 'today':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
        break;
      case 'this_week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'this_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case 'custom':
        if (customRange.startDate && customRange.endDate) {
           startDate = startOfDay(customRange.startDate);
           endDate = endOfDay(customRange.endDate);
        }
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        break;
    }

    if (rangeType === 'all') {
      setFilter('all', { startDate: null, endDate: null });
    } else if (startDate && endDate) {
      setFilter(rangeType as any, { startDate, endDate });
    } else {
      setFilter(rangeType as any, { startDate: now, endDate: now }); // Fallback
    }

    // Call optional callback for legacy support
    if (onFilterChange) {
       onFilterChange({ startDate, endDate });
    }
  };

  const PRESETS = [
    { id: 'today', label: 'Hôm nay' },
    { id: 'yesterday', label: 'Hôm qua' },
    { id: 'this_week', label: 'Tuần này' },
    { id: 'this_month', label: 'Tháng này' },
    { id: 'last_month', label: 'Tháng trước' },
    { id: 'all', label: 'Tất cả thời gian' }
  ];

  const getLabel = () => {
    if (filterType === 'custom') {
      if (customRange.startDate && customRange.endDate) {
        return `${format(customRange.startDate, 'dd/MM/yyyy')} - ${format(customRange.endDate, 'dd/MM/yyyy')}`;
      }
      return 'Tùy chỉnh';
    }
    return PRESETS.find(p => p.id === filterType)?.label || 'Thời gian';
  };

  return (
    <div className={cn("relative z-40", className)}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        {getLabel()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[280px] sm:w-[320px] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden">
          <div className="p-2 space-y-1">
            {PRESETS.map((preset) => (
               <button
                 key={preset.id}
                 onClick={() => handleRangeSelect(preset.id)}
                 className={cn(
                   "w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-50 hover:text-blue-600",
                   filterType === preset.id ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-600"
                 )}
               >
                 {preset.label}
               </button>
            ))}
                        {/* Custom Range */}
            <div className="pt-2 border-t border-slate-100 mt-2 p-2">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tùy chỉnh</p>
               <div className="space-y-2">
                 <input 
                    type="date"
                    className="w-full text-xs p-2 rounded bg-slate-50 border-none outline-none"
                    onChange={e => {
                       const d = e.target.value ? new Date(e.target.value) : null;
                       setCustomRange(prev => ({ ...prev, startDate: d }));
                       if (d && customRange.endDate) {
                           setFilter('custom', { startDate: startOfDay(d), endDate: endOfDay(customRange.endDate) });
                           if (onFilterChange) onFilterChange({ startDate: startOfDay(d), endDate: endOfDay(customRange.endDate) });
                       }
                    }}
                 />
                 <input 
                    type="date"
                    className="w-full text-xs p-2 rounded bg-slate-50 border-none outline-none"
                    onChange={e => {
                       const d = e.target.value ? new Date(e.target.value) : null;
                       setCustomRange(prev => ({ ...prev, endDate: d }));
                       if (customRange.startDate && d) {
                           setFilter('custom', { startDate: startOfDay(customRange.startDate), endDate: endOfDay(d) });
                           if (onFilterChange) onFilterChange({ startDate: startOfDay(customRange.startDate), endDate: endOfDay(d) });
                           setIsOpen(false);
                       }
                    }}
                 />
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
