import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, ActivityLog, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, Loader2 } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion } from 'motion/react';

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.userName?.toLowerCase().includes(search.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.details.toLowerCase().includes(search.toLowerCase()) ||
    log.module.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Nhật ký hoạt động</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Lịch sử thao tác của các tài khoản</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên, email, hành động..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-black text-slate-900">Không tìm thấy thông tin</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Thời gian</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân viên</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phân hệ</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thao tác</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={log.id} 
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">{log.createdAt ? formatDate(log.createdAt) : '---'}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white">
                          <img src={`https://ui-avatars.com/api/?name=${log.userName || log.userEmail}&background=f1f5f9&color=64748b`} alt={log.userName} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{log.userName}</p>
                          <p className="text-[10px] font-bold text-slate-500">{log.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-black uppercase text-blue-600 tracking-widest whitespace-nowrap">{log.module}</td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">{log.action}</td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-500">{log.details}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden flex flex-col space-y-4">
            {filteredLogs.map((log) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={log.id}
                className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-3 border border-slate-100"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shrink-0">
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
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-2 py-1 rounded inline-block">{log.module}</span>
                    <span className="text-xs font-bold text-slate-700">{log.action}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100 mt-1">{log.details}</p>
                </div>
              </motion.div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
