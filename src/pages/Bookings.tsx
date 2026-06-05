import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, Booking, Service, UserProfile, handleFirestoreError, OperationType } from '../lib/firebase';
import { PrintBookingTicket } from '../components/printing/PrintBookingTicket';
import { printElement } from '../lib/printUtils';
import { 
  Calendar as CalendarIcon,
  Plus, 
  Search, 
  Filter, 
  X,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Clock,
  User,
  Phone,
  MessageSquare,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  UserCheck,
  LayoutGrid,
  List,
  CheckCircle,
  PlayCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Printer,
  ChevronDown
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';

export function Bookings() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Add customer selection state
  const [customerSearchFocus, setCustomerSearchFocus] = useState(false);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<any | null>(null);
  const [openDropdown, setOpenDropdown] = useState<{ id: string, type: 'status' | 'menu' } | null>(null);

  // Form States
  const [formData, setFormData] = useState<Partial<Booking>>({
    customerName: '',
    customerPhone: '',
    serviceId: '',
    serviceName: '',
    staffId: '',
    staffName: '',
    bookingDate: new Date().toISOString().split('T')[0],
    bookingTime: '',
    notes: '',
    status: 'pending',
    totalAmount: 0
  });

  useEffect(() => {
    if (location.state?.action === 'create') {
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    // Bookings for selected date (or all if we prefer, but date filter is professional)
    const qBookings = query(collection(db, 'bookings'), orderBy('bookingDate', 'desc'), orderBy('bookingTime', 'asc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    const unsubscribeServices = onSnapshot(query(collection(db, 'services'), where('status', '==', 'active')), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    });

    const unsubscribeStaff = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeBookings();
      unsubscribeServices();
      unsubscribeStaff();
      unsubscribeCustomers();
    };
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Find or create customer
      let customerId = '';
      const existingCustomer = customers.find(c => c.phone === formData.customerPhone || c.name === formData.customerName);
      if (existingCustomer) {
         customerId = existingCustomer.id;
      } else {
         const docRef = await addDoc(collection(db, 'customers'), {
            name: formData.customerName || 'Khách hàng mới',
            phone: formData.customerPhone || '',
            email: '',
            address: '',
            tier: 'bronze',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
         });
         customerId = docRef.id;
      }

      const selectedService = services.find(s => s.id === formData.serviceId);
      const selectedStaff = staff.find(st => st.uid === formData.staffId);
      
      const data = {
        ...formData,
        customerId,
        serviceName: selectedService?.name || formData.serviceName || '',
        staffName: selectedStaff?.name || selectedStaff?.email || formData.staffName || '',
        totalAmount: selectedService?.promoPrice || selectedService?.price || formData.totalAmount || 0,
      };

      if (editingId) {
        await updateDoc(doc(db, 'bookings', editingId), { 
           ...data, 
           updatedAt: serverTimestamp() 
        });
      } else {
        await addDoc(collection(db, 'bookings'), {
           ...data,
           createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        customerName: '',
        customerPhone: '',
        serviceId: '',
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: '',
        notes: '',
        status: 'pending'
      });
      setSelectedCustomerInfo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBooking = (booking: Booking) => {
     setFormData({
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        staffId: booking.staffId,
        staffName: booking.staffName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        notes: booking.notes || '',
        status: booking.status,
        totalAmount: booking.totalAmount
     });
     setEditingId(booking.id!);
     setIsModalOpen(true);
  };

  const updateBookingStatus = async (id: string, newStatus: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, isBulk?: boolean}>({ isOpen: false, id: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleDeleteBooking = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ isOpen: true, id: '', isBulk: true });
  };

  const executeDeleteBooking = async () => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
          const batch = writeBatch(db);
          let deleted = 0;
          for (const sId of selectedIds) {
             const b = bookings.find(x => x.id === sId);
             batch.delete(doc(db, 'bookings', sId));
             if (b) {
                const logRef = doc(collection(db, 'activity_logs'));
                batch.set(logRef, {
                   action: 'delete_booking',
                   bookingId: sId,
                   customer: b.customerName,
                   amount: b.totalAmount,
                   deletedBy: profile?.email || '',
                   timestamp: serverTimestamp()
                });
             }
             deleted++;
          }
          await batch.commit();
          toast.success(`Đã xóa ${deleted} lịch hẹn thành công.`);
          setSelectedIds([]);
       } catch (error) {
          toast.error("Lỗi khi xóa nhiều mục!");
       } finally {
          setDeleteConfirm({ isOpen: false, id: '' });
       }
       return;
    }

    if (!deleteConfirm.id) return;
    const id = deleteConfirm.id;
    try {
        const b = bookings.find(x => x.id === id);
        
        await deleteDoc(doc(db, 'bookings', id));
        
        // Log activity
        if (b) {
           await addDoc(collection(db, 'activity_logs'), {
              action: 'delete_booking',
              bookingId: id,
              customer: b.customerName,
              amount: b.totalAmount,
              deletedBy: profile?.email || '',
              timestamp: serverTimestamp()
           });
        }
        toast.success("Đã xóa lịch hẹn thành công.");
    } catch(error) {
        toast.error("Lỗi khi xóa!");
        handleFirestoreError(error, OperationType.UPDATE, 'bookings');
    } finally {
        setDeleteConfirm({ isOpen: false, id: '' });
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || b.customerPhone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesDate = b.bookingDate === selectedDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusStyle = (status: Booking['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'confirmed': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'in_progress': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  const getStatusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      case 'confirmed': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'in_progress': return <PlayCircle className="w-3.5 h-3.5 animate-pulse" />;
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'cancelled': return <XCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase italic flex items-center gap-2 md:gap-3">
            <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            Lịch Hẹn & Booking
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">Sắp xếp nhân sự, phòng dịch vụ và tối ưu ca thực hiện.</p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3">
          <button 
            onClick={() => navigate('/users')}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-white text-slate-900 border border-slate-200 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap text-center">Quản lý <br className="md:hidden" />nhân viên</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="whitespace-nowrap text-center">Đặt <br className="md:hidden" />lịch mới</span>
          </button>
        </div>
      </div>

      {/* Booking Dashboard Stats (Today focus) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[
          { label: 'Chờ xác nhận', count: bookings.filter(b => b.status === 'pending' && b.bookingDate === selectedDate).length, color: 'amber', icon: Clock },
          { label: 'Đã xác nhận', count: bookings.filter(b => b.status === 'confirmed' && b.bookingDate === selectedDate).length, color: 'blue', icon: CheckCircle },
          { label: 'Đang làm', count: bookings.filter(b => b.status === 'in_progress' && b.bookingDate === selectedDate).length, color: 'purple', icon: PlayCircle },
          { label: 'Hoàn thành', count: bookings.filter(b => b.status === 'completed' && b.bookingDate === selectedDate).length, color: 'emerald', icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 sm:p-4 md:p-6 rounded-[20px] md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-center">
            <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4 shrink-0", `bg-${stat.color}-50 text-${stat.color}-600`)}>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wide md:tracking-widest whitespace-nowrap overflow-hidden text-ellipsis w-full mb-1">{stat.label}</p>
            <p className="text-xl md:text-3xl font-black text-slate-900">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Calendar & Filters Bar */}
      <div className="bg-white p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4 md:gap-5">
        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 min-h-[48px] shrink-0">
           <input 
              type="checkbox"
              checked={filteredBookings.length > 0 && selectedIds.length === filteredBookings.length}
              onChange={(e) => {
                 if (e.target.checked) setSelectedIds(filteredBookings.map(b => b.id!));
                 else setSelectedIds([]);
              }}
              className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
           />
           <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest lg:hidden">Tất cả</span>
        </label>
        {selectedIds.length > 0 && (
           <button onClick={handleBulkDelete} className="px-4 md:px-6 min-h-[48px] bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 shrink-0">
              <Trash2 className="w-5 h-5" /> Xóa {selectedIds.length} mục
           </button>
        )}
        <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[200px]">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full min-h-[48px] px-4 md:px-5 py-3 md:py-3.5 bg-slate-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-black text-slate-900 text-[10px] md:text-base" 
          />
        </div>
        
        <div className="relative flex-1 w-full flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm theo tên/SĐT..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[48px] pl-10 md:pl-12 pr-4 py-3 md:py-3.5 bg-slate-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-xs md:text-sm"
            />
          </div>
          <div className="relative shrink-0 w-[48px] md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-[48px] md:w-auto h-[48px] md:pl-10 md:pr-8 bg-white border border-slate-100 rounded-xl md:rounded-2xl outline-none font-black text-slate-600 text-[10px] uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors text-transparent md:text-slate-600"
            >
              <option value="all">Tất cả TT</option>
              <option value="pending">Chờ</option>
              <option value="confirmed">Duyệt</option>
              <option value="in_progress">Đang làm</option>
            </select>
            <Filter className="w-4 h-4 md:w-5 md:h-5 absolute left-1/2 md:left-3 top-1/2 -translate-x-1/2 md:translate-x-0 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bookings Timeline/List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-20" /></div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarIcon className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Không có lịch hẹn nào trong ngày này</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredBookings.map((booking) => (
              <motion.div 
                layout
                key={booking.id} 
                className={cn(
                  "bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4 md:gap-6 group hover:border-blue-200 transition-all cursor-pointer relative",
                  booking.status === 'completed' && "opacity-75"
                )}
                onClick={() => handleEditBooking(booking)}
              >
                <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10 bg-white/80 p-0.5 rounded backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                    <input
                       type="checkbox"
                       checked={selectedIds.includes(booking.id!)}
                       onChange={(e) => {
                          if (e.target.checked) setSelectedIds(prev => [...prev, booking.id!]);
                          else setSelectedIds(prev => prev.filter(id => id !== booking.id!));
                       }}
                       className="w-4 h-4 md:w-5 md:h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                    />
                </div>
                <div className="flex items-start md:items-center gap-4 md:gap-6 flex-1 ml-6 md:ml-10">
                  <div className="w-16 md:w-20 py-3 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border border-slate-100 shrink-0">
                    <p className="text-sm md:text-xl font-black text-slate-900 uppercase">{booking.bookingTime}</p>
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Giờ hẹn</p>
                  </div>
                  
                  <div className="space-y-1 md:space-y-1.5 min-w-0 flex-1">
                    <h4 className="text-sm md:text-lg font-black text-slate-900 uppercase italic tracking-tight truncate pr-4">{booking.customerName}</h4>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-slate-500">
                      <span className="text-[10px] md:text-xs font-bold flex items-center gap-1"><Phone className="w-3 h-3 md:w-3.5 md:h-3.5" /> {booking.customerPhone}</span>
                      <span className="text-[10px] md:text-xs font-bold flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md md:rounded-lg"><Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" /> {booking.serviceName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 md:gap-10 border-t border-slate-50 pt-3 md:pt-0 md:border-none pl-6 md:pl-0">
                  <div className="text-left md:text-right flex items-center md:flex-col md:items-end gap-2 md:gap-0">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] md:mb-1">Nhân viên</p>
                    <div className="flex flex-row-reverse md:flex-row items-center gap-1.5 md:gap-2">
                       <p className="text-[10px] md:text-xs font-black text-slate-700">{booking.staffName || 'Chưa gán'}</p>
                       <div className="w-5 h-5 md:w-7 md:h-7 rounded flex items-center justify-center text-slate-400 font-black text-[9px] md:text-[10px] bg-slate-100">
                         {booking.staffName?.[0] || '?'}
                       </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdown(openDropdown?.id === booking.id && openDropdown?.type === 'status' ? null : { id: booking.id!, type: 'status' });
                        }}
                        className={cn("px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 md:gap-2 cursor-pointer hover:opacity-80 transition-opacity", getStatusStyle(booking.status))}
                      >
                        {getStatusIcon(booking.status)}
                        <span className="hidden md:inline">
                          {booking.status === 'pending' ? 'Chờ xác nhận' : booking.status === 'confirmed' ? 'Duyệt' : booking.status === 'in_progress' ? 'Đang làm' : 'Hoàn thành'}
                        </span>
                        <span className="inline md:hidden">
                          {booking.status === 'pending' ? 'Chờ XN' : booking.status === 'confirmed' ? 'Duyệt' : booking.status === 'in_progress' ? 'Đang làm' : 'Hoàn thành'}
                        </span>
                        <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                      </button>
                      
                      {openDropdown?.id === booking.id && openDropdown?.type === 'status' && (
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); }}></div>
                      )}
                      
                      <div className={cn("absolute right-0 lg:right-auto lg:left-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 transition-all z-20 flex flex-col", openDropdown?.id === booking.id && openDropdown?.type === 'status' ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none")}>
                        <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id!, 'pending'); setOpenDropdown(null); }} className="px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div> Chờ xác nhận
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id!, 'confirmed'); setOpenDropdown(null); }} className="px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div> Duyệt
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id!, 'in_progress'); setOpenDropdown(null); }} className="px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div> Đang làm
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id!, 'completed'); setOpenDropdown(null); }} className="px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Hoàn thành
                        </button>
                      </div>
                    </div>

                     <div className="relative">
                        <button 
                          className="p-2 md:p-3 bg-slate-50 text-slate-400 rounded-lg md:rounded-2xl hover:bg-slate-100" 
                          onClick={(e) => {
                             e.stopPropagation();
                             setOpenDropdown(openDropdown?.id === booking.id && openDropdown?.type === 'menu' ? null : { id: booking.id!, type: 'menu' });
                          }}
                        >
                          <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                        </button>

                        {openDropdown?.id === booking.id && openDropdown?.type === 'menu' && (
                           <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); }}></div>
                        )}

                        <div className={cn("absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 transition-all z-20", openDropdown?.id === booking.id && openDropdown?.type === 'menu' ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none")}>
                          <button onClick={async (e) => {
                             e.stopPropagation();
                             setOpenDropdown(null);
                             printElement(`print-booking-${booking.id}`, '80mm');
                             const { logActivity } = await import('../lib/activityUtils');
                             const { auth } = await import('../lib/firebase');
                             await logActivity(auth.currentUser as any, 'In ấn', 'In phiếu dịch vụ', `In phiếu dịch vụ #${booking.id}`);
                          }} className="w-full text-left px-5 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-3"><Printer className="w-4 h-4" /> In phiếu dịch vụ</button>
                          <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); handleEditBooking(booking); }} className="w-full text-left px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Edit2 className="w-4 h-4" /> Sửa thông tin</button>
                          <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); updateBookingStatus(booking.id!, 'cancelled'); }} className="w-full text-left px-5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3"><XCircle className="w-4 h-4" /> Hủy lịch hẹn</button>
                          <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); handleDeleteBooking(booking.id!); }} className="w-full text-left px-5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-red-50 mt-1"><Trash2 className="w-4 h-4" /> Xóa lịch hẹn</button>
                        </div>
                     </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Add Modal */}
      {createPortal(
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full h-[100dvh] md:h-auto max-w-[800px] bg-white md:rounded-[32px] lg:rounded-[44px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col md:max-h-[90vh]">
               <div className="px-5 py-4 sm:px-8 sm:py-6 flex items-center justify-between border-b border-slate-50 mt-2 sm:mt-0 shrink-0">
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-[20px] bg-blue-50 flex items-center justify-center text-blue-600"><CalendarIcon className="w-5 h-5 sm:w-7 sm:h-7" /></div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Đặt dịch vụ mới</h2>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 hidden sm:block">Xác nhận lịch hẹn trải nghiệm</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 sm:p-3 hover:bg-slate-50 rounded-xl sm:rounded-2xl transition-colors"><X className="w-5 h-5 sm:w-7 sm:h-7 text-slate-400" /></button>
                </div>

                <form onSubmit={handleBookingSubmit} className="flex flex-col h-full overflow-hidden">
                   <div className="p-5 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="relative">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên khách hàng *</label>
                          <div className="relative mt-1 md:mt-1.5">
                             <input 
                               type="text" 
                               required
                               value={formData.customerName || ''}
                               onChange={e => {
                                  setFormData({ ...formData, customerName: e.target.value });
                                  setCustomerSearchFocus(true);
                               }}
                               onFocus={() => setCustomerSearchFocus(true)}
                               onBlur={() => setTimeout(() => setCustomerSearchFocus(false), 200)}
                               placeholder="Tìm tên hoặc SĐT..." 
                               className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                             />
                             {customerSearchFocus && (
                                 <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto z-50 p-2">
                                     {customers.filter(c => !formData.customerName || c.name.toLowerCase().includes(formData.customerName.toLowerCase()) || c.phone.includes(formData.customerName)).map(c => (
                                        <div 
                                           key={c.id} 
                                           className="px-4 py-3 hover:bg-slate-50 rounded-lg cursor-pointer flex justify-between items-center"
                                           onClick={() => {
                                              setFormData({ ...formData, customerName: c.name, customerPhone: c.phone });
                                              setCustomerSearchFocus(false);
                                           }}
                                        >
                                           <span className="font-bold text-slate-900 text-sm w-full">{c.name} - {c.phone}</span>
                                        </div>
                                     ))}
                                     {(!formData.customerName || customers.filter(c => c.name.toLowerCase().includes(formData.customerName!.toLowerCase()) || c.phone.includes(formData.customerName!)).length === 0) && (
                                        <div 
                                           className="px-4 py-3 hover:bg-blue-50 text-blue-600 rounded-lg cursor-pointer flex justify-between items-center border border-blue-100 bg-blue-50/50 mt-1"
                                           onClick={() => setCustomerSearchFocus(false)}
                                        >
                                            <span className="font-bold text-sm w-full">+ Tạo khách hàng mới {formData.customerName ? `: ${formData.customerName}` : ''}</span>
                                        </div>
                                     )}
                                 </div>
                             )}
                          </div>
                        </div>
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Số điện thoại *</label>
                          <input required type="text" value={formData.customerPhone || ''} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="090..." className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ngày hẹn *</label>
                          <input required type="date" value={formData.bookingDate || ''} onChange={e => setFormData({ ...formData, bookingDate: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                        </div>
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Giờ hẹn *</label>
                          <input required type="time" value={formData.bookingTime || ''} onChange={e => setFormData({ ...formData, bookingTime: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dịch vụ trải nghiệm *</label>
                          <select required value={formData.serviceId || ''} onChange={e => setFormData({ ...formData, serviceId: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-900 outline-none appearance-none text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                            <option value="">-- Chọn dịch vụ --</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.promoPrice || s.price)}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nhân viên phụ trách</label>
                          <select value={formData.staffId || ''} onChange={e => setFormData({ ...formData, staffId: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-900 outline-none appearance-none text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                            <option value="">-- Tự động gán nhân viên --</option>
                            {staff.map((st: any) => <option key={st.uid} value={st.uid}>{st.name || st.email}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1 md:space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú yêu cầu</label>
                        <textarea rows={2} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none font-medium text-sm text-slate-900 italic focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                      </div>
                   </div>

                   <div className="p-4 sm:p-6 border-t border-slate-50 bg-white flex shrink-0 mt-auto items-center gap-3">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Hủy thao tác</button>
                      <button type="submit" disabled={loading} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl sm:rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_20px_40px_-15px_rgba(15,23,42,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Xác nhận đặt lịch
                      </button>
                   </div>
                </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body)}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận hủy (xóa) lịch hẹn"
        message="Chắc chắn xóa/hủy lịch hẹn này? Thao tác này sẽ giải phóng khung giờ và ghi nhận vào lịch sử hệ thống."
        onConfirm={executeDeleteBooking}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '' })}
      />

      {/* Hidden Print Components */}
      {filteredBookings.map(booking => (
        <React.Fragment key={`print-${booking.id}`}>
          <PrintBookingTicket booking={booking} paperSize="80mm" id={`print-booking-${booking.id}`} />
        </React.Fragment>
      ))}
    </div>
  );
}
