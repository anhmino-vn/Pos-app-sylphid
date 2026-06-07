import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where,
  getDocs,
  deleteDoc,
  writeBatch
} from '../lib/firebaseAdapter';
import { db, Customer, Order } from '../lib/supabase';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  History,
  MoreVertical,
  Plus,
  Loader2,
  X,
  CheckCircle2,
  TrendingUp,
  Award,
  ChevronRight,
  ShoppingBag,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  ClipboardList,
  Package,
  Sparkles,
  Clock,
  Download,
  Save,
  Filter,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronDown,
  Printer,
  FileText,
  Upload
} from 'lucide-react';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useDateFilterStore } from '../store/useDateFilterStore';

import { DateFilter, DateRange } from '../components/DateFilter';
import { startOfMonth, endOfDay } from 'date-fns';

import { useNavigate, useLocation } from 'react-router-dom';

export function Customers() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.action === 'create') {
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const { dateRange, setDateRange } = useDateFilterStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOrderNow, setCreateOrderNow] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [actionMenuCustomer, setActionMenuCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, customer: Customer | null, isBulk?: boolean}>({ isOpen: false, customer: null });
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [customerHistoryFilter, setCustomerHistoryFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [statFilter, setStatFilter] = useState<'all' | 'new' | 'old' | 'unpaid'>('all');
  const [customerGroupFilter, setCustomerGroupFilter] = useState('');
  const [customerSourceFilter, setCustomerSourceFilter] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('');
  const [loyaltyLogs, setLoyaltyLogs] = useState<any[]>([]);
  const [customerDetailTab, setCustomerDetailTab] = useState<'info' | 'orders' | 'payment' | 'debt' | 'points' | 'logs'>('info');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), snap => {
        setAllOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).filter(o => !o.deletedAt));
    });
    return unsubscribe;
  }, []);

  const handleSyncCRM = async () => {
    if (!window.confirm('Hệ thống sẽ đồng bộ lại toàn bộ dữ liệu mua sắm của khách hàng từ module đơn hàng. (Có thể mất thời gian). Bạn có chắc chắn?')) return;
    setSyncing(true);
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const activeOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).filter(o => !o.deletedAt && o.status === 'paid');
      
      const customerDataMap = new Map<string, { totalSpend: number; orderCount: number; lastPurchaseDate: any }>();
      for (const order of activeOrders) {
         if (order.customerId) {
            const current = customerDataMap.get(order.customerId) || { totalSpend: 0, orderCount: 0, lastPurchaseDate: order.createdAt };
            const odTime = order.createdAt?.toDate ? order.createdAt.toDate().getTime() : 0;
            const curTime = current.lastPurchaseDate?.toDate ? current.lastPurchaseDate.toDate().getTime() : 0;
            const newLastPurchaseDate = odTime > curTime ? order.createdAt : current.lastPurchaseDate;
            
            customerDataMap.set(order.customerId, {
               totalSpend: current.totalSpend + (order.totalAmount || 0),
               orderCount: current.orderCount + 1,
               lastPurchaseDate: newLastPurchaseDate
            });
         }
      }

      const customersSnap = await getDocs(collection(db, 'customers'));
      const updatePromises = customersSnap.docs.map(cDoc => {
         const data = customerDataMap.get(cDoc.id) || { totalSpend: 0, orderCount: 0, lastPurchaseDate: null as any };
         return updateDoc(doc(db, 'customers', cDoc.id), {
            totalSpend: data.totalSpend,
            orderCount: data.orderCount,
            ...(data.lastPurchaseDate ? { lastPurchaseDate: data.lastPurchaseDate } : {})
         });
      });
      await Promise.all(updatePromises);
      
      // Re-fetch transactions
      const txSnap = await getDocs(collection(db, 'customer_transactions'));
      const deleteTxPromises = txSnap.docs.map(tDoc => deleteDoc(doc(db, 'customer_transactions', tDoc.id)));
      await Promise.all(deleteTxPromises);
      
      const addTxPromises = activeOrders.filter(o => o.customerId).map(order => {
          const itemsOverview = order.items?.map((i: any) => i.name).join(', ') || '';
          return addDoc(collection(db, 'customer_transactions'), {
              customerId: order.customerId,
              orderId: order.id,
              totalAmount: order.totalAmount,
              status: order.status,
              orderDate: order.createdAt || serverTimestamp(),
              itemsOverview: itemsOverview,
              createdBy: 'System Sync'
          });
      });
      await Promise.all(addTxPromises);
      
      toast.success('Đồng bộ dữ liệu CRM thành công!');
    } catch (e) {
      console.error(e);
      toast.error('Lỗi trong quá trình đồng bộ!');
    } finally {
      setSyncing(false);
    }
  };
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'lastPurchaseDate'> & { referredById?: string, code?: string }>({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    gender: '',
    birthDate: '',
    note: '',
    status: 'active',
    inChargeStaff: '',
    totalSpend: 0,
    orderCount: 0,
    tier: 'bronze',
    referredById: '',
    customerSource: '',
    customerGroup: ''
  });

  const [referrerSearchTerm, setReferrerSearchTerm] = useState('');
  const [isReferrerDropdownOpen, setIsReferrerDropdownOpen] = useState(false);
  const referrerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
        if (referrerDropdownRef.current && !referrerDropdownRef.current.contains(event.target as Node)) {
           setIsReferrerDropdownOpen(false);
        }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canEdit = profile?.role === 'admin' || profile?.permissions?.customers?.edit;

  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);

  const filteredReferrers = useMemo(() => {
     if (!isModalOpen) return [];
     let filtered = rawCustomers;
     if (referrerSearchTerm) {
        const term = referrerSearchTerm.toLowerCase();
        filtered = rawCustomers.filter(c => 
           (c.name && c.name.toLowerCase().includes(term)) || 
           (c.phone && c.phone.includes(term)) ||
           (c.id && c.id.toLowerCase().includes(term))
        );
     }
     
     const unique = new Map<string, any>();
     filtered.forEach(c => {
         const key = c.id;
         if (!unique.has(key) && c.id !== editingId) { // cannot refer itself
             unique.set(key, c);
         }
     });
     return Array.from(unique.values()).slice(0, 50);
  }, [rawCustomers, referrerSearchTerm, editingId, isModalOpen]);

  useEffect(() => {
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeCustomers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
        .filter((c: any) => c.status !== 'inactive' && !c.deletedAt && !c.deleted_at && !c.hidden);
        
      const unique = new Map<string, Customer>();
      activeCustomers.forEach(c => {
         const key = c.id!;
         if (!unique.has(key)) {
             unique.set(key, c);
         }
      });
      setRawCustomers(Array.from(unique.values()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
     setCustomers([...rawCustomers].sort((a, b) => {
        const spendA = allOrders.filter(o => o.customerId === a.id && o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const spendB = allOrders.filter(o => o.customerId === b.id && o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return spendB - spendA;
     }));
  }, [rawCustomers, allOrders]);

  useEffect(() => {
     if (!selectedCustomer) {
       setCustomerOrders([]);
       return;
     }

     const updateCustomerOrders = async () => {
         const cOrders = getFilteredOrders(selectedCustomer.id).sort((a,b) => {
             const tA = a.createdAt?.toDate ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
             const tB = b.createdAt?.toDate ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
             return tB - tA;
         });
         setCustomerOrders(cOrders);

         // Fetch loyalty logs
         try {
            const qRef = query(collection(db, 'loyalty_logs'), where('customerId', '==', selectedCustomer.id));
            const snap = await getDocs(qRef);
            const logs = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a: any, b: any) => {
               const ta = a.createdAt?.toDate ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
               const tb = b.createdAt?.toDate ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
               return tb - ta;
            });
            setLoyaltyLogs(logs);
         } catch (e) {
            console.error('Lỗi tải lịch sử điểm:', e);
         }
     };

     updateCustomerOrders();
  }, [selectedCustomer, allOrders, dateRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate Duplicate Phone & Email
      if (formData.phone) {
        const phoneQ = query(collection(db, 'customers'), where('phone', '==', formData.phone));
        const phoneSnap = await getDocs(phoneQ);
        const duplicatePhone = phoneSnap.docs.find(d => {
          const data = d.data();
          return d.id !== editingId && data.status !== 'inactive' && !data.deletedAt && !data.deleted_at && !data.hidden;
        });
        if (duplicatePhone) {
          toast.error('Số điện thoại này đã tồn tại trong hệ thống!');
          setLoading(false);
          return;
        }
      }

      if (formData.email) {
        const emailQ = query(collection(db, 'customers'), where('email', '==', formData.email));
        const emailSnap = await getDocs(emailQ);
        const duplicateEmail = emailSnap.docs.find(d => {
          const data = d.data();
          return d.id !== editingId && data.status !== 'inactive' && !data.deletedAt && !data.deleted_at && !data.hidden;
        });
        if (duplicateEmail) {
          toast.error('Email này đã tồn tại trong hệ thống!');
          setLoading(false);
          return;
        }
      }

      if (editingId) {
        const batch = writeBatch(db);
        const customerRef = doc(db, 'customers', editingId);
        const dataToSave = { ...formData };
        delete (dataToSave as any).code;
        if (!dataToSave.email) dataToSave.email = null as any;
        if (!dataToSave.phone) dataToSave.phone = null as any;
        delete (dataToSave as any).inChargeStaff;
        delete (dataToSave as any).customerGroup;
        delete (dataToSave as any).customerSource;
        delete (dataToSave as any).totalDebt;

        batch.update(customerRef, {
          ...dataToSave,
          birthDate: formData.birthDate || null,
          status: formData.status || 'active',
          updatedAt: serverTimestamp()
        });

        const ordersQ = query(collection(db, 'orders'), where('customerId', '==', editingId));
        const ordersSnap = await getDocs(ordersQ);
        ordersSnap.docs.forEach(docSnap => {
           batch.update(docSnap.ref, {
               customerName: formData.name,
               customerPhone: formData.phone || '',
               updatedAt: serverTimestamp()
           });
        });

        await batch.commit();
      } else {
        const dataToSave = { ...formData };
        delete (dataToSave as any).code;
        if (!dataToSave.email) dataToSave.email = null as any;
        if (!dataToSave.phone) dataToSave.phone = null as any;
        delete (dataToSave as any).inChargeStaff;
        delete (dataToSave as any).customerGroup;
        delete (dataToSave as any).customerSource;
        delete (dataToSave as any).totalDebt;

        const docRef = await addDoc(collection(db, 'customers'), {
          ...dataToSave,
          birthDate: formData.birthDate || null,
          status: 'active',
          totalSpend: 0,
          orderCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        if (createOrderNow) {
           navigate('/orders', { state: { autoCreateOrderForCustomer: docRef.id } });
        }
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Save customer error:', error);
      alert('Lỗi khi lưu thông tin khách hàng! ' + (error?.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      gender: '',
      birthDate: '',
      note: '',
      status: 'active',
      totalSpend: 0,
      orderCount: 0,
      tier: 'bronze',
      referredById: '',
      customerSource: '',
      customerGroup: ''
    });
    setReferrerSearchTerm('');
    setEditingId(null);
    setCreateOrderNow(false);
  };

  const openEdit = (customer: Customer) => {
    setFormData({
      code: (customer as any).code || '',
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      gender: customer.gender || '',
      birthDate: customer.birthDate || '',
      note: customer.note || '',
      status: customer.status || 'active',
      totalSpend: customer.totalSpend,
      orderCount: customer.orderCount,
      tier: customer.tier,
      referredById: (customer as any).referredById || '',
      customerSource: (customer as any).customerSource || '',
      customerGroup: (customer as any).customerGroup || ''
    });
    const refId = (customer as any).referredById;
    if (refId) {
       const refCust = rawCustomers.find(c => c.id === refId);
       setReferrerSearchTerm(refCust ? `${refCust.name} - ${refCust.phone}` : '');
    } else {
       setReferrerSearchTerm('');
    }
    setEditingId(customer.id!);
    setIsModalOpen(true);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'diamond': return 'bg-cyan-100 text-cyan-600 border-cyan-200';
      case 'gold': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'silver': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-orange-100 text-orange-600 border-orange-200';
    }
  };

  const getFilteredOrders = (cId?: string, isCard?: boolean) => {
     if (!cId) return [];
     return allOrders.filter(o => {
         if (o.customerId !== cId) return false;
         if (o.status === 'cancelled') return false;
         if (dateRange.startDate && dateRange.endDate) {
             const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
             return od >= dateRange.startDate && od <= dateRange.endDate;
         }
         return true;
     });
  };

  const filtered = useMemo(() => {
     const term = searchTerm.toLowerCase();
     let result = rawCustomers.filter(c => {
       const matchesSearch = term === '' || 
           (c.name && c.name.toLowerCase().includes(term)) || 
           (c.phone && c.phone.includes(term)) || 
           (c.email && c.email.toLowerCase().includes(term)) ||
           (c.id && c.id.toLowerCase().includes(term)) ||
           (c.code && c.code.toLowerCase().includes(term));
                             
       if (!matchesSearch) return false;
       
       if (customerGroupFilter && c.tier !== customerGroupFilter) return false;
       if (customerSourceFilter && c.customerSource !== customerSourceFilter) return false;
       if (customerStatusFilter && c.status !== customerStatusFilter) return false;

       // Default: 'all' filter shows all matching search without date limits
       if (statFilter === 'all') return true;

       if (dateRange.startDate && dateRange.endDate) {
          const cd = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
          const isCreatedInRange = cd ? (cd >= dateRange.startDate && cd <= dateRange.endDate) : false;
          const hasOrderInRange = getFilteredOrders(c.id).length > 0;
          
          if (statFilter === 'new') return isCreatedInRange;
          if (statFilter === 'old') return !isCreatedInRange && hasOrderInRange;
          if (statFilter === 'unpaid') {
              const orders = getFilteredOrders(c.id);
              return orders.some((o: Order) => typeof o.totalAmount === 'number' && o.totalAmount > (o.amountGiven || 0));
          }
       }
       
       return true;
     });

     const unique = new Map<string, any>();
     result.forEach(c => {
         const key = c.id;
         if (!unique.has(key)) {
             unique.set(key, c);
         }
     });

     const items = Array.from(unique.values());
     
     // Sort by spending in the selected datarange
     items.sort((a, b) => {
         const spendA = getFilteredOrders(a.id, true).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
         const spendB = getFilteredOrders(b.id, true).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
         return spendB - spendA;
     });

     return items;
  }, [rawCustomers, searchTerm, customerGroupFilter, customerSourceFilter, customerStatusFilter, dateRange, allOrders, statFilter]);

  const headerStats = useMemo(() => {
     let totalCustomers = rawCustomers.length;
     let newCustomers = 0;
     let oldCustomersWithOrders = 0;
     let totalSpend = 0;
     let totalUnpaid = 0;
     let totalOrders = 0;
     let totalReferrers = new Set();
     let totalReferred = 0;

     if (dateRange.startDate && dateRange.endDate) {
         rawCustomers.forEach(c => {
             const cd = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
             const isCreatedInRange = cd ? (cd >= dateRange.startDate && cd <= dateRange.endDate) : false;
             
             if (isCreatedInRange) {
                 newCustomers++;
             } else {
                 const hasOrderInRange = getFilteredOrders(c.id).length > 0;
                 if (hasOrderInRange) oldCustomersWithOrders++;
             }
             
             if (c.referredById) {
                 totalReferred++;
                 totalReferrers.add(c.referredById);
             }
         });

         allOrders.forEach(o => {
             if (o.status === 'cancelled') return;
             const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
             if (od >= dateRange.startDate! && od <= dateRange.endDate!) {
                 totalOrders++;
                 if (o.status === 'paid') totalSpend += (o.totalAmount || 0);
                 else if (['unpaid', 'pending', 'debt'].includes(o.status || '')) totalUnpaid += (o.totalAmount || 0);
             }
         });

     } else {
         newCustomers = totalCustomers;
         rawCustomers.forEach(c => {
             if (c.referredById) {
                 totalReferred++;
                 totalReferrers.add(c.referredById);
             }
         });
         allOrders.forEach(o => {
             if (o.status === 'cancelled') return;
             totalOrders++;
             if (o.status === 'paid') totalSpend += (o.totalAmount || 0);
             else if (['unpaid', 'pending', 'debt'].includes(o.status || '')) totalUnpaid += (o.totalAmount || 0);
         });
     }
     
     // Calculate customers with debt
     let customersWithDebt = 0;
     rawCustomers.forEach(c => {
         const customerOrders = getFilteredOrders(c.id, true);
         const debt = customerOrders.filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
         if (debt > 0) customersWithDebt++;
     });

     return { totalCustomers, newCustomers, oldCustomersWithOrders, totalSpend, totalUnpaid, totalOrders, customersWithDebt, totalReferrers: totalReferrers.size, totalReferred };
  }, [rawCustomers, allOrders, dateRange]);

  const handleDelete = (e: React.MouseEvent | any, customer: Customer) => {
    if (e && e.stopPropagation) {
       e.stopPropagation();
    }
    setDeleteConfirm({ isOpen: true, customer });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ isOpen: true, customer: null, isBulk: true });
  };

  const executeDeleteCustomer = async () => {
    if (deleteConfirm.isBulk) {
      if (selectedIds.length === 0) return;
      try {
        let deleted = 0;
        for (const id of selectedIds) {
           const customer = customers.find(c => c.id === id);
           if (!customer) continue;
           await updateDoc(doc(db, 'customers', id), {
              deleted_at: serverTimestamp(),
              deletedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
           });
           deleted++;
        }
        toast.success(`Đã xóa mềm ${deleted} khách hàng`);
        setSelectedIds([]);
      } catch (error) {
        toast.error('Lỗi khi xóa nhiều!');
        console.error(error);
      } finally {
        setDeleteConfirm({ isOpen: false, customer: null });
      }
      return;
    }

    const customer = deleteConfirm.customer;
    if (!customer) return;

    try {
        await updateDoc(doc(db, 'customers', customer.id!), {
            deleted_at: serverTimestamp(),
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        toast.success('Đã xóa khách hàng thành công');
    } catch (error) {
        toast.error('Lỗi khi xóa khách hàng!');
        console.error(error);
    } finally {
        setDeleteConfirm({ isOpen: false, customer: null });
    }
  };

  return (
    <div className="space-y-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="w-full lg:w-auto">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Tất cả khách hàng</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý thông tin và lịch sử giao dịch của tất cả khách hàng</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto pb-2 lg:pb-0">
           {selectedIds.length > 0 && canEdit && (
             <button
               onClick={handleBulkDelete}
               className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-rose-50 text-rose-600 rounded-lg font-bold text-sm hover:bg-rose-100 transition-all shadow-sm active:scale-95"
             >
               <Trash2 className="w-4 h-4" />
               Xóa {selectedIds.length} <span className="hidden sm:inline">mục</span>
             </button>
           )}
           <div className="hidden lg:block"><DateFilter /></div>
           <div className="flex gap-2">
               <button 
                 onClick={() => {/* ... excel export ... */}}
                 className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all shadow-sm shrink-0"
               >
                 <Download className="w-4 h-4 shrink-0" />
                 <span className="hidden sm:inline">Xuất Excel</span>
               </button>
               <button 
                 onClick={() => {/* ... pdf export ... */}}
                 className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all shadow-sm shrink-0"
               >
                 <FileText className="w-4 h-4 shrink-0" />
                 <span className="hidden sm:inline">Xuất PDF</span>
               </button>
               <button 
                 onClick={() => {/* ... print ... */}}
                 className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all shadow-sm shrink-0"
               >
                 <Printer className="w-4 h-4 shrink-0" />
                 <span className="hidden sm:inline">In</span>
               </button>
               <button 
                 onClick={() => {/* ... excel import ... */}}
                 className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all shadow-sm shrink-0"
               >
                 <Upload className="w-4 h-4 shrink-0" />
                 <span className="hidden sm:inline">Import Excel</span>
               </button>
               {canEdit && (
                 <button 
                   onClick={handleSyncCRM}
                   disabled={syncing}
                   title="Đồng bộ lại toàn bộ dữ liệu CRM từ Đơn hàng"
                   className="flex items-center justify-center p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 transition-all shadow-sm disabled:opacity-50 shrink-0"
                 >
                   {syncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <History className="w-4 h-4 shrink-0" />}
                 </button>
               )}
           </div>
           {canEdit && (
             <button 
               onClick={() => { resetForm(); setIsModalOpen(true); }}
               className="flex flex-1 md:flex-none items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
             >
               <Plus className="w-4 h-4" />
               Thêm khách hàng
             </button>
           )}
        </div>
      </div>

      {/* Header Stats view */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <button 
           onClick={() => setStatFilter('all')}
           className={cn("text-left p-4 rounded-xl border transition-all flex flex-col justify-between", statFilter === 'all' ? "bg-white border-blue-200 ring-1 ring-blue-500 shadow-sm" : "bg-white border-slate-200 hover:border-blue-200")}
        >
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Tổng KH</p>
             <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-500">
                 <Users className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-slate-900">{headerStats.totalCustomers.toLocaleString('vi-VN')}</p>
        </button>
        <button 
           onClick={() => setStatFilter('new')}
           className={cn("text-left p-4 rounded-xl border transition-all flex flex-col justify-between", statFilter === 'new' ? "bg-white border-emerald-200 ring-1 ring-emerald-500 shadow-sm" : "bg-white border-slate-200 hover:border-emerald-200")}
        >
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">KH mới</p>
             <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-500">
                 <Users className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-slate-900">{headerStats.newCustomers.toLocaleString('vi-VN')}</p>
        </button>
        <button 
           onClick={() => setStatFilter('old')}
           className={cn("text-left p-4 rounded-xl border transition-all flex flex-col justify-between", statFilter === 'old' ? "bg-white border-amber-200 ring-1 ring-amber-500 shadow-sm" : "bg-white border-slate-200 hover:border-amber-200")}
        >
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">KH cũ</p>
             <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center text-amber-500">
                 <Award className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-slate-900">{headerStats.oldCustomersWithOrders.toLocaleString('vi-VN')}</p>
        </button>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Doanh thu</p>
           </div>
           <p className="text-xl font-bold text-emerald-600">{formatCurrency(headerStats.totalSpend)}</p>
        </div>
        <button 
           onClick={() => setStatFilter('unpaid')}
           className={cn("text-left p-4 rounded-xl border transition-all flex flex-col justify-between", statFilter === 'unpaid' ? "bg-white border-rose-200 ring-1 ring-rose-500 shadow-sm" : "bg-white border-slate-200 hover:border-rose-200")}
        >
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Công nợ</p>
             <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center text-rose-500">
                 <ClipboardList className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-rose-600">{formatCurrency(headerStats.totalUnpaid)}</p>
        </button>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">KH Giới thiệu</p>
             <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center text-purple-500">
                 <Users className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-slate-900">{headerStats.totalReferrers.toLocaleString('vi-VN')}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Được giới thiệu</p>
             <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center text-purple-500">
                 <Users className="w-3.5 h-3.5" />
             </div>
           </div>
           <p className="text-xl font-bold text-slate-900">{headerStats.totalReferred.toLocaleString('vi-VN')}</p>
        </div>
      </div>

      {/* Toolbar & Filters */}

      <div className="flex flex-col xl:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-center">
        <div className="relative flex-1 w-full xl:max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, SĐT, email, mã khách hàng..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex gap-3 items-center flex-wrap w-full xl:w-auto ml-auto">
           <select 
              value={customerGroupFilter} 
              onChange={e => setCustomerGroupFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 outline-none"
           >
              <option value="">Nhóm khách hàng</option>
              <option value="VIP">VIP</option>
              <option value="Thân thiết">Thân thiết</option>
              <option value="Thành viên">Thành viên</option>
              <option value="Mới">Mới</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
           </select>
           <select 
              value={customerSourceFilter} 
              onChange={e => setCustomerSourceFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 outline-none"
           >
              <option value="">Nguồn khách hàng</option>
              <option value="Khách hàng cũ">Khách hàng cũ</option>
              <option value="Giới thiệu">Giới thiệu</option>
              <option value="Facebook Ads">Facebook Ads</option>
              <option value="Zalo OA">Zalo OA</option>
              <option value="Website">Website</option>
              <option value="Google Ads">Google Ads</option>
              <option value="TikTok Ads">TikTok Ads</option>
           </select>
           <select 
              value={customerStatusFilter} 
              onChange={e => setCustomerStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 outline-none"
           >
              <option value="">Tình trạng</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm khóa</option>
           </select>
           
           <button className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all">
             <Filter className="w-4 h-4" /> Bộ lọc
           </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4 text-center w-12">
                   <input 
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={(e) => {
                         if (e.target.checked) setSelectedIds(filtered.map(c => c.id!));
                         else setSelectedIds([]);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                   />
                </th>
                <th className="p-4 whitespace-nowrap">MÃ KH</th>
                <th className="p-4 whitespace-nowrap">KHÁCH HÀNG</th>
                <th className="p-4 whitespace-nowrap">LIÊN HỆ</th>
                <th className="p-4 whitespace-nowrap">NGƯỜI GIỚI THIỆU</th>
                <th className="p-4 whitespace-nowrap">HẠNG TV</th>
                <th className="p-4 text-center whitespace-nowrap">TỔNG ĐƠN</th>
                <th className="p-4 text-right whitespace-nowrap">TỔNG CHI TIÊU</th>
                <th className="p-4 text-right whitespace-nowrap">CÔNG NỢ</th>
                <th className="p-4 text-center whitespace-nowrap">ĐIỂM</th>
                <th className="p-4 text-center whitespace-nowrap sticky right-0 bg-slate-50 border-l border-slate-200 z-10 w-24">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-20 text-center text-slate-500">Không có dữ liệu phù hợp</td></tr>
              ) : filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((customer, i) => {
                const totalSpend = getFilteredOrders(customer.id, true).filter(o => o.status === 'paid').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                const totalDebt = getFilteredOrders(customer.id, true).filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                
                return (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 text-center">
                       <input
                         type="checkbox"
                         checked={selectedIds.includes(customer.id!)}
                         onChange={(e) => {
                            if (e.target.checked) setSelectedIds(prev => [...prev, customer.id!]);
                            else setSelectedIds(prev => prev.filter(id => id !== customer.id!));
                         }}
                         className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                       />
                    </td>
                    <td className="p-4">
                       <span className="text-sm font-semibold text-slate-600">{(customer as any).code || customer.id?.slice(-8).toUpperCase()}</span>
                    </td>
                    <td className="p-4 cursor-pointer" onClick={() => { setSelectedCustomer(customer); setCustomerDetailTab('info'); }}>
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0 relative overflow-hidden">
                             {customer.name[0].toUpperCase()}
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                                {['VIP', 'Diamond', 'Platinum'].includes(customer.tier || '') && (
                                   <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">VIP</span>
                                )}
                             </div>
                             {customer.status === 'inactive' && (
                               <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase mt-0.5 inline-block">Khóa</span>
                             )}
                          </div>
                       </div>
                    </td>
                    <td className="p-4">
                       <div className="text-sm text-slate-600 font-medium">{customer.phone || '—'}</div>
                       <div className="text-xs text-slate-400 truncate max-w-[150px]">{customer.email || '—'}</div>
                    </td>
                    <td className="p-4">
                       {customer.referredById ? (() => {
                          const refCust = rawCustomers.find(c => c.id === customer.referredById);
                          return refCust ? (
                             <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 -ml-1 rounded transition-colors" onClick={() => { setSelectedCustomer(refCust); setCustomerDetailTab('info'); }}>
                                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0">{refCust.name[0].toUpperCase()}</div>
                                <span className="text-sm font-semibold text-purple-700">{refCust.name}</span>
                             </div>
                          ) : <span className="text-slate-400 text-sm">—</span>;
                       })() : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="p-4">
                       {customer.tier ? (
                         <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-md border border-blue-100 uppercase">{customer.tier}</span>
                       ) : (
                         <span className="text-slate-400 text-sm">—</span>
                       )}
                    </td>
                    <td className="p-4 text-center">
                       <span className="text-sm font-bold text-slate-700">{getFilteredOrders(customer.id, true).length}</span>
                    </td>
                    <td className="p-4 text-right">
                       <span className="text-sm font-semibold text-slate-700">{formatCurrency(totalSpend)} đ</span>
                    </td>
                    <td className="p-4 text-right">
                       <span className={cn("text-sm font-bold", totalDebt > 0 ? "text-rose-600" : "text-slate-400")}>
                          {totalDebt > 0 ? `${formatCurrency(totalDebt)} đ` : '0 đ'}
                       </span>
                    </td>
                    <td className="p-4 text-center">
                       <span className="text-sm font-bold text-emerald-600">{(customer.points || 0).toLocaleString('vi-VN')}</span>
                    </td>
                    <td className="p-4 text-center sticky right-0 bg-white border-l border-slate-100 group-hover:bg-slate-50 transition-colors">
                       <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setSelectedCustomer(customer); setCustomerDetailTab('info'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Xem 360°">
                             <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={() => openEdit(customer)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Sửa">
                               <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => { setSelectedCustomer(customer); setCustomerDetailTab('orders'); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors hidden xl:block" title="Lịch sử mua hàng">
                             <History className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setSelectedCustomer(customer); setCustomerDetailTab('debt'); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors hidden xl:block" title="Công nợ">
                             <ClipboardList className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={(e) => handleDelete(e, customer)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Xóa">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 bg-slate-50 gap-4">
           <div className="text-sm text-slate-500">
              Hiển thị {Math.min((currentPage - 1) * itemsPerPage + 1, filtered.length)} - {Math.min(currentPage * itemsPerPage, filtered.length)} trong <span className="font-bold text-slate-900">{filtered.length}</span> khách hàng
           </div>
           <div className="flex items-center gap-2">
              <button 
                 disabled={currentPage === 1}
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 className="p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent rounded"
              >
                 <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-1">
                 {Array.from({ length: Math.ceil(filtered.length / itemsPerPage) }).map((_, idx) => {
                    if (
                       idx === 0 || 
                       idx === Math.ceil(filtered.length / itemsPerPage) - 1 || 
                       (idx >= currentPage - 2 && idx <= currentPage)
                    ) {
                       return (
                          <button 
                             key={idx}
                             onClick={() => setCurrentPage(idx + 1)}
                             className={cn("w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors", currentPage === idx + 1 ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white")}
                          >
                             {idx + 1}
                          </button>
                       );
                    } else if (
                       idx === currentPage - 3 || 
                       idx === currentPage + 1
                    ) {
                       return <span key={idx} className="text-slate-400">...</span>;
                    }
                    return null;
                 })}
              </div>

              <button 
                 disabled={currentPage === Math.ceil(filtered.length / itemsPerPage) || filtered.length === 0}
                 onClick={() => setCurrentPage(p => p + 1)}
                 className="p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent rounded"
              >
                 <ChevronRight className="w-5 h-5" />
              </button>
              
              <select 
                 value={itemsPerPage} 
                 onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                 className="ml-4 px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 outline-none"
              >
                 <option value={10}>10 / trang</option>
                 <option value={20}>20 / trang</option>
                 <option value={50}>50 / trang</option>
                 <option value={100}>100 / trang</option>
              </select>
           </div>
        </div>
      </div>

      {/* Action Menu Modal */}
      <AnimatePresence>
        {actionMenuCustomer && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionMenuCustomer(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-8 overflow-hidden text-center">
                 <div className="w-20 h-20 bg-slate-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl font-black italic shadow-lg shadow-slate-900/20 mb-6">
                    {actionMenuCustomer.name[0].toUpperCase()}
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 mb-2 truncate uppercase italic">{actionMenuCustomer.name}</h3>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-8">{actionMenuCustomer.phone}</p>
                 
                 <div className="space-y-3">
                    {(() => {
                        const debt = getFilteredOrders(actionMenuCustomer.id, true).filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                        if (debt > 0) {
                           return (
                              <button 
                                 onClick={() => {
                                    setActionMenuCustomer(null);
                                    navigate('/finances', { state: { action: 'income', category: 'Thu nợ', amount: debt, description: `Thu nợ khách hàng ${actionMenuCustomer.name}` } });
                                 }}
                                 className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                              >
                                 Thanh toán nợ ({formatCurrency(debt)} đ)
                              </button>
                           );
                        }
                        return null;
                     })()}
                    <button 
                       onClick={() => {
                          const id = actionMenuCustomer.id;
                          setActionMenuCustomer(null);
                          navigate('/orders', { state: { autoCreateOrderForCustomer: id } });
                       }}
                       className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                    >
                       Tạo đơn hàng
                    </button>
                    {canEdit && (
                        <button 
                           onClick={() => {
                              const c = actionMenuCustomer;
                              setActionMenuCustomer(null);
                              openEdit(c);
                           }}
                           className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors"
                        >
                           Chỉnh sửa hồ sơ
                        </button>
                    )}
                    {canEdit && (
                        <button 
                           onClick={() => {
                              const c = actionMenuCustomer;
                              setActionMenuCustomer(null);
                              handleDelete({} as any, c);
                           }}
                           className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-100 transition-colors"
                        >
                           Xóa khách hàng
                        </button>
                    )}
                    <button 
                       onClick={() => setActionMenuCustomer(null)}
                       className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-slate-900 transition-colors mt-2"
                    >
                       Đóng
                    </button>
                 </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      {createPortal(
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Minimal Professional Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 border border-slate-200">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Cập nhật hồ sơ khách hàng' : 'Thêm khách hàng mới'}</h2>
                  </div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-slate-50/50">
                <div className="overflow-y-auto custom-scrollbar p-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                     {/* Left Column: Basic Info */}
                     <div className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                           Thông tin cơ bản
                        </h3>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                          <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="Nguyễn Văn A" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="block text-sm font-semibold text-slate-700 mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                             <input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="09xxxxxxxx" />
                           </div>
                           <div>
                             <label className="block text-sm font-semibold text-slate-700 mb-1.5">Giới tính</label>
                             <div className="relative">
                               <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10">
                                 <option value="">Không xác định</option>
                                 <option value="male">Nam</option>
                                 <option value="female">Nữ</option>
                               </select>
                               <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                             </div>
                           </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ngày sinh</label>
                          <input type="date" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none" />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mã khách hàng</label>
                          <input type="text" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="Để trống để tự tạo (VD: KH0001)" />
                        </div>
                     </div>

                     {/* Right Column: Meta Info */}
                     <div className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                           Thông tin liên lạc & Phân loại
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phân hạng</label>
                             <div className="relative">
                               <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: e.target.value as any })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10">
                                 <option value="bronze">Thành viên Đồng</option>
                                 <option value="silver">Thành viên Bạc</option>
                                 <option value="gold">Thành viên Vàng</option>
                                 <option value="diamond">Khách VIP</option>
                               </select>
                               <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                             </div>
                           </div>
                           <div>
                             <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                             <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none placeholder:text-slate-400" placeholder="email@example.com" />
                           </div>
                        </div>

                        <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nguồn khách hàng</label>
                           <div className="relative">
                             <select 
                                value={(!['', 'Giới thiệu', 'Facebook Ads', 'Zalo OA', 'Website', 'Google Ads', 'TikTok Ads'].includes(formData.customerSource || '') && formData.customerSource) ? 'Khác' : (formData.customerSource || '')} 
                                onChange={e => {
                                   if (e.target.value === 'Khác') {
                                      setFormData({ ...formData, customerSource: 'Nguồn khác' });
                                   } else {
                                      setFormData({ ...formData, customerSource: e.target.value });
                                   }
                                }} 
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none pr-10"
                             >
                               <option value="">Chưa phân loại</option>
                               <option value="Giới thiệu">Người giới thiệu</option>
                               <option value="Facebook Ads">Facebook Ads</option>
                               <option value="Zalo OA">Zalo OA</option>
                               <option value="Website">Website</option>
                               <option value="Google Ads">Google Ads</option>
                               <option value="TikTok Ads">TikTok Ads</option>
                               <option value="Khác">Khác (Nhập tay)</option>
                             </select>
                             <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                           </div>
                           {(!['', 'Giới thiệu', 'Facebook Ads', 'Zalo OA', 'Website', 'Google Ads', 'TikTok Ads'].includes(formData.customerSource || '') && formData.customerSource) && (
                             <input 
                                type="text" 
                                value={formData.customerSource}
                                onChange={e => setFormData({ ...formData, customerSource: e.target.value })}
                                placeholder="Nhập tên nguồn khách hàng..." 
                                className="w-full mt-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none"
                             />
                           )}
                        </div>

                        <div className="relative" ref={referrerDropdownRef}>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Người giới thiệu</label>
                          <div className="relative">
                             <input 
                                type="text" 
                                placeholder="Tìm theo tên hoặc SĐT..." 
                                value={referrerSearchTerm}
                                onChange={(e) => {
                                   setReferrerSearchTerm(e.target.value);
                                   setIsReferrerDropdownOpen(true);
                                   if (e.target.value === '') setFormData({ ...formData, referredById: '' });
                                }}
                                onClick={() => setIsReferrerDropdownOpen(true)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none pr-10 placeholder:text-slate-400"
                             />
                             <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>

                          <AnimatePresence>
                             {isReferrerDropdownOpen && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-48 overflow-y-auto">
                                   {filteredReferrers.length === 0 ? (
                                      <div className="p-4 text-center text-sm text-slate-500">Không tìm thấy khách hàng.</div>
                                   ) : (
                                      <ul className="py-1">
                                         {filteredReferrers.map(c => (
                                            <li 
                                              key={c.id} 
                                              onClick={() => {
                                                 setFormData({ ...formData, referredById: c.id });
                                                 setReferrerSearchTerm(`${c.name} - ${c.phone}`);
                                                 setIsReferrerDropdownOpen(false);
                                              }}
                                              className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"
                                            >
                                               <span className="font-medium text-slate-900 text-sm truncate">{c.name}</span>
                                               <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">{c.phone}</span>
                                            </li>
                                         ))}
                                      </ul>
                                   )}
                                </motion.div>
                             )}
                          </AnimatePresence>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ghi chú & Địa chỉ</label>
                          <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-t-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none resize-none placeholder:text-slate-400" placeholder="Địa chỉ thường trú..." />
                          <textarea rows={2} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 border-t-0 rounded-b-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none resize-none placeholder:text-slate-400" placeholder="Ghi chú thêm (dị ứng, sở thích...)" />
                        </div>
                     </div>
                  </div>

                  {!editingId && (
                     <div className="mt-8 pt-6 border-t border-slate-200">
                       <label className="flex items-center gap-3 cursor-pointer group w-fit">
                          <div className={cn("w-10 h-5 rounded-full transition-colors relative flex items-center shadow-inner", createOrderNow ? "bg-blue-600" : "bg-slate-300")}>
                             <div className={cn("w-4 h-4 bg-white rounded-full shadow-sm absolute transition-all transform", createOrderNow ? "left-[22px]" : "left-0.5")} />
                          </div>
                          <input type="checkbox" className="hidden" checked={createOrderNow} onChange={(e) => setCreateOrderNow(e.target.checked)} />
                          <div>
                             <span className="font-semibold text-sm text-slate-900 block group-hover:text-blue-600 transition-colors">Tạo đơn hàng ngay</span>
                             <span className="text-xs text-slate-500">Chuyển sang màn hình tạo đơn sau khi lưu</span>
                          </div>
                       </label>
                     </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm">
                    Hủy bỏ
                  </button>
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingId ? 'Lưu thay đổi' : 'Hoàn tất đăng ký'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Customer Details Drawer */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCustomer(null)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
              <div className="p-4 sm:p-8 border-b border-slate-50 flex flex-wrap sm:flex-nowrap items-center justify-between shrink-0 gap-4">
                <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
                   <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 rounded-xl sm:rounded-[20px] flex shrink-0 items-center justify-center text-white">
                    <History className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tighter italic truncate">Hồ sơ khách hàng</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-0.5 sm:mt-1 truncate">
                       {(selectedCustomer as any).code || `KH-${selectedCustomer.id?.slice(-6).toUpperCase()}`} - {selectedCustomer.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                  <button 
                     onClick={() => {
                        navigate('/orders', { state: { autoCreateOrderForCustomer: selectedCustomer.id } });
                     }}
                     className="px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-600 text-white rounded-lg sm:rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                     Tạo đơn hàng
                  </button>
                  <button onClick={() => setSelectedCustomer(null)} className="p-2 sm:p-3 hover:bg-slate-50 rounded-lg sm:rounded-2xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Header Loyalty Overview */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Hạng thành viên</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-lg border font-black uppercase", getTierColor(selectedCustomer.tier))}>{selectedCustomer.tier || 'Member'}</span>
                 </div>
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Điểm hiện tại</p>
                    <p className="text-sm font-black text-emerald-600">{(selectedCustomer.points || 0).toLocaleString()} <span className="text-[9px] text-emerald-400">đ</span></p>
                 </div>
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Điểm đã dùng</p>
                    <p className="text-sm font-black text-rose-600">{(selectedCustomer.usedPoints || 0).toLocaleString()} <span className="text-[9px] text-rose-400">đ</span></p>
                 </div>
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tổng chi tiêu</p>
                    <p className="text-sm font-black text-blue-600">{formatCurrency(selectedCustomer.totalSpend || 0)}</p>
                 </div>
              </div>

              <div className="flex px-4 sm:px-8 border-b border-slate-100 bg-white gap-6 overflow-x-auto custom-scrollbar">
                 <button onClick={() => setCustomerDetailTab('info')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'info' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Thông tin</button>
                 <button onClick={() => setCustomerDetailTab('orders')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'orders' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Đơn hàng</button>
                 <button onClick={() => setCustomerDetailTab('payment')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'payment' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Thanh toán</button>
                 <button onClick={() => setCustomerDetailTab('debt')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'debt' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Công nợ</button>
                 <button onClick={() => setCustomerDetailTab('points')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'points' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Điểm</button>
                 <button onClick={() => setCustomerDetailTab('logs')} className={cn("py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap", customerDetailTab === 'logs' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700")}>Nhật ký</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-10 custom-scrollbar">
                
                {customerDetailTab === 'info' && (
                   <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Thông tin chung</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Mã khách hàng</p>
                               <p className="text-sm font-semibold text-slate-900">{(selectedCustomer as any).code || selectedCustomer.id?.slice(-8).toUpperCase()}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Họ tên</p>
                               <p className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">SĐT</p>
                               <p className="text-sm font-semibold text-slate-900">{selectedCustomer.phone}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Email</p>
                               <p className="text-sm font-semibold text-slate-900">{selectedCustomer.email || '—'}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Sinh nhật</p>
                               <p className="text-sm font-semibold text-slate-900">{(selectedCustomer as any).dob ? formatDate((selectedCustomer as any).dob) : '—'}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Giới tính</p>
                               <p className="text-sm font-semibold text-slate-900">{(selectedCustomer as any).gender === 'male' ? 'Nam' : (selectedCustomer as any).gender === 'female' ? 'Nữ' : '—'}</p>
                            </div>
                         </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Thông tin bổ sung</h3>
                         <div className="grid grid-cols-1 gap-4">
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Địa chỉ</p>
                               <p className="text-sm font-semibold text-slate-900">{selectedCustomer.address || '—'}</p>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 mb-1">Người giới thiệu</p>
                               <p className="text-sm font-semibold text-slate-900">
                                  {selectedCustomer.referredById ? rawCustomers.find(c => c.id === selectedCustomer.referredById)?.name || '—' : '—'}
                               </p>
                            </div>
                         </div>
                      </div>
                   </div>
                )}

                {customerDetailTab === 'orders' && (
                   <>
                     {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div onClick={() => setCustomerHistoryFilter('paid')} className={cn("p-3 sm:p-6 rounded-xl sm:rounded-[32px] cursor-pointer transition-all border flex flex-col justify-center items-center text-center", customerHistoryFilter === 'paid' ? "bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/20" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50")}>
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest sm:tracking-[0.2em] opacity-80 mb-1 sm:mb-2 truncate w-full">Đã T.Toán</p>
                    <p className="text-sm sm:text-lg font-black italic truncate w-full" title={formatCurrency(customerOrders.filter(o => !o.deletedAt && o.status === 'paid').reduce((sum, o) => sum + (o.totalAmount || 0), 0))}>
                       {formatCurrency(customerOrders.filter(o => !o.deletedAt && o.status === 'paid').reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
                    </p>
                  </div>
                  <div onClick={() => setCustomerHistoryFilter('unpaid')} className={cn("p-3 sm:p-6 rounded-xl sm:rounded-[32px] cursor-pointer transition-all border flex flex-col justify-center items-center text-center", customerHistoryFilter === 'unpaid' ? "bg-rose-500 text-white border-transparent shadow-lg shadow-rose-500/20" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50")}>
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest sm:tracking-[0.2em] opacity-80 mb-1 sm:mb-2 truncate w-full">Chưa T.Toán</p>
                    <p className="text-sm sm:text-lg font-black italic truncate w-full" title={formatCurrency(customerOrders.filter(o => !o.deletedAt && ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0))}>
                       {formatCurrency(customerOrders.filter(o => !o.deletedAt && ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
                    </p>
                  </div>
                  <div onClick={() => setCustomerHistoryFilter('all')} className={cn("p-3 sm:p-6 rounded-xl sm:rounded-[32px] cursor-pointer transition-all border flex flex-col justify-center items-center text-center", customerHistoryFilter === 'all' ? "bg-blue-600 text-white border-transparent shadow-lg shadow-blue-500/20" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50")}>
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest sm:tracking-[0.2em] opacity-80 mb-1 sm:mb-2 truncate w-full">Tổng đơn</p>
                    <p className="text-sm sm:text-lg font-black italic truncate w-full">{customerOrders.filter(o => !o.deletedAt && o.status !== 'cancelled').length} <span className="text-[8px] sm:text-xs not-italic font-bold opacity-50 text-current">LẦN</span></p>
                  </div>
                </div>

                {/* History List */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 flex items-center justify-between">
                    Nhật ký giao dịch
                  </h3>
                  
                  {loadingOrders ? (
                    <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-200" /></div>
                  ) : customerOrders.length === 0 ? (
                    <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200 text-slate-300 font-bold uppercase tracking-widest text-[9px]">Chưa có lịch sử giao dịch</div>
                  ) : (
                    <div className="space-y-4">
                      {customerOrders.filter(o => {
                         if (customerHistoryFilter === 'paid') return o.status === 'paid';
                         if (customerHistoryFilter === 'unpaid') return ['unpaid', 'pending', 'debt'].includes(o.status || '');
                         return o.status !== 'cancelled';
                      }).map(order => (
                         <div key={order.id} onClick={() => setViewingOrder(order)} className={cn("p-4 sm:p-6 bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] transition-all flex flex-col gap-4 cursor-pointer", order.deletedAt ? "opacity-50 grayscale" : "hover:shadow-xl group")}>
                           <div className="flex items-start sm:items-center justify-between gap-2">
                             <div className="flex items-center gap-2 sm:gap-4 shrink-0 max-w-[60%]">
                               <div className="w-8 h-8 sm:w-12 sm:h-12 bg-slate-50 rounded-lg sm:rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                                 <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6" />
                               </div>
                               <div className="min-w-0">
                                 <p className="font-black text-slate-900 text-[10px] sm:text-xs uppercase flex flex-wrap items-center gap-1 sm:gap-2 truncate">
                                     #TX-{order.id?.slice(-6).toUpperCase()}
                                     {order.paymentMethod && (
                                       <span className="bg-slate-100 text-slate-500 px-1 sm:px-1.5 py-0.5 rounded text-[8px] whitespace-nowrap">
                                          {order.paymentMethod === 'cash' ? 'Tiền mặt' : 'CK'}
                                       </span>
                                     )}
                                 </p>
                                 <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 flex items-center gap-1 truncate">{order.createdAt ? formatDate(order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt)) : '...'}</p>
                                 {order.creatorName && (
                                     <p className="text-[8px] text-slate-400 font-medium mt-0.5 sm:mt-1 uppercase truncate">NV: {order.creatorName}</p>
                                 )}
                               </div>
                             </div>
                             <div className="text-right shrink-0">
                               <p className="font-black text-slate-900 text-xs sm:text-sm whitespace-nowrap">{formatCurrency(order.totalAmount)}</p>
                               <div className={cn(
                                 "text-[8px] font-black uppercase tracking-widest sm:tracking-[0.2em] mt-1 px-1.5 sm:px-2 py-0.5 rounded-full inline-block text-center",
                                 order.deletedAt ? "bg-rose-100 text-rose-600" :
                                 order.status === 'paid' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                               )}>
                                 {order.deletedAt ? "Đã xóa" : (order.status === 'paid' ? 'Đã T.Toán' : 'Chưa T.Toán')}
                               </div>
                             </div>
                           </div>
                           {(order.items && order.items.length > 0) && (
                               <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100 mt-2">
                                  <table className="w-full text-[10px] sm:text-xs table-fixed">
                                     <colgroup>
                                       <col className="w-full" />
                                       <col className="w-10 sm:w-16" />
                                       <col className="w-20 sm:w-28" />
                                     </colgroup>
                                     <tbody>
                                         {order.items.map((item, idx) => (
                                              <tr key={idx}>
                                                 <td className="py-1 sm:py-1.5 text-slate-600 font-medium truncate pr-2">
                                                    <span className={cn(
                                                       "text-[8px] px-1 py-0.5 rounded mr-1.5 sm:mr-2 uppercase inline-block",
                                                       item.type === 'product' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                    )}>
                                                        {item.type === 'product' ? 'SP' : 'DV'}
                                                    </span>
                                                    {item.name}
                                                 </td>
                                                 <td className="py-1 sm:py-1.5 text-slate-500 font-bold px-1 sm:px-2 text-center whitespace-nowrap text-[9px] sm:text-[11px]">x{item.quantity}</td>
                                                 <td className="py-1 sm:py-1.5 text-slate-900 font-black text-right whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</td>
                                              </tr>
                                         ))}
                                     </tbody>
                                  </table>
                               </div>
                           )}
                           
                           {order.note && (
                               <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-xl border border-amber-100">
                                  <span className="font-bold uppercase tracking-widest text-[9px] block mb-1">Ghi chú</span>
                                  {order.note}
                               </div>
                           )}
                           
                           {order.deletedAt && (
                               <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/50 flex flex-col gap-1 mt-2">
                                   <div className="text-[10px] font-bold text-rose-600">
                                       <span className="opacity-70">Xóa lúc:</span> {formatDate(order.deletedAt.toDate ? order.deletedAt.toDate() : new Date(order.deletedAt))}
                                   </div>
                                   <div className="text-[10px] font-bold text-rose-600">
                                       <span className="opacity-70">Bởi:</span> {order.deletedBy || '—'}
                                   </div>
                               </div>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                   </>
                )}

                {customerDetailTab === 'payment' && (
                   <div className="space-y-6">
                      <div className="bg-slate-50 p-12 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                         <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <CreditCard className="w-8 h-8" />
                         </div>
                         <h3 className="text-sm font-bold text-slate-900 mb-2">Lịch sử thanh toán</h3>
                         <p className="text-xs text-slate-500 max-w-xs">Tính năng chi tiết theo dõi dòng tiền thanh toán của khách hàng đang được nâng cấp.</p>
                      </div>
                   </div>
                )}

                {customerDetailTab === 'debt' && (
                   <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex flex-col justify-between">
                            <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2">Tổng nợ hiện tại</p>
                            <p className="text-3xl font-black text-rose-600">{formatCurrency(customerOrders.filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).reduce((sum, o) => sum + (o.totalAmount || 0), 0))} đ</p>
                         </div>
                         <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between cursor-pointer hover:bg-slate-100 transition-colors">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Thanh toán công nợ</p>
                            <div className="flex items-center gap-2 text-blue-600 font-bold">
                               <Plus className="w-5 h-5" /> Tạo phiếu thu
                            </div>
                         </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                         <div className="px-6 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900">Chi tiết công nợ theo đơn</h3>
                         </div>
                         <div className="divide-y divide-slate-100">
                            {customerOrders.filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).map(o => (
                               <div key={o.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                  <div>
                                     <p className="font-bold text-slate-900 text-sm">Đơn hàng {o.id.slice(0,8).toUpperCase()}</p>
                                     <p className="text-xs text-slate-500 mt-1">{formatDate(o.createdAt)}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="font-bold text-rose-600">{formatCurrency(o.totalAmount)} đ</p>
                                     <p className="text-xs text-rose-400 mt-1">Chưa thanh toán</p>
                                  </div>
                               </div>
                            ))}
                            {customerOrders.filter(o => ['unpaid', 'pending', 'debt'].includes(o.status || '')).length === 0 && (
                               <div className="p-8 text-center text-slate-500 text-sm">Khách hàng không có công nợ</div>
                            )}
                         </div>
                      </div>
                   </div>
                )}

                {customerDetailTab === 'points' && (
                   <div className="space-y-4">
                     {loyaltyLogs.length === 0 ? (
                        <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200 text-slate-300 font-bold uppercase tracking-widest text-[9px]">Chưa có lịch sử điểm</div>
                     ) : (
                        loyaltyLogs.map(log => (
                           <div key={log.id} className="p-4 sm:p-6 bg-white border border-slate-100 rounded-[24px] sm:rounded-[32px] flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-4 min-w-0">
                                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
                                    log.type === 'earn' || log.type === 'referral' ? "bg-emerald-50 text-emerald-600" :
                                    log.type === 'redeem' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                 )}>
                                    <Star className="w-5 h-5" />
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{log.reason}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                       {log.type === 'earn' ? 'Tích điểm' : log.type === 'redeem' ? 'Sử dụng' : log.type === 'refund' ? 'Hoàn lại' : 'Hết hạn'} • {log.createdAt ? formatDate(log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt)) : ''}
                                    </p>
                                    {log.orderId && <p className="text-[9px] text-blue-500 font-bold mt-0.5">Mã đơn: #TX-{log.orderId.slice(-6).toUpperCase()}</p>}
                                 </div>
                              </div>
                              <div className={cn("text-lg font-black shrink-0", 
                                 log.type === 'earn' || log.type === 'referral' ? "text-emerald-600" : "text-rose-600"
                              )}>
                                 {log.type === 'earn' || log.type === 'referral' ? '+' : '-'}{log.points} đ
                              </div>
                           </div>
                        ))
                     )}
                   </div>
                )}

                {customerDetailTab === 'logs' && (
                   <div className="space-y-4">
                      <div className="bg-slate-50 p-12 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                         <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mb-4">
                            <History className="w-8 h-8" />
                         </div>
                         <h3 className="text-sm font-bold text-slate-900 mb-2">Nhật ký hoạt động</h3>
                         <p className="text-xs text-slate-500 max-w-xs">Mọi thao tác, lịch sử tương tác và thay đổi thông tin của khách hàng sẽ được hiển thị tại đây.</p>
                      </div>
                   </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Viewing Order Details Drawer */}
      <AnimatePresence>
        {viewingOrder && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingOrder(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-[70] flex flex-col">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-[16px] flex items-center justify-center text-white">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Chi tiết hóa đơn</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">#TX-{viewingOrder.id?.slice(-6).toUpperCase()}</p>
                  </div>
                </div>
                <button onClick={() => setViewingOrder(null)} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Status Indicator */}
                <div className="flex gap-2">
                   <div className={cn("flex-1 p-4 rounded-2xl border flex items-center justify-center font-black uppercase text-[10px] tracking-widest", viewingOrder.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100')}>
                      {viewingOrder.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                   </div>
                   {viewingOrder.status === 'paid' && (
                     <div className="flex-1 p-4 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl flex items-center justify-center font-black uppercase text-[10px] tracking-widest">
                       {viewingOrder.paymentMethod === 'cash' ? 'Tiền mặt' : viewingOrder.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thanh toán'}
                     </div>
                   )}
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Danh sách sản phẩm/dịch vụ</h3>
                  <div className="space-y-3">
                    {viewingOrder.items.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                          {item.type === 'service' ? <Sparkles className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-xs text-slate-900 uppercase tracking-tight">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className={cn("text-[7px] font-black px-1 py-0.5 rounded", item.type === 'product' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600")}>
                               {item.type === 'product' ? 'PRODUCT' : 'SERVICE'}
                             </span>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">{formatCurrency(item.price)} × {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {viewingOrder.note && (
                  <div className="space-y-3">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú</h3>
                     <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100 text-xs shadow-inner">
                       {viewingOrder.note}
                     </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="p-8 bg-slate-900 rounded-[32px] text-white space-y-4 shadow-xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                      <span>Tiền hàng</span>
                      <span className="text-slate-300">{formatCurrency(viewingOrder.totalAmount + (viewingOrder.discount || 0) - (viewingOrder.shippingFee || 0))}</span>
                    </div>
                    {viewingOrder.discount > 0 && (
                       <div className="flex items-center justify-between text-rose-400 font-bold uppercase tracking-widest text-[9px]">
                         <span>Giảm giá</span>
                         <span>- {formatCurrency(viewingOrder.discount)}</span>
                       </div>
                    )}
                    {viewingOrder.shippingFee > 0 && (
                       <div className="flex items-center justify-between text-blue-400 font-bold uppercase tracking-widest text-[9px]">
                         <span>Phí vận tải</span>
                         <span>+ {formatCurrency(viewingOrder.shippingFee)}</span>
                       </div>
                    )}
                  </div>
                  <div className="h-px bg-white/10 my-4"></div>
                  <div className="flex items-center justify-between gap-4">
                     <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Tổng thanh toán</p>
                       <h4 className="text-3xl font-black tracking-tighter mt-1 italic">{formatCurrency(viewingOrder.totalAmount)}</h4>
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa khách hàng"
        message={deleteConfirm.customer?.orderCount ? 'Khách hàng này đã có giao dịch mua sắm. Khách hàng sẽ được ẩn đi thay vì xóa hoàn toàn.' : 'Bạn có chắc chắn muốn xóa dữ liệu khách hàng này? Thao tác không thể hoàn tác.'}
        onConfirm={executeDeleteCustomer}
        onCancel={() => setDeleteConfirm({ isOpen: false, customer: null })}
      />
    </div>
  );
}
