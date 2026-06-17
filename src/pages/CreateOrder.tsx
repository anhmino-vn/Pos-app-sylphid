import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, doc, updateDoc } from '../lib/firebaseAdapter';
import { db, Product, Service, Customer, Staff } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle2, Save,
  Users, Box, LayoutGrid, X, User as UserIcon, Tag, Package, Sparkles,
  QrCode, Calendar as CalendarIcon, Clock, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { logActivity } from '../lib/activityUtils';

interface CartItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  stock?: number;
  sku?: string;
  image?: string;
  note?: string;
}

const BANK_BINS: Record<string, string> = {
  'Vietcombank': '970436', 'Techcombank': '970407', 'MB Bank': '970422',
  'VIB': '970441', 'ACB': '970416', 'BIDV': '970418',
  'VietinBank': '970415', 'Sacombank': '970403', 'VPBank': '970432', 'TPBank': '970423'
};

export function CreateOrder() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);

  // Selection States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const [selectedReferrerId, setSelectedReferrerId] = useState<string | null>(null);
  const [referrerSearchTerm, setReferrerSearchTerm] = useState('');
  const [isReferrerDropdownOpen, setIsReferrerDropdownOpen] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  // Payment Popup States
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [activePaymentOrderId, setActivePaymentOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [amountGiven, setAmountGiven] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSavedDialogOpen, setIsSavedDialogOpen] = useState(false);

  // Cart & Payment States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('amount');
  const [tax, setTax] = useState<number>(0);
  const [orderNote, setOrderNote] = useState('');
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [pointsToUse, setPointsToUse] = useState<number>(0);

  // Catalog States
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  
  // New Customer Form
  const [newCustomer, setNewCustomer] = useState({
     name: '', phone: '', email: '', address: '', note: ''
  });
  const [newCustomerReferrerId, setNewCustomerReferrerId] = useState<string | null>(null);
  const [newCustomerReferrerSearch, setNewCustomerReferrerSearch] = useState('');
  const [isNewCustomerReferrerOpen, setIsNewCustomerReferrerOpen] = useState(false);
  const newCustomerReferrerDropdownRef = useRef<HTMLDivElement>(null);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const referrerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      setCustomers(data.filter(c => c.status !== 'inactive'));
    });
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data.filter(p => p.status !== 'discontinued'));
    });
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      setServices(data.filter(s => s.status !== 'inactive' && s.status !== 'discontinued'));
    });
    const unsubStaff = onSnapshot(query(collection(db, 'users'), where('status', '!=', 'locked')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setStaffList(data);
    });
    const unsubLoyalty = onSnapshot(doc(db, 'loyalty_settings', 'default'), (docSnap) => {
       if (docSnap.exists()) setLoyaltySettings(docSnap.data());
    });

    const unsubSettings = onSnapshot(doc(db, 'system_settings', 'products'), (docSnap) => {
       if (docSnap.exists()) {
          // Set to window or state
          (window as any).systemSettings = docSnap.data();
       }
    });

    const fetchPaymentConfig = async () => {
       const { data } = await supabase.from('payment_configs').select('*').eq('is_default', true).single();
       if (data) {
          setPaymentConfig(data);
       } else {
          const local = localStorage.getItem('mock_payment_configs');
          if (local) {
             const parsed = JSON.parse(local);
             const def = parsed.find((p: any) => p.is_default) || parsed[0];
             if (def) setPaymentConfig(def);
          }
       }
    };
    fetchPaymentConfig();

    return () => {
      unsubCustomers(); unsubProducts(); unsubServices(); unsubStaff(); unsubLoyalty(); unsubSettings();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (referrerDropdownRef.current && !referrerDropdownRef.current.contains(event.target as Node)) {
        setIsReferrerDropdownOpen(false);
      }
      if (newCustomerReferrerDropdownRef.current && !newCustomerReferrerDropdownRef.current.contains(event.target as Node)) {
        setIsNewCustomerReferrerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') { e.preventDefault(); handleSaveOrder('pending'); }
      else if (e.key === 'F9') { e.preventDefault(); handleSaveOrder('paid'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomerId]);

  // Derived Data
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers.slice(0, 50);
    const term = customerSearchTerm.toLowerCase();
    return customers.filter(c => (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)).slice(0, 50);
  }, [customers, customerSearchTerm]);

  const filteredReferrers = useMemo(() => {
    if (!referrerSearchTerm) return customers.slice(0, 50);
    const term = referrerSearchTerm.toLowerCase();
    return customers.filter(c => ((c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)) && c.id !== selectedCustomerId).slice(0, 50);
  }, [customers, referrerSearchTerm, selectedCustomerId]);

  const displayedCatalog = useMemo(() => {
    const term = catalogSearch.toLowerCase();
    if (activeTab === 'products') {
      return products.filter(p => {
        const matchSearch = (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
        const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
        return matchSearch && matchCat;
      });
    } else {
      return services.filter(s => {
        const matchSearch = (s.name || '').toLowerCase().includes(term) || (s.code || '').toLowerCase().includes(term);
        const matchCat = selectedCategory === 'all' || s.categoryId === selectedCategory;
        return matchSearch && matchCat;
      });
    }
  }, [activeTab, catalogSearch, selectedCategory, products, services]);

  const selectedCustomerData = customers.find(c => c.id === selectedCustomerId);

  const tierDiscountPercent = useMemo(() => {
     if (!selectedCustomerData || !loyaltySettings?.tiers) return 0;
     const tierData = loyaltySettings.tiers.find((t: any) => t.id === selectedCustomerData.tier);
     return tierData ? (tierData.discountPercent || 0) : 0;
  }, [selectedCustomerData, loyaltySettings]);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const customDiscountAmount = useMemo(() => {
    if (discountType === 'percent') return (subtotal * discount) / 100;
    return discount;
  }, [subtotal, discount, discountType]);

  const tierDiscountAmount = (subtotal * tierDiscountPercent) / 100;
  const discountAmount = customDiscountAmount + tierDiscountAmount;
  const taxAmount = ((subtotal - discountAmount) * tax) / 100;
  const totalBeforePoints = subtotal - discountAmount + taxAmount;
  const pointsDiscountAmount = Math.min(pointsToUse || 0, totalBeforePoints);
  const totalAmount = totalBeforePoints - pointsDiscountAmount;

  // Actions
  const addToCart = (item: Product | Service, type: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      
      const itemSalePrice = Number((item as any).salePrice) || 0;
      const itemListPrice = Number((item as any).listPrice) || 0;
      const itemFallbackPrice = Number((item as any).price) || 0;
      
      const isProduct = type === 'product' || type === 'products';
      
      let finalPrice = 0;
      let finalOriginalPrice = 0;
      
      if (isProduct) {
         finalPrice = itemSalePrice > 0 ? itemSalePrice : (itemListPrice > 0 ? itemListPrice : itemFallbackPrice);
         finalOriginalPrice = itemListPrice > 0 ? itemListPrice : (itemSalePrice > 0 ? itemSalePrice : itemFallbackPrice);
      } else {
         finalPrice = itemFallbackPrice;
         finalOriginalPrice = itemFallbackPrice;
      }
      
      return [...prev, {
        id: item.id!, type: isProduct ? 'product' : 'service', name: item.name, 
        price: finalPrice, originalPrice: finalOriginalPrice,
        sku: isProduct ? (item as any).sku : (item as any).code, 
        stock: isProduct ? (item as any).stock : undefined,
        image: item.images && item.images.length > 0 ? item.images[0] : undefined, quantity: 1
      }];
    });
  };

  const updateQuantity = (id: string, qty: number | string) => {
    const newQ = typeof qty === 'number' ? qty : parseInt(qty) || 1;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, newQ) } : item));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  const updateItemNote = (id: string, note: string) => setCart(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  const updateItemPrice = (id: string, priceStr: string) => {
    const val = parseInt(priceStr.replace(/\D/g, ''), 10);
    if (!isNaN(val)) {
       setCart(prev => prev.map(item => item.id === id ? { ...item, price: val } : item));
    }
  };

  const handleSaveOrder = async (status: 'pending' | 'paid') => {
    if (cart.length === 0) return toast.error('Giỏ hàng trống');
    if (!selectedCustomerId) return toast.error('Vui lòng chọn khách hàng');

    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const referrer = customers.find(c => c.id === selectedReferrerId);
      
      const orderData = {
        customerId: selectedCustomerId,
        customerName: customer?.name || '',
        customerPhone: customer?.phone || '',
        referredById: selectedReferrerId,
        referredByName: referrer?.name || '',
        items: cart,
        subtotal,
        discount: discountAmount,
        totalAmount,
        note: orderNote,
        createdBy: profile?.id || profile?.uid,
        creatorName: profile?.name || profile?.email,
        createdAt: new Date(orderDate),
        status: 'pending' // Luôn tạo pending trước
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      try {
         await logActivity(
            { uid: profile?.id || profile?.uid || '', email: profile?.email || '', name: profile?.name || profile?.displayName || '' },
            'Đơn hàng',
            'Tạo đơn hàng',
            `Đã tạo đơn hàng mới cho khách: ${orderData.customerName || 'Khách lẻ'}`,
            'info',
            { ...orderData, id: docRef.id } // newData
         );
      } catch (e) {
         console.error('Failed to log activity', e);
      }
      
      if (status === 'paid') {
         setActivePaymentOrderId(docRef.id);
         setAmountGiven(totalAmount);
         setIsPaymentPopupOpen(true);
      } else {
         toast.success('Đã lưu đơn chờ xử lý');
         setIsSavedDialogOpen(true);
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu đơn hàng: ' + err.message);
    }
  };

  const handleCompletePayment = async () => {
     if (paymentMethod === 'cash' && amountGiven < totalAmount) {
        return; // Cảnh báo đỏ đã hiển thị trên UI, nhưng block submit
     }
     if (!activePaymentOrderId) return;
     
     setIsProcessingPayment(true);
     try {
         const settings = (window as any).systemSettings || {};
         const pointsEarningRate = settings.points_earning_rate || 10000;
         const pointsEarned = pointsEarningRate > 0 ? Math.floor(totalAmount / pointsEarningRate) : 0;

         const updateData = {
            status: 'paid',
            paymentMethod,
            amountGiven: paymentMethod === 'cash' ? amountGiven : totalAmount,
            changeGiven: paymentMethod === 'cash' ? amountGiven - totalAmount : 0
         };
         await updateDoc(doc(db, 'orders', activePaymentOrderId), updateData);

         if (selectedCustomerId) {
             const customer = customers.find(c => c.id === selectedCustomerId);
             if (customer) {
                const currentPoints = customer.points || 0;
                await updateDoc(doc(db, 'customers', selectedCustomerId), {
                   points: currentPoints + pointsEarned - (pointsToUse || 0)
                });
             }
         }

         for (const item of cart) {
             if (item.type === 'product') {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const currentStock = product.stock || 0;
                    await updateDoc(doc(db, 'products', item.id), {
                       stock: Math.max(0, currentStock - item.quantity)
                    });
                }
             }
         }
         
         try {
             await logActivity(
                { uid: profile?.id || profile?.uid || '', email: profile?.email || '', name: profile?.name || profile?.displayName || '' },
                'Đơn hàng',
                'Thanh toán đơn hàng',
                `Đã thanh toán đơn hàng #${activePaymentOrderId.slice(-6).toUpperCase()} với số tiền ${formatCurrency(totalAmount)} qua ${paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}`,
                'info',
                { orderId: activePaymentOrderId, amount: totalAmount, method: paymentMethod }
             );
         } catch(e) {
             console.error('Log error', e);
         }

         toast.success('Thanh toán thành công');
         setIsPaymentPopupOpen(false);
         setActivePaymentOrderId(null);
         handleReset();
     } catch(err: any) {
         toast.error('Lỗi thanh toán: ' + err.message);
     } finally {
         setIsProcessingPayment(false);
     }
  };

  const handleReset = () => {
      setCart([]); setSelectedCustomerId(null); setCustomerSearchTerm('');
      setSelectedReferrerId(null); setReferrerSearchTerm('');
      setOrderNote(''); setDiscount(0); setPointsToUse(0);
      setOrderDate(new Date().toISOString().slice(0, 16));
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return toast.error('Vui lòng nhập tên khách hàng');
    try {
      const customerCount = customers.length + 1;
      const genId = `KH${String(customerCount).padStart(6, '0')}`;
      
      const custData = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        note: newCustomer.note.trim(),
        referredById: newCustomerReferrerId,
        status: 'active',
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'customers'), custData);
      toast.success('Thêm khách hàng thành công');
      setIsCreateCustomerModalOpen(false);
      
      setSelectedCustomerId(docRef.id);
      setCustomerSearchTerm(`${custData.name} - ${custData.phone}`);
      // Nếu khách mới có người giới thiệu, gán luôn người giới thiệu đó cho Đơn hàng này
      if (newCustomerReferrerId) {
         const refCust = customers.find(c => c.id === newCustomerReferrerId);
         if (refCust) {
            setSelectedReferrerId(newCustomerReferrerId);
            setReferrerSearchTerm(`${refCust.name} - ${refCust.phone}`);
         }
      }
      setNewCustomer({ name: '', phone: '', email: '', address: '', note: '' });
      setNewCustomerReferrerId(null);
      setNewCustomerReferrerSearch('');
    } catch (err: any) {
      toast.error('Lỗi khi thêm khách hàng: ' + err.message);
    }
  };

  // VietQR Generator
  const generateQR = () => {
     if (!paymentConfig || !selectedCustomerData || !activePaymentOrderId) return null;
     const bin = BANK_BINS[paymentConfig.bank_name] || paymentConfig.bank_name;
     const acc = paymentConfig.account_number;
     const amount = totalAmount;
     const shortId = activePaymentOrderId.slice(-6).toUpperCase();
     const cleanName = selectedCustomerData.name.replace(/ /g, '');
     const content = `TX${shortId} ${cleanName}`.replace(/ /g, ''); // VD: TXWKTT61AnhTruong
     const name = paymentConfig.account_name;
     return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${name}`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-72px)] -m-4 sm:-m-6 md:-m-8 bg-[#F1F5F9] font-sans overflow-x-hidden">
      {/* LEFT PANEL: Catalog (60%) */}
      <div className="w-full lg:w-[60%] flex flex-col bg-[#F8FAFC]">
        <div className="flex items-center justify-between p-6 pb-2">
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-md">
                 <ShoppingCart size={24} />
              </div>
              <div>
                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Hệ thống bán lẻ</h2>
                 <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">LuxeFlow POS Terminal</p>
              </div>
           </div>
           
           <div className="relative w-80">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text" placeholder="Tìm tên sản phẩm (F2)..."
                className="w-full border-none rounded-full pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm font-medium text-slate-700"
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
              />
           </div>
        </div>

        <div className="px-6 py-4 flex items-center gap-4">
           <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100">
             <button 
               className={cn("px-6 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-2", activeTab === 'products' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800")}
               onClick={() => { setActiveTab('products'); setSelectedCategory('all'); }}
             >
               <Package size={14} strokeWidth={2.5} /> SẢN PHẨM
             </button>
             <button 
               className={cn("px-6 py-2 text-xs font-bold rounded-full transition-colors flex items-center gap-2", activeTab === 'services' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800")}
               onClick={() => { setActiveTab('services'); setSelectedCategory('all'); }}
             >
               <Sparkles size={14} strokeWidth={2.5} /> DỊCH VỤ
             </button>
           </div>
           <select 
             className="bg-white border border-slate-100 rounded-full px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 shadow-sm outline-none cursor-pointer appearance-none uppercase tracking-wide"
             value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
           >
             <option value="all">TẤT CẢ DANH MỤC</option>
             {Array.from(new Set(activeTab === 'products' ? products.map(p => p.category).filter(Boolean) : services.map(s => s.categoryId).filter(Boolean))).map(cat => (
               <option key={String(cat)} value={String(cat)}>{String(cat).toUpperCase()}</option>
             ))}
           </select>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
           {displayedCatalog.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-300">
               <Box size={64} className="mb-4 opacity-50" />
               <p className="text-sm font-medium">Không tìm thấy sản phẩm nào</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
               {displayedCatalog.map(item => (
                 <div 
                   key={item.id} onClick={() => addToCart(item, activeTab)}
                   className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group flex flex-col relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl rounded-tr-[20px] z-10 border-b border-l border-slate-100">
                       {'stock' in item ? `${item.stock} KHO` : 'D.VỤ'}
                    </div>
                    <div className="w-full aspect-square bg-slate-50/50 rounded-xl mb-4 p-3 flex items-center justify-center overflow-hidden border border-slate-50 group-hover:scale-105 transition-transform duration-300">
                       {item.images && item.images.length > 0 ? (
                         <img src={item.images[0]} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                       ) : (
                         <Box size={40} className="text-slate-200" />
                       )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-2 flex-1 group-hover:text-blue-700 transition-colors">{item.name}</h4>
                    <div className="font-black text-blue-700 text-base">{formatCurrency('salePrice' in item ? item.salePrice : item.price)}</div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* RIGHT PANEL: Customer, Cart & Payment (40%) */}
      <div className="w-full lg:w-[40%] flex flex-col bg-white border-l border-slate-200 shadow-2xl z-20">
         {/* Top Section: Customer Info */}
         <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between mb-3">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> Khách hàng</label>
               <button onClick={() => setIsCreateCustomerModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase tracking-widest"><Plus size={12}/> Thêm mới</button>
            </div>
            <div className="relative" ref={customerDropdownRef}>
               <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"><Search size={14} /></div>
               <input 
                 type="text"
                 className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                 placeholder="Tìm theo Tên, SĐT, Mã KH..."
                 value={customerSearchTerm}
                 onChange={(e) => {
                   setCustomerSearchTerm(e.target.value); setIsCustomerDropdownOpen(true);
                   if (selectedCustomerId) setSelectedCustomerId(null);
                 }}
                 onFocus={() => setIsCustomerDropdownOpen(true)}
               />
               {customerSearchTerm && (
                  <button onClick={() => { setCustomerSearchTerm(''); setSelectedCustomerId(null); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={14}/></button>
               )}
               <AnimatePresence>
                 {isCustomerDropdownOpen && (
                   <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                     {filteredCustomers.length === 0 ? (
                       <div className="p-4 text-sm text-slate-500 text-center font-medium">Không tìm thấy khách hàng</div>
                     ) : (
                       filteredCustomers.map(c => (
                         <div key={c.id} className="px-5 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex justify-between items-center transition-colors"
                              onClick={() => { 
                                setSelectedCustomerId(c.id!); 
                                setCustomerSearchTerm(`${c.name} - ${c.phone}`); 
                                setIsCustomerDropdownOpen(false); 
                                if ((c as any).referredById) {
                                  setSelectedReferrerId((c as any).referredById);
                                  const refCust = customers.find(r => r.id === (c as any).referredById);
                                  if (refCust) setReferrerSearchTerm(`${refCust.name} - ${refCust.phone}`);
                                } else {
                                  setSelectedReferrerId(null);
                                  setReferrerSearchTerm('');
                                }
                              }}>
                           <div>
                              <div className="font-bold text-sm text-slate-800">{c.name}</div>
                              <div className="text-xs font-medium text-slate-500 mt-0.5">{c.phone}</div>
                           </div>
                           {c.tier && <span className="text-[9px] font-black px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full uppercase tracking-widest">{c.tier}</span>}
                         </div>
                       ))
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
            
            {/* Meta Order Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
               {/* Referrer Selector */}
               <div className="relative" ref={referrerDropdownRef}>
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><UserIcon size={12} /></div>
                  <input 
                     type="text"
                     className="w-full text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg pl-7 pr-14 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="Người giới thiệu..."
                     value={referrerSearchTerm}
                     onChange={(e) => {
                        setReferrerSearchTerm(e.target.value); setIsReferrerDropdownOpen(true);
                        if (selectedReferrerId) setSelectedReferrerId(null);
                     }}
                     onFocus={() => setIsReferrerDropdownOpen(true)}
                  />
                  {referrerSearchTerm ? (
                     <button onClick={() => { setReferrerSearchTerm(''); setSelectedReferrerId(null); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={12}/></button>
                  ) : (
                     <button onClick={() => setIsCreateCustomerModalOpen(true)} className="absolute inset-y-0 right-0 px-3 text-[9px] font-black text-blue-600 hover:text-blue-800 hover:bg-blue-100 uppercase tracking-widest flex items-center bg-blue-50/50 rounded-r-lg border-l border-slate-200">Thêm</button>
                  )}
                  <AnimatePresence>
                     {isReferrerDropdownOpen && (
                     <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto custom-scrollbar">
                        {filteredReferrers.length === 0 ? (
                           <div className="p-3 text-[10px] text-slate-500 text-center font-medium">Không tìm thấy người giới thiệu</div>
                        ) : (
                           filteredReferrers.map(c => (
                           <div key={c.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition-colors"
                                 onClick={() => { 
                                 setSelectedReferrerId(c.id!); 
                                 setReferrerSearchTerm(`${c.name} - ${c.phone}`); 
                                 setIsReferrerDropdownOpen(false); 
                                 }}>
                              <div className="font-bold text-[11px] text-slate-800">{c.name}</div>
                              <div className="text-[10px] text-slate-500">{c.phone}</div>
                           </div>
                           ))
                        )}
                     </motion.div>
                     )}
                  </AnimatePresence>
               </div>

               {/* Date Picker */}
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400"><CalendarIcon size={12} /></div>
                  <input type="datetime-local" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"/>
               </div>
            </div>
         </div>

         {/* Cart Items (Scrollable Middle) */}
         <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white flex flex-col">
            {cart.length > 0 && (
               <div className="flex items-center justify-between shrink-0 mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giỏ hàng ({cart.length})</span>
                  <button onClick={() => setCart([])} className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline">Xóa hết</button>
               </div>
            )}
            {cart.length === 0 ? (
               <div className="flex flex-col items-center justify-center flex-1 text-slate-300">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-3"><ShoppingCart size={32} className="text-slate-300" /></div>
                  <p className="text-sm font-semibold text-slate-400">Giỏ hàng đang trống</p>
               </div>
            ) : (
               <div className="space-y-3">
                  {cart.map(item => (
                  <div key={item.id} className="flex gap-3 p-3 bg-white border border-slate-200 rounded-2xl relative group hover:border-blue-300 hover:shadow-md transition-all">
                     <button onClick={() => removeFromCart(item.id)} className="absolute -top-2 -left-2 w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"><X size={10} strokeWidth={3} /></button>
                     <div className="w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 p-1 flex-shrink-0">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" /> : <div className="w-full h-full flex items-center justify-center"><Box size={20} className="text-slate-300" /></div>}
                     </div>
                     <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                           <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight pr-2">{item.name}</h4>
                           <div className="flex flex-col items-end shrink-0">
                              <span className="font-black text-blue-700 text-xs">{formatCurrency(item.price * item.quantity)}</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                           {(profile?.role === 'admin' || profile?.role === 'superadmin') ? (
                              <input 
                                type="text" 
                                value={new Intl.NumberFormat('vi-VN').format(item.price)} 
                                onChange={(e) => updateItemPrice(item.id, e.target.value)}
                                className="w-20 text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                           ) : (
                              <span className="text-[10px] font-bold text-slate-400 line-through">{item.originalPrice && item.originalPrice > item.price ? formatCurrency(item.originalPrice) : ''}</span>
                           )}
                           <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shadow-sm h-7">
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 h-full flex items-center"><Minus size={12} strokeWidth={3} /></button>
                              <input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="w-10 h-full text-xs font-black text-center border-x border-slate-200 bg-white text-slate-800 p-0 focus:ring-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 h-full flex items-center"><Plus size={12} strokeWidth={3} /></button>
                           </div>
                        </div>
                        <div className="mt-2">
                           <input 
                              type="text" 
                              placeholder="Ghi chú sản phẩm..." 
                              value={item.note || ''} 
                              onChange={(e) => updateItemNote(item.id, e.target.value)} 
                              className="w-full text-[10px] bg-slate-50 border border-slate-100 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-200"
                           />
                        </div>
                     </div>
                  </div>
               ))}
               </div>
            )}
         </div>

         {/* Checkout Summary Area (Fixed Bottom) */}
         <div className="p-5 bg-slate-50/80 border-t border-slate-200 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-30">
            <div className="space-y-3 mb-4">
               <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tạm tính</span>
                  <span className="font-bold text-slate-700 text-sm">{formatCurrency(subtotal)}</span>
               </div>
               
               <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Chiết khấu</span>
                  <div className="flex items-center gap-1.5">
                     <input type="number" className="w-20 text-right bg-white border border-slate-200 rounded-md py-1 px-2 text-xs font-bold text-red-500 focus:ring-2 focus:ring-red-500" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
                     <select className="bg-white border border-slate-200 rounded-md py-1 px-1.5 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-red-500 outline-none" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                        <option value="amount">VNĐ</option>
                        <option value="percent">%</option>
                     </select>
                  </div>
               </div>

            </div>

            <div className="flex justify-between items-end mb-4 bg-slate-900 text-white p-3.5 rounded-xl shadow-lg">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Tổng cộng</span>
               <span className="text-2xl font-black tracking-tight">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="grid grid-cols-12 gap-2.5">
               <button onClick={handleReset} className="col-span-3 w-full py-3.5 text-[10px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest shadow-sm">
                 Làm mới
               </button>
               <button onClick={() => handleSaveOrder('pending')} className="col-span-3 w-full py-3.5 text-[10px] font-black text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-all uppercase tracking-widest shadow-sm">
                 Lưu Tạm (F8)
               </button>
               <button onClick={() => handleSaveOrder('paid')} className="col-span-6 w-full py-3.5 text-[11px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all uppercase tracking-widest shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2">
                 <CheckCircle2 size={16} strokeWidth={3} /> THANH TOÁN (F9)
               </button>
            </div>
         </div>
      </div>

      {/* PAYMENT POPUP */}
      <AnimatePresence>
         {isPaymentPopupOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessingPayment && setIsPaymentPopupOpen(false)} />
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                     <div>
                        <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Thanh toán đơn hàng</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">#TX-{activePaymentOrderId?.slice(-6).toUpperCase()} • {selectedCustomerData?.name}</p>
                     </div>
                     <button onClick={() => !isProcessingPayment && setIsPaymentPopupOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20} strokeWidth={2.5} /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 grid md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Hình thức thanh toán</label>
                           <div className="grid grid-cols-2 gap-3">
                              <button onClick={() => setPaymentMethod('cash')} className={cn("py-3 rounded-xl border-2 font-black text-xs uppercase tracking-widest transition-all", paymentMethod === 'cash' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-100 bg-white text-slate-500 hover:border-slate-300")}>Tiền mặt</button>
                              <button onClick={() => setPaymentMethod('transfer')} className={cn("py-3 rounded-xl border-2 font-black text-xs uppercase tracking-widest transition-all", paymentMethod === 'transfer' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-100 bg-white text-slate-500 hover:border-slate-300")}>Chuyển khoản</button>
                           </div>
                        </div>

                        {paymentMethod === 'cash' && (
                           <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <div>
                                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Khách đưa (VNĐ)</label>
                                 <input type="number" value={amountGiven || ''} onChange={e => setAmountGiven(Number(e.target.value))} className="w-full text-lg font-black text-slate-800 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 bg-white" placeholder="0" />
                                 {amountGiven < totalAmount && (
                                    <p className="text-xs font-bold text-red-500 mt-2">Số tiền bạn nhập thấp hơn so với số tiền thanh toán.</p>
                                 )}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tiền trả khách</span>
                                 <span className="text-lg font-black text-emerald-600">{formatCurrency(Math.max(0, amountGiven - totalAmount))}</span>
                              </div>
                           </div>
                        )}

                        {paymentMethod === 'transfer' && generateQR() && (
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                              <img src={generateQR()!} alt="QR Code" className="w-40 h-40 rounded-xl shadow-sm mb-3 bg-white p-2" />
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Quét mã bằng App Ngân Hàng<br/>Nội dung: TX{activePaymentOrderId?.slice(-6).toUpperCase()} {selectedCustomerData?.name.replace(/ /g, '')}</p>
                           </div>
                        )}
                     </div>

                     <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-center">
                        <div className="space-y-3 mb-6">
                           <div className="flex justify-between text-slate-400 text-xs font-bold">
                              <span>Tạm tính</span>
                              <span>{formatCurrency(subtotal)}</span>
                           </div>
                           <div className="flex justify-between text-slate-400 text-xs font-bold">
                              <span>Chiết khấu</span>
                              <span>- {formatCurrency(discountAmount)}</span>
                           </div>
                        </div>
                        <div className="pt-6 border-t border-slate-700/50 flex justify-between items-end">
                           <span className="text-xs font-black uppercase tracking-widest text-slate-400">Cần thanh toán</span>
                           <span className="text-3xl font-black text-blue-400 tracking-tight">{formatCurrency(totalAmount)}</span>
                        </div>
                     </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                     <button onClick={() => !isProcessingPayment && setIsPaymentPopupOpen(false)} className="flex-1 py-3.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all uppercase tracking-widest shadow-sm">Thoát</button>
                     <button onClick={handleCompletePayment} disabled={isProcessingPayment || (paymentMethod === 'cash' && amountGiven < totalAmount)} className="flex-[2] py-3.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                        {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 size={18} strokeWidth={3} /> HOÀN TẤT THANH TOÁN</>}
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* CREATE CUSTOMER MODAL */}
      <AnimatePresence>
        {isCreateCustomerModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateCustomerModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Thêm khách hàng mới</h3>
                <button onClick={() => setIsCreateCustomerModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form id="newCustomerForm" onSubmit={handleCreateCustomer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Mã KH (Tự động)</label>
                      <input type="text" disabled value={`KH${String(customers.length + 1).padStart(6, '0')}`} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold bg-slate-100 text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Tên khách hàng *</label>
                      <input type="text" required value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Nguyễn Văn A" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Số điện thoại *</label>
                      <input type="text" required value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="09xxxx" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
                      <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="email@example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Địa chỉ</label>
                    <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Nhập địa chỉ..." />
                  </div>
                  <div className="relative" ref={newCustomerReferrerDropdownRef}>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Người giới thiệu</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"><Search size={14} /></div>
                      <input 
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        placeholder="Tìm người giới thiệu..."
                        value={newCustomerReferrerSearch}
                        onChange={(e) => {
                          setNewCustomerReferrerSearch(e.target.value); setIsNewCustomerReferrerOpen(true);
                          if (newCustomerReferrerId) setNewCustomerReferrerId(null);
                        }}
                        onFocus={() => setIsNewCustomerReferrerOpen(true)}
                      />
                      {newCustomerReferrerSearch && (
                        <button type="button" onClick={() => { setNewCustomerReferrerSearch(''); setNewCustomerReferrerId(null); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={14}/></button>
                      )}
                    </div>
                    <AnimatePresence>
                      {isNewCustomerReferrerOpen && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                          {customers.filter(c => (c.name || '').toLowerCase().includes(newCustomerReferrerSearch.toLowerCase()) || (c.phone || '').includes(newCustomerReferrerSearch)).slice(0, 20).length === 0 ? (
                            <div className="p-4 text-sm text-slate-500 text-center font-medium">Không tìm thấy khách hàng</div>
                          ) : (
                            customers.filter(c => (c.name || '').toLowerCase().includes(newCustomerReferrerSearch.toLowerCase()) || (c.phone || '').includes(newCustomerReferrerSearch)).slice(0, 20).map(c => (
                              <div key={c.id} className="px-5 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex justify-between items-center transition-colors"
                                   onClick={() => { setNewCustomerReferrerId(c.id!); setNewCustomerReferrerSearch(`${c.name} - ${c.phone}`); setIsNewCustomerReferrerOpen(false); }}>
                                <div>
                                   <div className="font-bold text-sm text-slate-800">{c.name}</div>
                                   <div className="text-xs font-medium text-slate-500 mt-0.5">{c.phone}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Ghi chú</label>
                    <textarea value={newCustomer.note} onChange={e => setNewCustomer({...newCustomer, note: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-colors min-h-[80px]" placeholder="Ghi chú thêm..."></textarea>
                  </div>
                </form>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50/50">
                <button onClick={() => setIsCreateCustomerModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Hủy</button>
                <button type="submit" form="newCustomerForm" className="px-6 py-3 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2">
                  <CheckCircle2 size={16} strokeWidth={3} /> Lưu Khách Hàng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Order Dialog */}
      <AnimatePresence>
        {isSavedDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => {
                setIsSavedDialogOpen(false);
                handleReset();
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Lưu đơn hàng thành công!</h3>
                <p className="text-sm text-slate-500 font-semibold mb-8">Đơn hàng đã được lưu tạm và đưa vào danh sách chờ xử lý.</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsSavedDialogOpen(false);
                      handleReset();
                    }}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Thoát
                  </button>
                  <button
                    onClick={() => {
                      setIsSavedDialogOpen(false);
                      handleReset();
                      navigate('/orders');
                    }}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/30"
                  >
                    Xem đơn hàng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
