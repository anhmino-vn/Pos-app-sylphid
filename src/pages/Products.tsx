import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProductFormModal } from '../components/ProductFormModal';
import { DataTable } from '../components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { 
  collection, 
  onSnapshot, 
  deleteDoc, 
  query,
  orderBy,
  where,
  updateDoc,
  doc
} from '../lib/firebaseAdapter';
import { db, Product, ProductCategory, Brand, handleFirestoreError, OperationType } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  Loader2,
  Barcode,
  RefreshCw,
  ShoppingBag,
  Download,
  Upload,
  QrCode
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../App';
import * as XLSX from 'xlsx';
import { addDoc, serverTimestamp } from '../lib/firebaseAdapter';

export function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });
  const [initialData, setInitialData] = useState<Partial<Product> | undefined>(undefined);

  const canAdd = profile?.role === 'admin' || profile?.permissions?.products?.add;
  const canEdit = profile?.role === 'admin' || profile?.permissions?.products?.edit;
  const canDelete = profile?.role === 'admin' || profile?.permissions?.products?.delete;

  useEffect(() => {
    const qProds = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProds = onSnapshot(qProds, (snapshot: any) => {
      const prods = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Product)).filter(p => !(p as any).is_deleted && !p.deletedAt && !(p as any).deleted_at);
      setProducts(prods);
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qCats = query(collection(db, 'productCategories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot: any) => {
      setCategories(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as ProductCategory)));
    });

    const qBrands = query(collection(db, 'brands'), orderBy('name', 'asc'));
    const unsubscribeBrands = onSnapshot(qBrands, (snapshot: any) => {
      setBrands(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Brand)));
    });

    return () => {
      unsubscribeProds();
      unsubscribeCats();
      unsubscribeBrands();
    };
  }, []);

  const handleDelete = async () => {
    try {
      await updateDoc(doc(db, 'products', deleteConfirm.id), {
        is_deleted: true,
        deleted_by: profile?.id || null,
        deleted_at: serverTimestamp()
      });
      toast.success('Xóa sản phẩm thành công');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
    setDeleteConfirm({ isOpen: false, id: '' });
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    if (products.length === 0) return toast.error('Không có dữ liệu để xuất');
    
    const dataToExport = products.map(p => ({
      'Tên Sản Phẩm': p.name,
      'Mã SKU': p.sku || '',
      'Barcode': p.barcode || '',
      'Giá Vốn': p.listPrice || 0,
      'Giá Bán': p.salePrice || 0,
      'Tồn Kho': p.stock || 0,
      'Đơn Vị': p.baseUnit || 'Cái',
      'Trạng Thái': p.status === 'active' ? 'Đang bán' : p.status === 'inactive' ? 'Ngừng bán' : 'Xóa'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, `Danh_Sach_San_Pham_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Đã xuất file Excel!');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let count = 0;
        for (const item of jsonData as any[]) {
          if (!item['Tên Sản Phẩm']) continue; // skip invalid rows
          
          await addDoc(collection(db, 'products'), {
            name: item['Tên Sản Phẩm'],
            sku: item['Mã SKU'] || '',
            barcode: item['Barcode'] || '',
            listPrice: Number(item['Giá Vốn']) || 0,
            salePrice: Number(item['Giá Bán']) || 0,
            stock: Number(item['Tồn Kho']) || 0,
            baseUnit: item['Đơn Vị'] || 'Cái',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          count++;
        }
        
        toast.success(`Đã import thành công ${count} sản phẩm!`);
      } catch (error) {
        console.error(error);
        toast.error('Có lỗi xảy ra khi import file.');
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = searchTerm === '' || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategory = filterCategory === 'all' || p.categoryId === filterCategory;
      const matchBrand = filterBrand === 'all' || p.brandId === filterBrand;
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;

      return matchSearch && matchCategory && matchBrand && matchStatus;
    });
  }, [products, searchTerm, filterCategory, filterBrand, filterStatus]);

  const columns = useMemo<ColumnDef<Product>[]>(
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
              <ImageIcon className="w-5 h-5" />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'sku',
        header: 'Mã Sản Phẩm',
        cell: ({ row }) => <span className="font-mono text-slate-500 text-xs">{row.getValue('sku') || '-'}</span>
      },
      {
        accessorKey: 'name',
        header: 'Sản phẩm',
        cell: ({ row }) => <span className="font-bold text-slate-800">{row.getValue('name')}</span>
      },
      {
        accessorKey: 'categoryId',
        header: 'Danh mục',
        cell: ({ row }) => {
          const cat = categories.find(c => c.id === row.getValue('categoryId'));
          return <span className="text-slate-600">{cat?.name || '-'}</span>;
        }
      },
      {
        accessorKey: 'baseUnit',
        header: 'Đơn vị',
        cell: ({ row }) => <span className="text-slate-600">{row.getValue('baseUnit') || 'Cái'}</span>
      },
      {
        accessorKey: 'listPrice',
        header: 'Giá vốn',
        cell: ({ row }) => <span className="text-slate-600">{formatCurrency(row.getValue('listPrice') || 0)}</span>
      },
      {
        accessorKey: 'salePrice',
        header: 'Giá bán',
        cell: ({ row }) => <span className="font-bold text-blue-600">{formatCurrency(row.getValue('salePrice') || 0)}</span>
      },
      {
        accessorKey: 'stock',
        header: 'Tồn kho',
        cell: ({ row }) => {
          const stock = row.getValue('stock') as number || 0;
          return (
            <span className={cn("font-bold", stock <= 0 ? "text-rose-500" : stock <= 5 ? "text-amber-500" : "text-emerald-600")}>
              {stock}
            </span>
          );
        }
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return (
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
              status === 'active' ? "bg-emerald-100 text-emerald-700" :
              status === 'inactive' ? "bg-slate-100 text-slate-600" :
              "bg-rose-100 text-rose-700"
            )}>
              {status === 'active' ? 'Đang bán' : status === 'inactive' ? 'Ngừng bán' : 'Xóa'}
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
                onClick={(e) => { e.stopPropagation(); setEditingId(row.original.id!); setInitialData(row.original); setIsModalOpen(true); }}
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
                title="Xóa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
        enableSorting: false,
      }
    ],
    [categories, brands, canEdit, canDelete]
  );

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC] pt-4 md:pt-6 pb-4 md:pb-6 -mt-4 md:-mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              Quản lý sản phẩm
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Danh sách tất cả sản phẩm đang kinh doanh</p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap">
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleImportExcel} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button 
              onClick={() => toast('Tính năng in Barcode đang được hoàn thiện', { icon: '🚧' })}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap"
            >
              <Barcode className="w-4 h-4" />
              In Barcode
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm whitespace-nowrap">
              <QrCode className="w-4 h-4" />
              In QRCode
            </button>
            {canAdd && (
              <button 
                onClick={() => { setEditingId(null); setInitialData(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 whitespace-nowrap ml-2"
              >
                <Plus className="w-4 h-4" />
                Thêm mới
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
              placeholder="Tìm kiếm theo Tên, SKU, Barcode..."
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
            value={filterBrand} 
            onChange={e => setFilterBrand(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 min-w-[150px] appearance-none"
          >
            <option value="all">Tất cả thương hiệu</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 min-w-[150px] appearance-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán</option>
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
            data={filteredProducts} 
            onRowClick={(row) => {
               setEditingId(row.id!);
               setInitialData(row.original);
               setIsModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingId(null);
            setInitialData(undefined);
          }}
          editingId={editingId}
          initialData={initialData}
          categories={categories}
          brands={brands}
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
        title="Xóa sản phẩm"
        message="Bạn có chắc chắn muốn xóa sản phẩm này? Thao tác này sẽ chỉ đánh dấu xóa (Soft Delete)."
        confirmText="Xóa sản phẩm"
        type="danger"
      />
    </div>
  );
}
