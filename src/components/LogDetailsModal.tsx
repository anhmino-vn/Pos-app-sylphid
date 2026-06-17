import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { ActivityLog } from '../lib/supabase';
import { formatDate } from '../lib/utils';

interface LogDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: ActivityLog | null;
}

export function LogDetailsModal({ isOpen, onClose, log }: LogDetailsModalProps) {
  if (!log) return null;

  const renderDataInfo = (data: any) => {
    if (!data) return <p className="text-slate-500 text-xs italic">Không có dữ liệu</p>;
    
    // If it's a string, try to parse it
    let parsed = data;
    if (typeof data === 'string') {
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            return <p className="text-slate-700 text-xs break-all">{data}</p>;
        }
    }

    if (typeof parsed !== 'object') {
        return <p className="text-slate-700 text-xs">{String(parsed)}</p>;
    }

    let displayString = '';
    try {
       displayString = JSON.stringify(parsed, null, 2);
    } catch(e) {
       displayString = String(parsed);
    }

    // Format as a simple table or list
    return (
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 overflow-x-auto max-h-[300px] custom-scrollbar">
        <pre className="text-[11px] text-slate-700 font-mono">
           {displayString}
        </pre>
      </div>
    );
  };

  const severityColor = 
    log.severity === 'danger' ? 'text-rose-600 bg-rose-50 border-rose-100' :
    log.severity === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-100' :
    'text-blue-600 bg-blue-50 border-blue-100';

  const severityIcon = 
    log.severity === 'danger' ? <AlertCircle className="w-5 h-5 text-rose-500" /> :
    log.severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> :
    <CheckCircle2 className="w-5 h-5 text-blue-500" />;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className={`p-6 border-b flex items-center justify-between ${severityColor}`}>
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm">
                   {severityIcon}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Chi tiết hoạt động</h3>
                  <p className="text-xs font-bold opacity-80">{log.action}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/50 hover:bg-white rounded-full transition-colors text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Thời gian</p>
                   <p className="text-sm font-bold text-slate-700">{log.createdAt ? formatDate(log.createdAt) : '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Phân hệ</p>
                   <p className="text-sm font-bold text-slate-700">{log.module}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                   <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Người thực hiện</p>
                   <div className="flex items-center gap-3 mt-2">
                      <img src={`https://ui-avatars.com/api/?name=${log.userName || log.userEmail}&background=f1f5f9&color=64748b`} alt={log.userName} className="w-8 h-8 rounded-full border border-slate-200" />
                      <div>
                         <p className="text-sm font-bold text-slate-900">{log.userName}</p>
                         <p className="text-[10px] text-slate-500">{log.userEmail}</p>
                      </div>
                   </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Thông tin chi tiết (Message)</p>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl text-sm font-medium text-slate-700">
                   {log.details}
                </div>
              </div>

              {log.oldData && (
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Dữ liệu gốc (Old Data)</p>
                  {renderDataInfo(log.oldData)}
                </div>
              )}

              {log.newData && (
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Dữ liệu mới (New Data)</p>
                  {renderDataInfo(log.newData)}
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
