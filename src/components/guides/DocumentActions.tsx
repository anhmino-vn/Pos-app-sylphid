import React, { useState, useRef, useEffect } from 'react';
import { Eye, FileEdit, Printer, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Guide } from '../../lib/firebase';

interface DocumentActionsProps {
  guide: Guide;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
  canEdit?: boolean;
}

export function DocumentActions({ guide, onView, onEdit, onDelete, onPrint, canEdit = true }: DocumentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative flex items-center justify-end" onClick={e => e.stopPropagation()}>
      {/* Desktop: Inline Actions */}
      <div className="hidden sm:flex items-center gap-1">
        <div className="relative group/tooltip">
          <button 
            onClick={onView} 
            className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Xem chi tiết</div>
        </div>

        {canEdit && (
          <div className="relative group/tooltip">
            <button 
              onClick={onEdit} 
              className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
            >
              <FileEdit className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Sửa tài liệu</div>
          </div>
        )}

        <div className="relative group/tooltip">
          <button 
            onClick={onPrint} 
            className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">In tài liệu</div>
        </div>

        {canEdit && (
          <div className="relative group/tooltip">
            <button 
              onClick={onDelete} 
              className="hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Xóa tài liệu</div>
          </div>
        )}
      </div>

      {/* Mobile: Dropdown Menu */}
      <div className="sm:hidden relative" ref={menuRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-50 flex flex-col py-1.5 overflow-hidden">
            <button 
              onClick={() => { setIsOpen(false); onView(); }} 
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-500" /> Xem chi tiết
            </button>
            
            {canEdit && (
              <button 
                onClick={() => { setIsOpen(false); onEdit(); }} 
                className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left transition-colors"
              >
                <FileEdit className="w-4 h-4 text-slate-500" /> Sửa tài liệu
              </button>
            )}

            <button 
              onClick={() => { setIsOpen(false); onPrint(); }} 
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-500" /> In tài liệu
            </button>
            
            {canEdit && (
              <button 
                onClick={() => { setIsOpen(false); onDelete(); }} 
                className="px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 w-full text-left transition-colors"
              >
                <Trash2 className="w-4 h-4 text-rose-500" /> Xóa
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
