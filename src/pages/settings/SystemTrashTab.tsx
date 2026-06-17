import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Trash2, Search, RotateCcw, AlertTriangle, Settings2, Trash, X } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc } from '../../lib/firebaseAdapter';
import { db } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { OrderDetailsModal } from '../../components/OrderDetailsModal';

interface TrashItem {
  id: string;
  type: string;
  collectionName: string;
  name: string;
  details: string;
  deleted_at: string;
  deleted_by?: string;
  deleted_by_name?: string;
  rawData?: any;
}

export function SystemTrashTab({ settings, updateSetting }: { settings: any, updateSetting: (section: string, key: string, value: any) => void }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const collections = [
    { name: 'customers', label: 'Khách hàng' },
    { name: 'products', label: 'Sản phẩm' },
    { name: 'orders', label: 'Đơn hàng' },
    { name: 'transactions', label: 'Tài chính' },
    { name: 'debts', label: 'Công nợ' },
    { name: 'bookings', label: 'Lịch hẹn' }
  ];

  const [viewItem, setViewItem] = useState<TrashItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      
      try {
        const usersSnap = await getDocs(collection(db, 'user_profiles'));
        const usersMap: Record<string, string> = {};
        usersSnap.docs.forEach(u => {
          usersMap[u.id] = u.data().full_name || 'Admin';
        });

        let loadedItems: TrashItem[] = [];

        for (const col of collections) {
          try {
            const q = query(collection(db, col.name), where('is_deleted', '==', true));
            const snapshot = await getDocs(q);
            
            const docs = snapshot.docs.map((d: any) => {
               const data = d.data();
               let name = 'Không xác định';
               let details = '';
               
               if (col.name === 'customers' || col.name === 'products') {
                 name = data.name || data.sku || 'N/A';
                 details = data.phone || data.barcode || '';
               } else if (col.name === 'orders') {
                 name = `Đơn hàng #${d.id?.substring(0,6) || ''}`;
                 details = `Khách: ${data.customerName || 'N/A'} - Tổng: ${formatCurrency(data.totalAmount || 0)}`;
               } else if (col.name === 'transactions') {
                 name = `Phiếu ${data.type === 'income' ? 'Thu' : 'Chi'} ${data.code || ''}`;
                 details = `${data.description || ''} - ${formatCurrency(data.amount || 0)}`;
               } else if (col.name === 'debts') {
                 name = `Công nợ ${data.type === 'payable' ? 'Phải trả' : 'Phải thu'} ${data.code || ''}`;
                 details = `${data.partnerName || ''} - ${formatCurrency(data.amount || 0)}`;
               } else if (col.name === 'bookings') {
                 name = `Lịch hẹn #${d.id?.substring(0,6) || ''}`;
                 details = `Khách: ${data.customerName || ''} - ${data.bookingTime ? new Date(data.bookingTime).toLocaleString('vi-VN') : ''}`;
               }
  
               let delAt = new Date().toISOString();
               try {
                 if (data.deletedAt && data.deletedAt.toDate) {
                   delAt = data.deletedAt.toDate().toISOString();
                 } else if (data.deleted_at) {
                   delAt = data.deleted_at;
                 }
               } catch (e) {}

               let deletedByName = 'Không rõ';
               if (data.deletedBy && usersMap[data.deletedBy]) deletedByName = usersMap[data.deletedBy];
               else if (data.deleted_by && usersMap[data.deleted_by]) deletedByName = usersMap[data.deleted_by];

               return {
                 id: d.id,
                 type: col.label,
                 collectionName: col.name,
                 name,
                 details,
                 deleted_at: delAt,
                 deleted_by: data.deletedBy || data.deleted_by,
                 deleted_by_name: deletedByName,
                 rawData: data
               };
            });
            
            loadedItems = [...loadedItems, ...docs];
          } catch (error) {
            console.error(`Error loading trash for ${col.name}:`, error);
          }
        }
        
        if (isMounted) {
          const sortedItems = loadedItems.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
          setItems(sortedItems);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading trash data:", error);
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [settings.trash?.autoDeleteDays]);

  const handleRestore = async (id: string, colName: string) => {
    try {
      await updateDoc(doc(db, colName, id), {
         is_deleted: false,
         deleted_at: null,
         deleted_by: null
      });
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Đã khôi phục dữ liệu!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi khôi phục');
    }
  };

  const handlePermanentDelete = async (id: string, colName: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn?')) return;
    try {
      await deleteDoc(doc(db, colName, id));
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Đã xóa vĩnh viễn');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa');
    }
  };

  const filteredItems = items.filter(i => {
    const matchType = filterType === 'all' || i.collectionName === filterType;
    const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
           <h3 className="text-lg font-black text-slate-900 uppercase flex items-center gap-2">
             <Trash2 className="w-5 h-5 text-rose-500" /> Quản lý thùng rác
           </h3>
           <p className="text-sm text-slate-500 mt-1">Dữ liệu đã xóa (Soft-delete) từ toàn hệ thống.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
           <Settings2 className="w-5 h-5 text-slate-400" />
           <div className="flex flex-col">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tự động xóa vĩnh viễn sau</label>
             <select 
               value={settings.trash?.autoDeleteDays || 30}
               onChange={(e) => updateSetting('trash', 'autoDeleteDays', Number(e.target.value))}
               className="bg-transparent text-sm font-bold text-slate-900 border-none outline-none focus:ring-0 p-0 cursor-pointer"
             >
               <option value={7}>7 ngày</option>
               <option value={15}>15 ngày</option>
               <option value={30}>30 ngày</option>
               <option value={60}>60 ngày</option>
               <option value={0}>Không bao giờ (Thủ công)</option>
             </select>
           </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
         <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
         <div>
            <p className="text-sm font-bold text-amber-800">Lưu ý</p>
            <p className="text-xs text-amber-700 mt-1">Tính năng tự động xóa vĩnh viễn sẽ chạy ngầm khi Admin đăng nhập, dọn dẹp các dữ liệu quá thời hạn lưu trữ.</p>
         </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 w-full" 
            />
          </div>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tất cả dữ liệu</option>
            {collections.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Thời gian xóa</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Loại</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Người xóa</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-[250px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold flex flex-col items-center gap-2"><Trash className="w-8 h-8 text-slate-300" /> Thùng rác trống</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{new Date(item.deleted_at).toLocaleDateString('vi-VN')}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(item.deleted_at).toLocaleTimeString('vi-VN')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{item.deleted_by_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700 max-w-xs truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 max-w-xs truncate">{item.details}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setViewItem(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                        >
                          Xem CT
                        </button>
                        <button 
                          onClick={() => handleRestore(item.id, item.collectionName)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                        </button>
                         <button onClick={() => handlePermanentDelete(item.id, item.collectionName)} className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-rose-100 transition-colors">
                            <Trash2 className="w-3 h-3" /> Xóa
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>
        {viewItem && viewItem.collectionName === 'orders' && (
          <OrderDetailsModal 
            order={viewItem.rawData as Order} 
            onClose={() => setViewItem(null)} 
          />
        )}
        {viewItem && viewItem.collectionName !== 'orders' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-900">Chi tiết dữ liệu đã xóa</h3>
                <button onClick={() => setViewItem(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <p className="text-sm font-bold text-slate-900">Loại: <span className="font-normal">{viewItem.type}</span></p>
                  <p className="text-sm font-bold text-slate-900">Người xóa: <span className="font-normal">{viewItem.deleted_by_name}</span></p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(viewItem.rawData || {}).map(([key, val]) => {
                        // Skip system fields that are already shown or internal
                        if (['is_deleted', 'deleted_at', 'deletedAt', 'deletedBy', 'deleted_by', 'id'].includes(key)) return null;
                        
                        let displayValue = String(val);
                        if (val === null || val === undefined) displayValue = '---';
                        else if (typeof val === 'boolean') displayValue = val ? 'Có' : 'Không';
                        else if (typeof val === 'object') {
                          if (val instanceof Date) displayValue = formatDate(val);
                          else if (val.toDate) displayValue = formatDate(val.toDate());
                          else if (val.seconds) displayValue = formatDate(new Date(val.seconds * 1000));
                          else displayValue = JSON.stringify(val);
                        } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('spend')) {
                          if (typeof val === 'number') displayValue = formatCurrency(val);
                        }

                        // Human readable keys logic
                        let humanKey = key;
                        const keyMap: Record<string, string> = {
                          name: 'Tên', phone: 'Số ĐT', address: 'Địa chỉ', note: 'Ghi chú', 
                          gender: 'Giới tính', birthDate: 'Ngày sinh', status: 'Trạng thái',
                          code: 'Mã', type: 'Loại', barcode: 'Mã vạch', sku: 'SKU', 
                          listPrice: 'Giá vốn', retailPrice: 'Giá bán lẻ', wholesalePrice: 'Giá sỉ',
                          stock: 'Tồn kho', unit: 'Đơn vị', description: 'Mô tả',
                          totalSpend: 'Tổng chi tiêu', orderCount: 'Số đơn hàng', 
                          tier: 'Hạng', points: 'Điểm', totalDebt: 'Tổng công nợ',
                          createdAt: 'Ngày tạo', updatedAt: 'Ngày cập nhật'
                        };
                        if (keyMap[key]) humanKey = keyMap[key];

                        return (
                          <tr key={key} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-700 w-1/3 border-r border-slate-100 bg-slate-50/50">{humanKey}</td>
                            <td className="py-3 px-4 text-slate-600 break-words">{displayValue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button 
                  onClick={() => handleRestore(viewItem.id, viewItem.collectionName)}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Khôi phục
                </button>
                <button onClick={() => setViewItem(null)} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
