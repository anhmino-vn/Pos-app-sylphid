import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from '../lib/firebaseAdapter';
import { db, Product, Service, Customer, Staff } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Save,
  Users,
  Box,
  LayoutGrid,
  X,
  User as UserIcon,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  stock?: number;
  sku?: string;
}

export function CreateOrder() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Retrieve profile from local storage as a workaround for circular dependency
    const stored = localStorage.getItem('sb-profile');
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Selection States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const [selectedReferrerId, setSelectedReferrerId] = useState<string | null>(null);
  const [referrerSearchTerm, setReferrerSearchTerm] = useState('');
  const [isReferrerDropdownOpen, setIsReferrerDropdownOpen] = useState(false);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Cart & Payment States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('amount');
  const [tax, setTax] = useState<number>(0); // percentage
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'combined'>('cash');
  const [amountGiven, setAmountGiven] = useState<number | ''>('');
  const [orderNote, setOrderNote] = useState('');

  // Catalog States
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const referrerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch Customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      setCustomers(data.filter(c => c.status !== 'inactive'));
    });

    // Fetch Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data.filter(p => p.status !== 'discontinued'));
    });

    // Fetch Services
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      setServices(data.filter(s => s.status !== 'hidden'));
    });

    // Fetch Staff (for simplicity, using a basic query on users collection)
    const unsubStaff = onSnapshot(query(collection(db, 'users'), where('status', '!=', 'locked')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setStaffList(data);
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubServices();
      unsubStaff();
    };
  }, []);

  // Listen for clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (referrerDropdownRef.current && !referrerDropdownRef.current.contains(event.target as Node)) {
        setIsReferrerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        handleSaveOrder('pending');
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleSaveOrder('paid');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomerId]);

  // Derived Data
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers.slice(0, 50);
    const term = customerSearchTerm.toLowerCase();
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)
    ).slice(0, 50);
  }, [customers, customerSearchTerm]);

  const filteredReferrers = useMemo(() => {
    if (!referrerSearchTerm) return customers.slice(0, 50);
    const term = referrerSearchTerm.toLowerCase();
    return customers.filter(c => 
      ((c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term)) && c.id !== selectedCustomerId
    ).slice(0, 50);
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

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * discount) / 100;
    }
    return discount;
  }, [subtotal, discount, discountType]);

  const taxAmount = ((subtotal - discountAmount) * tax) / 100;
  const totalAmount = subtotal - discountAmount + taxAmount;
  const changeGiven = typeof amountGiven === 'number' ? amountGiven - totalAmount : 0;

  // Actions
  const addToCart = (item: Product | Service, type: 'product' | 'service') => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: item.id!,
        type,
        name: item.name,
        price: 'salePrice' in item ? item.salePrice : item.price,
        originalPrice: 'listPrice' in item ? item.listPrice : item.price,
        sku: 'sku' in item ? item.sku : item.code,
        stock: 'stock' in item ? item.stock : undefined,
        quantity: 1
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveOrder = async (status: 'pending' | 'paid') => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng trống');
      return;
    }
    if (!selectedCustomerId) {
      toast.error('Vui lòng chọn khách hàng');
      return;
    }

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
        tax: taxAmount,
        totalAmount,
        paymentMethod,
        amountGiven: typeof amountGiven === 'number' ? amountGiven : 0,
        changeGiven: changeGiven > 0 ? changeGiven : 0,
        status,
        note: orderNote,
        createdBy: profile?.uid,
        creatorName: profile?.name || profile?.email,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), orderData);
      toast.success(status === 'paid' ? 'Thanh toán thành công' : 'Đã lưu tạm đơn hàng');
      
      // Reset
      setCart([]);
      setSelectedCustomerId(null);
      setCustomerSearchTerm('');
      setSelectedReferrerId(null);
      setReferrerSearchTerm('');
      setAmountGiven('');
      setOrderNote('');
      setDiscount(0);
      
    } catch (err: any) {
      toast.error('Lỗi khi lưu đơn hàng: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9] font-sans">
      {/* Top Bar - Header Area */}
      <div className="bg-white p-4 shadow-sm z-20 shrink-0">
        <h1 className="text-xl font-bold text-slate-800 mb-4">Tạo đơn hàng</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Customer Selection */}
          <div className="relative" ref={customerDropdownRef}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Khách hàng (F4)</label>
            <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <div className="pl-3 text-slate-400">
                <Users size={16} />
              </div>
              <input 
                type="text"
                placeholder="Tìm khách hàng..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-2"
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsCustomerDropdownOpen(true);
                  if (selectedCustomerId) setSelectedCustomerId(null);
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
              />
              {customerSearchTerm && (
                <button 
                  onClick={() => { setCustomerSearchTerm(''); setSelectedCustomerId(null); }}
                  className="pr-3 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {isCustomerDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy khách hàng</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <div 
                        key={c.id} 
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between"
                        onClick={() => {
                          setSelectedCustomerId(c.id!);
                          setCustomerSearchTerm(`${c.name} - ${c.phone}`);
                          setIsCustomerDropdownOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.phone}</div>
                        </div>
                        {c.tier && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                            {c.tier}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Referrer Selection */}
          <div className="relative" ref={referrerDropdownRef}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Người giới thiệu</label>
            <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <div className="pl-3 text-slate-400">
                <Tag size={16} />
              </div>
              <input 
                type="text"
                placeholder="Chọn người giới thiệu..."
                className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-2"
                value={referrerSearchTerm}
                onChange={(e) => {
                  setReferrerSearchTerm(e.target.value);
                  setIsReferrerDropdownOpen(true);
                  if (selectedReferrerId) setSelectedReferrerId(null);
                }}
                onFocus={() => setIsReferrerDropdownOpen(true)}
              />
              {referrerSearchTerm && (
                <button 
                  onClick={() => { setReferrerSearchTerm(''); setSelectedReferrerId(null); }}
                  className="pr-3 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {isReferrerDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  {filteredReferrers.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy dữ liệu</div>
                  ) : (
                    filteredReferrers.map(c => (
                      <div 
                        key={c.id} 
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        onClick={() => {
                          setSelectedReferrerId(c.id!);
                          setReferrerSearchTerm(`${c.name} - ${c.phone}`);
                          setIsReferrerDropdownOpen(false);
                        }}
                      >
                        <div className="font-semibold text-sm text-slate-800">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.phone}</div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Staff Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nhân viên phụ trách</label>
            <div className="relative">
              <select 
                className="w-full border border-slate-300 rounded-lg bg-slate-50 text-sm py-2 pl-9 pr-3 appearance-none focus:ring-2 focus:ring-blue-500"
                value={selectedStaffId || ''}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <UserIcon size={16} />
              </div>
            </div>
          </div>

          {/* Branch / Date (Read-only for now) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Ngày tạo</label>
            <div className="w-full border border-slate-200 rounded-lg bg-slate-100 text-sm py-2 px-3 text-slate-600 font-medium">
              {new Date().toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANEL: Catalog */}
        <div className="w-full md:w-1/2 lg:w-[45%] flex flex-col border-r border-slate-200 bg-white">
          {/* Tabs & Search */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", activeTab === 'products' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                onClick={() => { setActiveTab('products'); setSelectedCategory('all'); }}
              >
                Sản phẩm
              </button>
              <button 
                className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", activeTab === 'services' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                onClick={() => { setActiveTab('services'); setSelectedCategory('all'); }}
              >
                Dịch vụ
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm (F2) / Quét mã vạch..."
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Catalog Layout: Categories + Items */}
          <div className="flex flex-1 overflow-hidden">
            {/* Categories Sidebar */}
            <div className="w-32 bg-slate-50 border-r border-slate-100 overflow-y-auto">
              <button 
                className={cn("w-full text-left px-3 py-3 text-sm font-medium border-l-2 transition-colors", selectedCategory === 'all' ? "border-blue-600 bg-blue-50/50 text-blue-700" : "border-transparent text-slate-600 hover:bg-slate-100")}
                onClick={() => setSelectedCategory('all')}
              >
                Tất cả
              </button>
              {/* Note: In a real scenario, categories should be fetched dynamically. For simplicity we extract unique categories from products/services */}
              {Array.from(new Set(
                activeTab === 'products' 
                  ? products.map(p => p.category).filter(Boolean)
                  : services.map(s => s.categoryId).filter(Boolean)
              )).map(cat => (
                <button 
                  key={cat}
                  className={cn("w-full text-left px-3 py-3 text-sm font-medium border-l-2 transition-colors truncate", selectedCategory === cat ? "border-blue-600 bg-blue-50/50 text-blue-700" : "border-transparent text-slate-600 hover:bg-slate-100")}
                  onClick={() => setSelectedCategory(cat)}
                  title={cat}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Items Grid/List */}
            <div className="flex-1 overflow-y-auto p-2 bg-white">
              {displayedCatalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Box size={48} className="mb-3 opacity-50" />
                  <p className="text-sm">Không có dữ liệu hiển thị</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedCatalog.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all group">
                      <div className="flex-1 min-w-0 pr-3">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">{item.name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-slate-500 font-mono">{'sku' in item ? item.sku : item.code}</span>
                          <span className="font-bold text-blue-600">{formatCurrency('salePrice' in item ? item.salePrice : item.price)}</span>
                          {'stock' in item && (
                            <span className={cn("px-1.5 py-0.5 rounded-sm font-medium", item.stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                              Kho: {item.stock}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(item, activeTab)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors shrink-0"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Cart & Payment */}
        <div className="w-full md:w-1/2 lg:w-[55%] flex flex-col bg-[#F8FAFC]">
          
          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto bg-white m-4 mb-2 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800">Danh sách sản phẩm ({cart.length})</h2>
              {cart.length > 0 && (
                <button 
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <ShoppingCart size={48} className="mb-3 opacity-30" />
                  <p className="text-sm">Chưa có sản phẩm nào trong giỏ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{formatCurrency(item.price)}</div>
                      </div>
                      
                      <div className="flex items-center bg-white border border-slate-200 rounded-md">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-l-md"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="px-3 py-1 text-sm font-semibold text-slate-800 min-w-[32px] text-center">
                          {item.quantity}
                        </div>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-r-md"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="w-24 text-right font-bold text-slate-800 text-sm">
                        {formatCurrency(item.price * item.quantity)}
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-white p-4 mx-4 mb-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <div className="grid grid-cols-2 gap-8">
              
              {/* Financial Summary */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Tổng tiền hàng</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Giảm giá</span>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 rounded-md p-0.5">
                      <button 
                        className={cn("px-2 py-0.5 text-xs font-semibold rounded-sm transition-colors", discountType === 'percent' ? 'bg-white shadow-sm' : 'text-slate-500')}
                        onClick={() => setDiscountType('percent')}
                      >%</button>
                      <button 
                        className={cn("px-2 py-0.5 text-xs font-semibold rounded-sm transition-colors", discountType === 'amount' ? 'bg-white shadow-sm' : 'text-slate-500')}
                        onClick={() => setDiscountType('amount')}
                      >₫</button>
                    </div>
                    <input 
                      type="number" 
                      className="w-24 text-right border border-slate-200 rounded-md py-1 px-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      value={discount || ''}
                      onChange={e => setDiscount(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Thuế (VAT)</span>
                  <select 
                    className="border border-slate-200 rounded-md py-1 px-2 text-sm focus:ring-blue-500 focus:border-blue-500 text-right"
                    value={tax}
                    onChange={e => setTax(Number(e.target.value))}
                  >
                    <option value={0}>Không thuế</option>
                    <option value={5}>5%</option>
                    <option value={8}>8%</option>
                    <option value={10}>10%</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-base">Tổng thanh toán</span>
                  <span className="font-black text-blue-600 text-xl">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-800 mb-2">Thanh toán</div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors", paymentMethod === 'cash' ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200")}
                    onClick={() => setPaymentMethod('cash')}
                  >Tiền mặt</button>
                  <button 
                    className={cn("flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors", paymentMethod === 'transfer' ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200")}
                    onClick={() => setPaymentMethod('transfer')}
                  >Chuyển khoản</button>
                </div>

                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-slate-500">Khách đưa</span>
                  <input 
                    type="number" 
                    className="w-32 text-right border border-slate-200 rounded-md py-1.5 px-2 text-sm font-bold text-slate-800 focus:ring-blue-500 focus:border-blue-500 bg-blue-50/50"
                    value={amountGiven}
                    onChange={e => setAmountGiven(Number(e.target.value))}
                    placeholder={totalAmount.toString()}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Tiền thừa trả khách</span>
                  <span className="font-bold text-green-600">{formatCurrency(changeGiven > 0 ? changeGiven : 0)}</span>
                </div>

                <input 
                  type="text" 
                  placeholder="Ghi chú thanh toán (nếu có)"
                  className="w-full text-sm border border-slate-200 rounded-md py-1.5 px-3 bg-slate-50 focus:ring-blue-500 focus:border-blue-500"
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
              <button 
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                onClick={() => setCart([])}
              >
                Hủy đơn
              </button>
              <div className="flex-1"></div>
              <button 
                className="px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-2"
                onClick={() => handleSaveOrder('pending')}
              >
                <Save size={16} /> Lưu tạm (F8)
              </button>
              <button 
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2"
                onClick={() => handleSaveOrder('paid')}
              >
                <CheckCircle2 size={18} /> Thanh toán (F9)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
