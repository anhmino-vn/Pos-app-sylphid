import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from '../lib/firebaseAdapter';
import { db, ActivityLog, handleFirestoreError, OperationType } from '../lib/supabase';
import { Search, Loader2, Download, Filter, FileText, ChevronLeft, Calendar } from 'lucide-react';
import { formatDate, parseSafeDate } from '../lib/utils';
import { motion } from 'motion/react';
import { LogDetailsModal } from '../components/LogDetailsModal';

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  
  // Filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 50;

  // Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Derive unique modules and actions from logs (for simple dropdowns, in a real app this might be fixed enums)
  const availableModules = useMemo(() => {
    const modules = new Set<string>();
    logs.forEach(l => { if (l.module) modules.add(String(l.module)); });
    return Array.from(modules).sort();
  }, [logs]);

  const availableActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach(l => { if (l.action) actions.add(String(l.action)); });
    return Array.from(actions).sort();
  }, [logs]);

  useEffect(() => {
    const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(500));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: ActivityLog[] = [];
      snapshot.docs.forEach((doc: any) => {
        logsData.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(logsData);
      setLoading(false);
    }, (error: any) => {
      console.error('Error loading logs:', error);
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        !search ||
        (String(log.userName || '').toLowerCase()).includes(searchLower) ||
        (String(log.userEmail || '').toLowerCase()).includes(searchLower) ||
        (String(log.action || '').toLowerCase()).includes(searchLower) ||
        (String(log.details || '').toLowerCase()).includes(searchLower) ||
        (String(log.module || '').toLowerCase()).includes(searchLower);

      if (!matchesSearch) return false;

      // Module
      if (moduleFilter && log.module !== moduleFilter) return false;
      
      // Action
      if (actionFilter && log.action !== actionFilter) return false;

      // Date Range
      if (startDate || endDate) {
        const logDate = parseSafeDate(log.createdAt);
        logDate.setHours(0,0,0,0);
        
        if (startDate) {
           const sDate = new Date(startDate);
           sDate.setHours(0,0,0,0);
           if (logDate < sDate) return false;
        }
        if (endDate) {
           const eDate = new Date(endDate);
           eDate.setHours(23,59,59,999);
           if (logDate > eDate) return false;
        }
      }

      return true;
    });
  }, [logs, search, moduleFilter, actionFilter, startDate, endDate]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }

    const headers = ['Thời gian', 'Phân hệ', 'Thao tác', 'Nhân viên', 'Email', 'Mức độ', 'Chi tiết'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => {
        const dateStr = log.createdAt ? formatDate(log.createdAt) : '';
        const module = `"${(log.module || '').replace(/"/g, '""')}"`;
        const action = `"${(log.action || '').replace(/"/g, '""')}"`;
        const user = `"${(log.userName || '').replace(/"/g, '""')}"`;
        const email = `"${(log.userEmail || '').replace(/"/g, '""')}"`;
        const severity = log.severity || 'info';
        const details = `"${(log.details || '').replace(/"/g, '""')}"`;
        return `${dateStr},${module},${action},${user},${email},${severity},${details}`;
      })
    ].join('\n');

    // Add BOM for UTF-8 support in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nhat_ky_he_thong_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (severity?: string) => {
    switch(severity) {
      case 'danger':
        return <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[10px] font-black uppercase tracking-widest border border-rose-100">Nguy hiểm</span>;
      case 'warning':
        return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-black uppercase tracking-widest border border-amber-100">Cảnh báo</span>;
      case 'info':
      default:
        return <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase tracking-widest border border-blue-100">Thông tin</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Nhật ký hệ thống</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Lịch sử thao tác và thay đổi dữ liệu</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-all shadow-sm border border-emerald-200"
        >
          <Download className="w-4 h-4" />
          Xuất Excel (CSV)
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        
        {/* Filters Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nội dung, email, người dùng..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-3">
             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm outline-none w-[110px] py-2.5 text-slate-600 font-medium"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm outline-none w-[110px] py-2.5 text-slate-600 font-medium"
                />
             </div>
             <select
               value={moduleFilter}
               onChange={e => setModuleFilter(e.target.value)}
               className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20"
             >
               <option value="">Tất cả phân hệ</option>
               {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
             <select
               value={actionFilter}
               onChange={e => setActionFilter(e.target.value)}
               className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20"
             >
               <option value="">Tất cả thao tác</option>
               {availableActions.map(a => <option key={a} value={a}>{a}</option>)}
             </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-lg font-black text-slate-900">Không tìm thấy thông tin</p>
            <p className="text-sm text-slate-500 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Thời gian</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nhân viên</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phân hệ</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Thao tác</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mức độ</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[200px]">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4 text-xs font-bold text-slate-600 whitespace-nowrap">{log.createdAt ? formatDate(log.createdAt) : '---'}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                          <img src={`https://ui-avatars.com/api/?name=${log.userName || log.userEmail}&background=f1f5f9&color=64748b`} alt={log.userName} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">{log.userName}</p>
                          <p className="text-[10px] font-bold text-slate-400">{log.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-black uppercase text-blue-600 tracking-widest whitespace-nowrap">{log.module}</td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">{log.action}</td>
                    <td className="py-4 px-4 whitespace-nowrap">{getSeverityBadge(log.severity)}</td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-600 truncate max-w-[300px]" title={log.details}>{log.details}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile view */}
          <div className="md:hidden flex flex-col space-y-4">
            {filteredLogs.map((log) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="bg-white p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shrink-0 shadow-sm">
                      <img src={`https://ui-avatars.com/api/?name=${log.userName || log.userEmail}&background=f1f5f9&color=64748b`} alt={log.userName} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{log.userName}</p>
                      <p className="text-[10px] font-bold text-slate-500 truncate">{log.userEmail}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-500">{log.createdAt ? formatDate(log.createdAt).split(' ')[0] : '---'}</p>
                    <p className="text-[10px] font-bold text-slate-400">{log.createdAt ? formatDate(log.createdAt).split(' ')[1] : '---'}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(log.severity)}
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-block">{log.module}</span>
                    <span className="text-xs font-bold text-slate-700">{log.action}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-2">{log.details}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          </>
        )}
      </div>

      <LogDetailsModal 
         isOpen={!!selectedLog} 
         onClose={() => setSelectedLog(null)} 
         log={selectedLog} 
      />
    </div>
  );
}
