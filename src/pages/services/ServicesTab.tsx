import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ServiceFormModal } from '../../components/ServiceFormModal';
import { DataTable } from '../../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { 
  collection, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  getDocs,
  where
} from '../../lib/firebaseAdapter';
import { db, Service, ServiceCategory, handleFirestoreError, OperationType } from '../../lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  List,
  Clock
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { useAuth } from '../../App';

export function ServicesTab() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });
  const [initialData, setInitialData] = useState<Partial<Service> | undefined>(undefined);

  const canAdd = profile?.role === 'admin' || profile?.permissions?.products?.add;
  const canEdit = profile?.role === 'admin' || profile?.permissions?.products?.edit;
  const canDelete = profile?.role === 'admin' || profile?.permissions?.products?.delete;

  useEffect(() => {
    const qServices = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
    const unsubscribeServices = onSnapshot(qServices, (snapshot: any) => {
      const srvs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Service));
      setServices(srvs);
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });

    const qCats = query(collection(db, 'serviceCategories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot: any) => {
      setCategories(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ServiceCategory)));
    });

    return () => {
      unsubscribeServices();
      unsubscribeCats();
    };
  }, []);

  const handleDelete = async () => {
    try {
      // Logic for checking transactions could go here. For now, soft delete or delete.
      await updateDoc(doc(db, 'services', deleteConfirm.id), {
        status: 'inactive',
        updatedAt: serverTimestamp()
      });
      toast.success('Đã chuyển dịch vụ sang trạng thái tạm ngưng do có thể có lịch hẹn liên quan.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'services');
    }
    setDeleteConfirm({ isOpen: false, id: '' });
  };

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchSearch = searchTerm === '' || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategory = filterCategory === 'all' || s.categoryId === filterCategory;
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [services, searchTerm, filterCategory, filterStatus]);

  const columns = useMemo<ColumnDef<Service>[]>(
    () => [
      {
        accessorKey: 'images',
        header: 'Ảnh',
        cell: ({ row }) => {
          const images = row.getValue('images') as string[];
          return images && images.length > 0 ? (
            <img src={images[0]} alt={row.original.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
              <Sparkles className="w-5 h-5 text-slate-300" />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'code',
        header: 'Mã DV',
        cell: ({ row }) => <span className="font-mono text-slate-500 text-xs">{row.getValue('code') || '-'}</span>
      },
      {
        accessorKey: 'name',
        header: 'Dịch vụ',
        cell: ({ row }) => <span className="font-bold text-slate-800">{row.getValue('name')}</span>
      },
      {
        accessorKey: 'categoryName',
        header: 'Danh mục',
        cell: ({ row }) => <span className="text-slate-600">{row.getValue('categoryName') || '-'}</span>
      },
      {
        accessorKey: 'price',
        header: 'Giá niêm yết',
        cell: ({ row }) => <span className="text-slate-600 line-through">{formatCurrency(row.getValue('price') || 0)}</span>
      },
      {
        accessorKey: 'promoPrice',
        header: 'Giá KM',
        cell: ({ row }) => {
          const promo = row.getValue('promoPrice') as number;
          return promo > 0 ? (
            <span className="font-bold text-rose-600">{formatCurrency(promo)}</span>
          ) : (
            <span className="font-bold text-blue-600">{formatCurrency(row.original.price || 0)}</span>
          );
        }
      },
      {
        accessorKey: 'duration',
        header: 'Thời lượng',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5" />
            {row.getValue('duration')} Phút
          </span>
        )
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return (
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
              status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}>
              {status === 'active' ? 'Đang phục vụ' : 'Tạm ngưng'}
            </span>
          );
        }
      },
      {
        id: 'actions',
        header: 'Thao tác',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {canEdit && (
              <button 
                onClick={(e) => { e.stopPropagation(); setEditingId(row.original.id!); setInitialData(undefined); setIsModalOpen(true); }}
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                title="Chỉnh sửa"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: row.original.id! }); }}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Xóa/Tạm ngưng"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
        enableSorting: false,
      }
    ],
    [canEdit, canDelete]
  );

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 md:pb-6 -mt-4 md:-mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              Quản lý dịch vụ
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Quản lý các gói liệu trình, Spa, Wellness</p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap">
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
            {canAdd && (
              <button 
                onClick={() => { setEditingId(null); setInitialData(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 whitespace-nowrap ml-2"
              >
                <Plus className="w-4 h-4" />
                Thêm dịch vụ
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm theo Tên, Mã..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-medium text-slate-700"
            />
          </div>
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 min-w-[150px] appearance-none"
          >
            <option value="all">Tất cả danh mục</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 min-w-[150px] appearance-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang phục vụ</option>
            <option value="inactive">Tạm ngưng</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={filteredServices} 
            onRowClick={(row) => {
               setEditingId(row.id!);
               setInitialData(row);
               setIsModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Service Form Modal */}
      {isModalOpen && (
        <ServiceFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingId(null);
            setInitialData(undefined);
          }}
          editingId={editingId}
          initialData={initialData}
          categories={categories}
          onSuccess={() => {}}
          canAdd={canAdd}
          canEdit={canEdit}
        />
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '' })}
        onConfirm={handleDelete}
        title="Xóa / Tạm ngưng dịch vụ"
        message="Dịch vụ này có thể đang liên kết với các lịch hẹn hoặc hóa đơn cũ. Thao tác này sẽ chuyển trạng thái sang Tạm ngưng."
        confirmText="Đồng ý"
        type="danger"
      />
    </div>
  );
}
