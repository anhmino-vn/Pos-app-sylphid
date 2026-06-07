import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  getDocs,
  writeBatch,
  updateDoc,
  deleteDoc,
  where
} from '../lib/firebaseAdapter';
import { db, supabase, Order, Product, Service, Customer } from '../lib/supabase';
import { PrintOrderReceipt } from '../components/printing/PrintOrderReceipt';
import { exportPdf, exportWord, exportExcelBulk, printElement } from '../lib/printUtils';
import { 
  CreditCard,
  Plus, 
  Search, 
  ShoppingCart, 
  X, 
  Trash2, 
  Minus, 
  ChevronRight,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  Loader2,
  Printer,
  ChevronLeft,
  Filter,
  Tag,
  User,
  Users,
  Phone,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ClipboardList,
  Sparkles,
  LayoutGrid,
  Eye,
  FileEdit,
  MoreHorizontal,
  Download,
  FileText,
  FileSpreadsheet
} from 'lucide-react';

interface CartItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  stock?: number;
  image?: string;
  note?: string;
}
import { formatCurrency, formatDate, cn, generateExportFileName, parseSafeDate } from '../lib/utils';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { useSettings } from '../lib/settings';
import { useDateFilterStore } from '../store/useDateFilterStore';

import { DateFilter, DateRange } from '../components/DateFilter';
import { format, startOfMonth, endOfDay } from 'date-fns';

export function Orders() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { dateRange, setDateRange } = useDateFilterStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'unpaid' | 'paid' | 'cancelled' | 'deposit'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [amountGiven, setAmountGiven] = useState<number | ''>('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [printCustomSizeModalOpen, setPrintCustomSizeModalOpen] = useState(false);
  const [printWidth, setPrintWidth] = useState('210');
  const [printHeight, setPrintHeight] = useState('297');

  // POS State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posTab, setPosTab] = useState<'products' | 'services'>('products');
  const [posCustomerId, setPosCustomerId] = useState<string | null>(null);
  const [posCustomerSearchTerm, setPosCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [posReferredById, setPosReferredById] = useState<string | null>(null);
  const [posReferrerSearchTerm, setPosReferrerSearchTerm] = useState('');
  const [isReferrerDropdownOpen, setIsReferrerDropdownOpen] = useState(false);
  const referrerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
           setIsCustomerDropdownOpen(false);
        }
        if (referrerDropdownRef.current && !referrerDropdownRef.current.contains(event.target as Node)) {
           setIsReferrerDropdownOpen(false);
        }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const customerStats = useMemo(() => {
    const stats: Record<string, { orderCount: number, totalSpend: number }> = {};
    orders.forEach(o => {
      if (o.status !== 'cancelled' && !o.deletedAt) {
         if (!stats[o.customerId]) stats[o.customerId] = { orderCount: 0, totalSpend: 0 };
         stats[o.customerId].orderCount += 1;
         stats[o.customerId].totalSpend += o.totalAmount || 0;
      }
    });
    return stats;
  }, [orders]);

  const filteredCustomers = useMemo(() => {
     let filtered = customers;
     if (posCustomerSearchTerm) {
        const term = posCustomerSearchTerm.toLowerCase();
        filtered = customers.filter(c => 
           (c.name && c.name.toLowerCase().includes(term)) || 
           (c.phone && c.phone.includes(term)) ||
           (c.id && c.id.toLowerCase().includes(term))
        );
     }
     
     // Deduplicate by phone
     const unique = new Map<string, any>();
     filtered.forEach(c => {
         const key = (c.phone || '').trim() || c.id;
         if (!unique.has(key)) {
             unique.set(key, c);
         }
     });
     return Array.from(unique.values()).slice(0, 50);
  }, [customers, posCustomerSearchTerm]);
  
  const filteredReferrers = useMemo(() => {
     let filtered = customers;
     if (posReferrerSearchTerm) {
        const term = posReferrerSearchTerm.toLowerCase();
        filtered = customers.filter(c => 
           (c.name && c.name.toLowerCase().includes(term)) || 
           (c.phone && c.phone.includes(term)) ||
           (c.id && c.id.toLowerCase().includes(term))
        );
     }
     
     const unique = new Map<string, any>();
     filtered.forEach(c => {
         const key = (c.phone || '').trim() || c.id;
         if (!unique.has(key) && c.id !== posCustomerId) { // cannot refer itself
             unique.set(key, c);
         }
     });
     return Array.from(unique.values()).slice(0, 50);
  }, [customers, posReferrerSearchTerm, posCustomerId]);

  const handleSelectReferrer = (c: any) => {
     setPosReferredById(c.id);
     setPosReferrerSearchTerm(`${c.name} - ${c.phone}`);
     setIsReferrerDropdownOpen(false);
  };

  const handleSelectCustomer = (c: any) => {
     setPosCustomerId(c.id);
     setPosCustomerSearchTerm(`${c.name} - ${c.phone}`);
     setCustomerName(c.name);
     setCustomerPhone(c.phone || '');
     setCustomerAddress(c.address || '');
     setCustomerNote(c.note || '');
     if ((c as any).referredById) {
       const ref = customers.find(x => x.id === (c as any).referredById);
       if (ref) {
         setPosReferredById(ref.id!);
         setPosReferrerSearchTerm(`${ref.name} - ${ref.phone}`);
       } else {
         setPosReferredById(null);
         setPosReferrerSearchTerm('');
       }
     } else {
       setPosReferredById(null);
       setPosReferrerSearchTerm('');
     }
     setIsCustomerDropdownOpen(false);
  };
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerGender, setCustomerGender] = useState('');
  const [customerBirthDate, setCustomerBirthDate] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'vnd' | 'percent'>('vnd');
  const [shippingFee, setShippingFee] = useState(0);
  const [posSearchSearchTerm, setPosSearchSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [posStatus, setPosStatus] = useState<'pending' | 'paid' | 'unpaid' | 'cancelled'>('pending');
  const [posNote, setPosNote] = useState('');
  const [posOrderDate, setPosOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [posOrderTime, setPosOrderTime] = useState(format(new Date(), 'HH:mm'));

  const getOrderTimestamp = () => {
    if (posOrderDate && posOrderTime) {
      return Timestamp.fromDate(new Date(`${posOrderDate}T${posOrderTime}:00`));
    }
    return serverTimestamp();
  };

  const canAdd = profile?.role === 'admin' || profile?.permissions?.orders?.add;
  const canEdit = profile?.role === 'admin' || profile?.permissions?.orders?.edit;
  const canDelete = profile?.role === 'admin' || profile?.permissions?.orders?.delete;
  
  const location = useLocation();

  useEffect(() => {
     if (location.state?.autoCreateOrderForCustomer) {
        setIsModalOpen(true);
        // Wait for customers to be loaded
        setTimeout(() => {
           setPosCustomerId(location.state.autoCreateOrderForCustomer);
           // Clear state to prevent reopening on reload
           window.history.replaceState({}, document.title);
        }, 500);
     } else if (location.state?.action === 'create') {
        setIsModalOpen(true);
        window.history.replaceState({}, document.title);
     }
  }, [location.state]);

  useEffect(() => {
     // Apply pre-selected customer detail when posCustomerId updates and customers are loaded
     if (posCustomerId && posCustomerId !== 'new') {
         const c = customers.find(x => x.id === posCustomerId);
         if (c) {
            setCustomerName(c.name);
            setCustomerPhone(c.phone || '');
            setCustomerAddress(c.address || '');
            setCustomerNote(c.note || '');
            setPosCustomerSearchTerm(`${c.name} - ${c.phone}`);
         }
     }
  }, [posCustomerId, customers]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).filter(o => !o.deletedAt));
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)).filter(p => p.status === 'active'));
    });

    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)).filter(s => s.status === 'active'));
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const activeCustomers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
        .filter((c: any) => c.status !== 'inactive' && !c.deletedAt && !c.deleted_at && !c.hidden);
      setCustomers(activeCustomers);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeServices();
      unsubscribeCustomers();
    };
  }, []);

  const addToCart = (item: Product | Service, type: 'product' | 'service') => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === type);
      if (existing) {
        return prev.map(i => i.id === item.id && i.type === type ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        id: item.id!, 
        type, 
        name: item.name, 
        price: type === 'product' ? (item as Product).salePrice || (item as Product).listPrice : ((item as Service).promoPrice || (item as Service).price),
        originalPrice: type === 'product' ? (item as Product).listPrice : (item as Service).price,
        quantity: 1,
        stock: type === 'product' ? (item as Product).stock : undefined,
        image: item.images?.[0]
      }];
    });
  };

  const removeFromCart = (id: string, type: string) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.type === type)));
  };

  const updateQuantity = (id: string, type: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.type === type) {
        const newQty = Math.max(1, item.quantity + delta);
        if (item.type === 'product' && item.stock !== undefined && newQty > item.stock) {
          toast.error('Không đủ hàng trong kho!');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateItemPrice = (id: string, type: string, newPrice: number) => {
    setCart(prev => prev.map(item => (item.id === id && item.type === type) ? { ...item, price: newPrice } : item));
  };

  const updateItemNote = (id: string, type: string, note: string) => {
    setCart(prev => prev.map(item => (item.id === id && item.type === type) ? { ...item, note } : item));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const calculatedDiscountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
  const total = subtotal - calculatedDiscountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (editingOrderId ? !canEdit : !canAdd) {
      toast.error(`Bạn không có quyền ${editingOrderId ? 'sửa' : 'tạo'} đơn hàng.`);
      return;
    }
    if (cart.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm/dịch vụ vào đơn hàng.');
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const orderItems = cart.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          originalPrice: item.originalPrice || item.price,
          image: item.image || '',
          note: item.note || ''
      }));

      const finalAmountGiven = posPaymentMethod === 'cash' ? Number(amountGiven || total) : total;
      const finalChangeGiven = finalAmountGiven > total ? finalAmountGiven - total : 0;

      // CUSTOMER CRM: Find or create customer
      let finalCustomerId = posCustomerId;
      if (isNewCustomer && posCustomerId === 'new') {
         if (customerPhone && customerPhone.trim()) {
            const cleanPhone = customerPhone.trim();
            // Check both state and DB to strictly prevent ghost data
            let existingCustomer = customers.find(c => (c.phone || '').trim() === cleanPhone);
            
            if (!existingCustomer) {
                const q = query(collection(db, 'customers'), where('phone', '==', cleanPhone));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    existingCustomer = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                }
            }

            if (existingCustomer) {
                finalCustomerId = existingCustomer.id!;
                const customerUpdateData: any = {};
                // Reactivate if inactive
                if (existingCustomer.status === 'inactive') customerUpdateData.status = 'active';
                // Update referredById if it was empty and we provided one
                if (!existingCustomer.referredById && posReferredById) {
                   customerUpdateData.referredById = posReferredById;
                }
                
                if (Object.keys(customerUpdateData).length > 0) {
                   customerUpdateData.updatedAt = serverTimestamp();
                   batch.update(doc(db, 'customers', finalCustomerId), customerUpdateData);
                }
            } else {
                const newCustRef = doc(collection(db, 'customers'));
                finalCustomerId = newCustRef.id;
                batch.set(newCustRef, {
                    name: customerName || 'Khách lẻ',
                    phone: cleanPhone,
                    gender: customerGender,
                    birthDate: customerBirthDate,
                    address: customerAddress,
                    note: customerNote,
                    status: 'active',
                    tier: 'bronze',
                    totalSpend: 0,
                    orderCount: 0,
                    referredById: posReferredById || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
         } else {
             // DO NOT create spam customers in CRM if no phone is provided. Link to 'retail' or existing generic.
             finalCustomerId = 'retail';
         }
      } else if (finalCustomerId && finalCustomerId !== 'retail' && posReferredById) {
          // If existing customer selected but we want to update their referrer (only if they don't have one)
          const existingCustomer = customers.find(c => c.id === finalCustomerId);
          if (existingCustomer && !existingCustomer.referredById) {
              batch.update(doc(db, 'customers', finalCustomerId), {
                  referredById: posReferredById,
                  updatedAt: serverTimestamp()
              });
          }
      }
      
      if (!finalCustomerId) finalCustomerId = 'retail';
      
      const referrerName = posReferredById ? (customers.find(c => c.id === posReferredById)?.name || posReferrerSearchTerm.split(' - ')[0]) : '';

      if (editingOrderId) {
         const orderRef = doc(db, 'orders', editingOrderId);
         const orderToUpdate = orders.find(o => o.id === editingOrderId);
         
         const updatePayload: any = {
           customerId: finalCustomerId,
           customerName,
           customerPhone,
           referredById: posReferredById || '',
           referredByName: referrerName,
           items: orderItems,
           subtotal,
           discount: calculatedDiscountAmount,
           shippingFee,
           totalAmount: total,
           paymentMethod: posPaymentMethod,
           status: posStatus,
           amountGiven: posStatus === 'paid' ? finalAmountGiven : 0,
           changeGiven: posStatus === 'paid' ? finalChangeGiven : 0,
           note: posNote,
           createdAt: getOrderTimestamp(),
           updatedAt: serverTimestamp()
         };
         batch.update(orderRef, updatePayload);
         
         // Handle Inventory diff logic for Editing order
         if (orderToUpdate?.status === 'paid' && settings.inventory.autoDeductOnPaid) {
             orderToUpdate.items.filter(i => i.type === 'product').forEach(item => {
                 const product = products.find(p => p.id === item.id);
                 if (product) {
                     batch.update(doc(db, 'products', item.id), {
                         stock: product.stock + item.quantity, 
                         updatedAt: serverTimestamp()
                     });
                 }
             });
         }
         if (posStatus === 'paid' && settings.inventory.autoDeductOnPaid) {
             orderItems.filter(i => i.type === 'product').forEach(item => {
                 const product = products.find(p => p.id === item.id);
                 if (product) {
                     batch.update(doc(db, 'products', item.id), {
                         stock: Math.max(0, product.stock - item.quantity),
                         updatedAt: serverTimestamp()
                     });
                 }
             });
         }

         await batch.commit();
         if (selectedOrder?.id === editingOrderId) {
            setSelectedOrder(prev => prev ? { ...prev, ...updatePayload } : null);
         }
         toast.success('Cập nhật giao dịch thành công!');
      } else {
         const orderData: Omit<Order, 'id'> = {
           customerId: finalCustomerId,
           customerName,
           customerPhone,
           referredById: posReferredById || '',
           referredByName: referrerName,
           items: orderItems,
           subtotal,
           discount: calculatedDiscountAmount,
           shippingFee,
           totalAmount: total,
           paymentMethod: posPaymentMethod,
           status: posStatus,
           amountGiven: posStatus === 'paid' ? finalAmountGiven : 0,
           changeGiven: posStatus === 'paid' ? finalChangeGiven : 0,
           note: posNote,
           createdAt: getOrderTimestamp(),
           createdBy: profile?.id || profile?.uid,
           creatorName: profile?.displayName || profile?.email
         } as any; 
         
         const orderRef = doc(collection(db, 'orders'));
         batch.set(orderRef, orderData);

         if (posStatus === 'paid' && settings.inventory.autoDeductOnPaid) {
            orderItems.filter(i => i.type === 'product').forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    batch.update(doc(db, 'products', item.id), {
                        stock: Math.max(0, product.stock - item.quantity),
                        updatedAt: serverTimestamp()
                    });
                }
            });
         }

         await batch.commit();
         toast.success('Tạo giao dịch thành công!');
      }

      setIsModalOpen(false);
      resetPOS();
    } catch (error) {
      console.error(error);
      toast.error('Lỗi lưu giao dịch! Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (order: Order) => {
     setEditingOrderId(order.id!);
     setPosCustomerId(order.customerId || null);
     if (order.customerId) {
        setIsNewCustomer(false);
        setPosCustomerSearchTerm(`${order.customerName} - ${order.customerPhone}`);
     } else {
        setIsNewCustomer(true);
        setPosCustomerSearchTerm('');
     }
     
     setCustomerName(order.customerName || '');
     setCustomerPhone(order.customerPhone || '');
     
     setPosReferredById(order.referredById || null);
     if (order.referredById) {
        const ref = customers.find(c => c.id === order.referredById);
        if (ref) setPosReferrerSearchTerm(`${ref.name} - ${ref.phone}`);
        else setPosReferrerSearchTerm(order.referredByName || '');
     } else {
        setPosReferrerSearchTerm('');
     }

     setDiscount(order.discount || 0);
     setDiscountType('vnd');
     setShippingFee(order.shippingFee || 0);
     setPosPaymentMethod(order.paymentMethod as any || 'cash');
     setPosStatus(order.status || 'pending');
     setPosNote(order.note || '');
     const d = parseSafeDate(order.createdAt);
     setPosOrderDate(format(d, 'yyyy-MM-dd'));
     setPosOrderTime(format(d, 'HH:mm'));
     
     const loadedCart = order.items.map(i => {
         const p = products.find(prod => prod.id === i.id);
         const s = services.find(srv => srv.id === i.id);
         return {
            id: i.id,
            type: i.type,
            name: i.name,
            price: i.price,
            originalPrice: i.originalPrice || i.price,
            quantity: i.quantity,
            stock: p?.stock,
            image: i.type === 'product' ? p?.images?.[0] : s?.images?.[0],
            note: i.note || ''
         };
     });
     setCart(loadedCart);
     setIsModalOpen(true);
     setSelectedOrder(null);
  };

  const resetPOS = () => {
    setEditingOrderId(null);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPosCustomerId(null);
    setPosCustomerSearchTerm('');
    setPosReferredById(null);
    setPosReferrerSearchTerm('');
    setDiscount(0);
    setDiscountType('vnd');
    setShippingFee(0);
    setPosNote('');
    setPosStatus('pending');
    setPosPaymentMethod('cash');
    setPosOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setPosOrderTime(format(new Date(), 'HH:mm'));
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!canEdit) {
      toast.error('Bạn không có quyền cập nhật đơn hàng.');
      return;
    }
    
    // We also need access to the current order items to adjust inventory. Let's find it.
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    
    // Validate inventory deduction warning? No warning needed, we just deduct.
    
    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderId);
      
      let updatePayload: any = {
         status: newStatus,
         updatedAt: serverTimestamp()
      };
      batch.update(orderRef, updatePayload);
      
      // Handle Inventory Logic
      if (newStatus === 'paid' && orderToUpdate.status !== 'paid' && settings.inventory.autoDeductOnPaid) {
          // Deduct from inventory
          orderToUpdate.items.filter(i => i.type === 'product').forEach(item => {
             const product = products.find(p => p.id === item.id);
             if (product) {
                batch.update(doc(db, 'products', item.id), {
                   stock: Math.max(0, product.stock - item.quantity),
                   updatedAt: serverTimestamp()
                });
             }
          });
      } else if (newStatus === 'cancelled' && orderToUpdate.status === 'paid' && settings.inventory.autoRestockOnCancel) {
          // Refund inventory
          orderToUpdate.items.filter(i => i.type === 'product').forEach(item => {
             const product = products.find(p => p.id === item.id);
             if (product) {
                batch.update(doc(db, 'products', item.id), {
                   stock: product.stock + item.quantity,
                   updatedAt: serverTimestamp()
                });
             }
          });
      }

      // Handle Loyalty Reversal for cancellation
      if (newStatus === 'cancelled' && orderToUpdate.status === 'paid') {
          if (orderToUpdate.customerId) {
             const customer = customers.find(c => c.id === orderToUpdate.customerId);
             if (customer) {
                let pointDiff = 0;
                let newUsedPoints = customer.usedPoints || 0;
                let newTotalPoints = customer.totalPoints || 0;

                try {
                  const logsQ = query(collection(db, 'loyalty_logs'), where('orderId', '==', orderId));
                  const logsSnap = await getDocs(logsQ);
                  logsSnap.docs.forEach(docSnap => {
                      const log = docSnap.data();
                      if (log.type === 'earn' || log.type === 'referral') {
                          pointDiff -= log.points;
                          newTotalPoints -= log.points;
                      } else if (log.type === 'redeem') {
                          pointDiff += log.points;
                          newUsedPoints -= log.points;
                      }
                      batch.delete(docSnap.ref); // Remove log to reverse it
                  });
                } catch (e) {
                  console.warn('loyalty_logs table might not exist, skipping logs deletion');
                }
                
                batch.update(doc(db, 'customers', orderToUpdate.customerId), {
                   updatedAt: serverTimestamp()
                });
             }
          }
      }
      
      await batch.commit();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi cập nhật trạng thái!');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Đã thanh toán';
      case 'pending': return 'Chờ xử lý';
      case 'unpaid': return 'Chưa thanh toán';
      case 'cancelled': return 'Đã hủy';
      case 'completed': return 'Thành công'; // fallback
      case 'shipping': return 'Đang giao'; // fallback
      default: return status;
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, orderId: string, order: any, isBulk?: boolean}>({ isOpen: false, orderId: '', order: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleDeleteOrder = async (orderId: string) => {
    if (!canDelete) {
      toast.error('Bạn không có quyền xóa đơn hàng.');
      return;
    }
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    setDeleteConfirm({ isOpen: true, orderId: orderId, order: o });
  };

  const handleBulkDelete = () => {
    if (!canDelete) {
      toast.error('Bạn không có quyền xóa đơn hàng.');
      return;
    }
    setDeleteConfirm({ isOpen: true, orderId: '', order: null, isBulk: true });
  };

  const executeDeleteOrder = async () => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
          const batch = writeBatch(db);
          let deleted = 0;
          for (const id of selectedIds) {
             const o = orders.find(x => x.id === id);
             if (!o) continue;

             const orderRef = doc(db, 'orders', id);

             // Refund inventory if paid and autoDeductOnPaid is enabled
             if (o.status === 'paid' && settings.inventory.autoDeductOnPaid) {
                 o.items.filter((i: any) => i.type === 'product').forEach((item: any) => {
                     const product = products.find(p => p.id === item.id);
                     if (product) {
                         batch.update(doc(db, 'products', item.id), {
                             stock: product.stock + item.quantity,
                             updatedAt: serverTimestamp()
                         });
                     }
                 });
             }

             // Revert customer CRM for bulk delete
             if (o.customerId && o.status === 'paid') {
                 const customer = customers.find(c => c.id === o.customerId);
                 if (customer) {
                     const spendDeduct = o.totalAmount;
                     let pointDiff = 0;
                     let newUsedPoints = customer.usedPoints || 0;
                     let newTotalPoints = customer.totalPoints || 0;
                     
                     // Loyalty point reversal
                     try {
                         const logsQ = query(collection(db, 'loyalty_logs'), where('orderId', '==', id));
                         const logsSnap = await getDocs(logsQ);
                         logsSnap.docs.forEach(docSnap => {
                             const log = docSnap.data();
                             if (log.type === 'earn' || log.type === 'referral') {
                                 pointDiff -= log.points;
                                 newTotalPoints -= log.points;
                             } else if (log.type === 'redeem') {
                                 pointDiff += log.points;
                                 newUsedPoints -= log.points;
                             }
                             batch.delete(docSnap.ref);
                         });
                     } catch (e) {
                         console.warn('loyalty_logs table might not exist, skipping logs deletion');
                     }

                     batch.update(doc(db, 'customers', o.customerId), {
                         orderCount: Math.max(0, (customer.orderCount || 0) - 1),
                         totalSpend: Math.max(0, (customer.totalSpend || 0) - spendDeduct),
                         updatedAt: serverTimestamp()
                     });
                 }
             }

             // We soft delete the order
             batch.update(orderRef, {
               deletedAt: serverTimestamp(),
               status: 'cancelled', // mark cancelled as well for safety
               deletedBy: profile?.id || profile?.uid || null
             });

             // We should also delete or soft delete the transaction if we want, but better just update it
             try {
                 const transQ = query(collection(db, 'customer_transactions'), where('orderId', '==', id));
                 const transSnap = await getDocs(transQ);
                 transSnap.docs.forEach(d => {
                    batch.delete(d.ref); // hard delete the transaction log to clean up CRM
                 });
             } catch (e) {
                 console.warn('customer_transactions table might not exist, skipping');
             }

             // Ensure we add an activity log
             const logRef = doc(collection(db, 'activity_logs'));
             batch.set(logRef, {
                 action: 'delete_order',
                 userId: profile?.id || profile?.uid || null,
                 userEmail: profile?.email || '',
                 userName: profile?.displayName || '',
                 details: JSON.stringify({ orderId: id, amount: o.totalAmount }),
                 module: 'orders',
                 createdAt: serverTimestamp()
             });
             deleted++;
          }

          await batch.commit();

          setDeleteConfirm({ isOpen: false, orderId: '', order: null });
          setSelectedIds([]);
          toast.success(`Đã xóa ${deleted} đơn hàng thành công!`);
       } catch (error) {
          console.error(error);
          toast.error('Lỗi khi xóa nhiều đơn hàng!');
       }
       return;
    }

    if (!deleteConfirm.orderId || !deleteConfirm.order) return;
    const { orderId, order: o } = deleteConfirm;

    try {
      const batch = writeBatch(db);
      const orderRef = doc(db, 'orders', orderId);

      // Refund inventory if paid and autoDeductOnPaid is enabled
      if (o.status === 'paid' && settings.inventory.autoDeductOnPaid) {
          o.items.filter((i: any) => i.type === 'product').forEach((item: any) => {
              const product = products.find(p => p.id === item.id);
              if (product) {
                  batch.update(doc(db, 'products', item.id), {
                      stock: product.stock + item.quantity,
                      updatedAt: serverTimestamp()
                  });
              }
          });
      }

      // Revert customer CRM
      if (o.customerId && o.status === 'paid') {
          const customer = customers.find(c => c.id === o.customerId);
          if (customer) {
              const spendDeduct = o.totalAmount;
              let pointDiff = 0;
              let newUsedPoints = customer.usedPoints || 0;
              let newTotalPoints = customer.totalPoints || 0;
              
              // Loyalty point reversal
              try {
                  const logsQ = query(collection(db, 'loyalty_logs'), where('orderId', '==', orderId));
                  const logsSnap = await getDocs(logsQ);
                  logsSnap.docs.forEach(docSnap => {
                      const log = docSnap.data();
                      if (log.type === 'earn' || log.type === 'referral') {
                          pointDiff -= log.points;
                          newTotalPoints -= log.points;
                      } else if (log.type === 'redeem') {
                          pointDiff += log.points;
                          newUsedPoints -= log.points;
                      }
                      batch.delete(docSnap.ref);
                  });
              } catch (e) {
                  console.warn('loyalty_logs table might not exist, skipping logs deletion');
              }

              batch.update(doc(db, 'customers', o.customerId), {
                  orderCount: Math.max(0, (customer.orderCount || 0) - 1),
                  totalSpend: Math.max(0, (customer.totalSpend || 0) - spendDeduct),
                  updatedAt: serverTimestamp()
              });
          }
      }

      // We soft delete the order
      batch.update(orderRef, {
        deletedAt: serverTimestamp(),
        status: 'cancelled', // mark cancelled as well for safety
        deletedBy: profile?.id || profile?.uid || null
      });

      // We should also delete or soft delete the transaction if we want, but better just update it
      try {
        const transQ = query(collection(db, 'customer_transactions'), where('orderId', '==', orderId));
        const transSnap = await getDocs(transQ);
        transSnap.docs.forEach(d => {
           batch.delete(d.ref); // hard delete the transaction log to clean up CRM
        });
      } catch (e) {
        console.warn('customer_transactions table might not exist, skipping');
      }

      // Ensure we add an activity log
      const logRef = doc(collection(db, 'activity_logs'));
      batch.set(logRef, {
          action: 'delete_order',
          userId: profile?.id || profile?.uid || null,
          userEmail: profile?.email || '',
          userName: profile?.displayName || '',
          details: JSON.stringify({ orderId: orderId, amount: o.totalAmount }),
          module: 'orders',
          createdAt: serverTimestamp()
      });

      await batch.commit();

      setDeleteConfirm({ isOpen: false, orderId: '', order: null });
      setSelectedOrder(null);
      toast.success('Đã xóa đơn hàng thành công!');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Lỗi khi xóa: ${error?.message || error?.details || JSON.stringify(error)}`);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    const finalAmountGiven = paymentMethod === 'cash' ? Number(amountGiven) : selectedOrder.totalAmount;
    if (paymentMethod === 'cash' && finalAmountGiven < selectedOrder.totalAmount) {
       toast.error('Số tiền khách đưa không được nhỏ hơn tổng thanh toán.');
       return;
    }
    const finalChangeGiven = finalAmountGiven - selectedOrder.totalAmount;
    
    try {
       const batch = writeBatch(db);
       
       batch.update(doc(db, 'orders', selectedOrder.id!), {
          status: 'paid',
          paymentMethod: paymentMethod,
          amountGiven: finalAmountGiven,
          changeGiven: finalChangeGiven,
          updatedAt: serverTimestamp()
       });
       
       // Handle Inventory Logic Deduction
       if (selectedOrder.status !== 'paid' && settings.inventory.autoDeductOnPaid) {
          selectedOrder.items.filter(i => i.type === 'product').forEach(item => {
             const product = products.find(p => p.id === item.id);
             if (product) {
                batch.update(doc(db, 'products', item.id), {
                   stock: Math.max(0, product.stock - item.quantity),
                   updatedAt: serverTimestamp()
                });
             }
          });
       }

       // Handle Customer logic
       await batch.commit();
       setSelectedOrder(prev => prev ? { ...prev, status: 'paid', paymentMethod, amountGiven: finalAmountGiven, changeGiven: finalChangeGiven } : null);
       setAmountGiven('');
       toast.success('Thanh toán thành công!');
       
       // Tự động in hóa đơn
       setTimeout(() => {
          printElement('print-order-receipt-thermal', '80mm');
       }, 500);
    } catch (e) {
       console.error(e);
       toast.error('Lỗi thanh toán!');
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedOrder || !canEdit) return;
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id!), {
        customerName: editCustomerName,
        customerPhone: editCustomerPhone,
        updatedAt: serverTimestamp()
      });
      setSelectedOrder({ ...selectedOrder, customerName: editCustomerName, customerPhone: editCustomerPhone });
      setIsEditingCustomer(false);
    } catch (error) {
       console.error(error);
       toast.error('Lỗi cập nhật!');
    }
  };

  const filteredOrders = orders.filter(o => {
    // DEBUG:
    if (orders.length > 0 && o.id === orders[0].id) {
       const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
       console.log("DEBUG Date Filter:", {
          orderId: o.id,
          createdAtRaw: o.createdAt,
          parsedDate: od,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          matchesDate: dateRange.startDate && dateRange.endDate ? (od >= dateRange.startDate && od <= dateRange.endDate) : true
       });
    }
    const displayId = `tx-${(o.id || '').slice(-6).toLowerCase()}`;
    const cleanSearchTerm = searchTerm.toLowerCase().trim();
    const cleanSearchTermNoWs = cleanSearchTerm.replace(/\s+/g, '');
    
    const matchesSearch = (o.customerName?.toLowerCase() || '').includes(cleanSearchTerm) || 
                         (o.customerPhone || '').includes(cleanSearchTerm) ||
                         (o.id?.toLowerCase() || '').includes(cleanSearchTerm) ||
                         displayId.includes(cleanSearchTermNoWs);
                         
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesPaymentMethod = paymentMethodFilter === 'all' || o.paymentMethod === paymentMethodFilter;
    let matchesDate = true;
    if (dateRange.startDate && dateRange.endDate && o.createdAt) {
       const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
       matchesDate = od >= dateRange.startDate && od <= dateRange.endDate;
    }
    return matchesSearch && matchesStatus && matchesPaymentMethod && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = useMemo(() => {
     const startIndex = (currentPage - 1) * itemsPerPage;
     return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const posFilteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(posSearchSearchTerm.toLowerCase()) || 
                         p.sku.toLowerCase().includes(posSearchSearchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // ================= STATISTICS ================= //
  const ordersInDateRange = orders.filter(o => {
    if (!dateRange.startDate || !dateRange.endDate || !o.createdAt) return true;
    const od = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    return od >= dateRange.startDate && od <= dateRange.endDate;
  });

  const totalPaid = ordersInDateRange.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalUnpaid = ordersInDateRange.filter(o => o.status === 'unpaid').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalPending = ordersInDateRange.filter(o => o.status === 'pending').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const totalCancelled = ordersInDateRange.filter(o => o.status === 'cancelled').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  // ============================================== //

  return (
    <div className="space-y-6 relative min-h-[80vh]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Quản lý giao dịch</h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">Lịch sử bán hàng, tình trạng giao hàng và đối soát tài chính.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto pb-2 lg:pb-0">
           {selectedIds.length > 0 && (
             <div className="flex gap-2 w-full lg:w-auto">
               {canDelete && (
                 <button 
                   onClick={handleBulkDelete}
                   className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 md:gap-3 px-2 md:px-6 py-3 md:py-3.5 bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                 >
                   <Trash2 className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                   <span className="hidden sm:inline">Xóa {selectedIds.length} mục</span>
                   <span className="sm:hidden">Xóa {selectedIds.length}</span>
                 </button>
               )}
               <div className="relative flex-1 lg:flex-none">
                 <button 
                   onClick={() => setOpenDropdownId(openDropdownId === 'bulk-print' ? null : 'bulk-print')}
                   className="flex w-full items-center justify-center gap-1.5 px-2 md:px-6 py-3 md:py-3.5 bg-slate-800 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                 >
                   <Printer className="w-4 h-4 shrink-0" /> <span className="hidden xl:inline">In Hóa Đơn ({selectedIds.length})</span><span className="xl:hidden">In HD ({selectedIds.length})</span>
                 </button>
                 <AnimatePresence>
                    {openDropdownId === 'bulk-print' && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-1 flex flex-col">
                          <button onClick={() => { setOpenDropdownId(null); printElement('bulk-print-receipts-a4', 'A4'); }} className="px-4 py-3 text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors">In A4</button>
                          <button onClick={() => { setOpenDropdownId(null); printElement('bulk-print-receipts-a4', 'A5'); }} className="px-4 py-3 text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors">In A5</button>
                          <button onClick={() => { setOpenDropdownId(null); setPrintCustomSizeModalOpen(true); }} className="px-4 py-3 text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors">In kích thước tùy chỉnh</button>
                       </motion.div>
                    )}
                 </AnimatePresence>
               </div>
               <div className="relative flex-1 lg:flex-none">
                 <button 
                   onClick={() => setOpenDropdownId(openDropdownId === 'bulk-export' ? null : 'bulk-export')}
                   className="flex w-full items-center justify-center gap-1.5 px-2 md:px-6 py-3 md:py-3.5 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs uppercase tracking-widest hover:bg-blue-100 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                 >
                   <Download className="w-4 h-4 shrink-0" /> <span className="hidden xl:inline">Xuất Hóa Đơn</span><span className="xl:hidden">Xuất File</span>
                 </button>
                 <AnimatePresence>
                    {openDropdownId === 'bulk-export' && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-1 flex flex-col">
                          <button onClick={() => { setOpenDropdownId(null); exportPdf('bulk-print-receipts-a4', `${generateExportFileName(null, 'DanhSachHoaDon')}.pdf`); }} className="px-4 py-3 text-left hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"><FileText className="w-4 h-4"/> Xuất File PDF</button>
                          <button onClick={() => { setOpenDropdownId(null); exportExcelBulk(orders.filter(o => selectedIds.includes(o.id!))); }} className="px-4 py-3 text-left hover:bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Xuất File Excel</button>
                          <button onClick={() => { setOpenDropdownId(null); exportWord('bulk-print-receipts-a4', `${generateExportFileName(null, 'DanhSachHoaDon')}.docx`); }} className="px-4 py-3 text-left hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"><FileText className="w-4 h-4"/> Xuất File Word</button>
                       </motion.div>
                    )}
                 </AnimatePresence>
               </div>
             </div>
           )}
           <div className="flex items-center gap-2 w-full md:w-auto">
               <DateFilter />
               {canAdd && (
                 <button 
                   onClick={() => navigate('/orders/create')}
                   className="flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 h-[48px] md:py-3.5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                 >
                   <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                   Tạo đơn POS
                 </button>
               )}
           </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-[10px] md:text-xs font-bold text-slate-500">Tổng hóa đơn</p>
             <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
               <Users className="w-4 h-4" />
             </div>
           </div>
           <div>
             <p className="text-xl md:text-2xl font-black text-slate-900">{ordersInDateRange.length.toLocaleString('vi-VN')}</p>
             <p className="text-[10px] md:text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
               <ArrowUpRight className="w-3 h-3" /> 12% <span className="text-slate-400 font-medium">so với tháng trước</span>
             </p>
           </div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-[10px] md:text-xs font-bold text-slate-500">Đã thanh toán</p>
             <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
               <CheckCircle2 className="w-4 h-4" />
             </div>
           </div>
           <div>
             <p className="text-xl md:text-2xl font-black text-slate-900">{ordersInDateRange.filter(o => o.status === 'paid').length.toLocaleString('vi-VN')}</p>
             <p className="text-[10px] md:text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
               <ArrowUpRight className="w-3 h-3" /> 78.4%
             </p>
           </div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-[10px] md:text-xs font-bold text-slate-500">Chưa thanh toán</p>
             <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
               <ClipboardList className="w-4 h-4" />
             </div>
           </div>
           <div>
             <p className="text-xl md:text-2xl font-black text-slate-900">{ordersInDateRange.filter(o => o.status === 'unpaid').length.toLocaleString('vi-VN')}</p>
             <p className="text-[10px] md:text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
               <ArrowUpRight className="w-3 h-3" /> 17.5%
             </p>
           </div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-[10px] md:text-xs font-bold text-slate-500">Đã hủy</p>
             <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
               <Trash2 className="w-4 h-4" />
             </div>
           </div>
           <div>
             <p className="text-xl md:text-2xl font-black text-slate-900">{ordersInDateRange.filter(o => o.status === 'cancelled').length.toLocaleString('vi-VN')}</p>
             <p className="text-[10px] md:text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
               <ArrowUpRight className="w-3 h-3" /> 4.1%
             </p>
           </div>
        </div>
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
             <p className="text-[10px] md:text-xs font-bold text-slate-500">Tổng doanh thu</p>
             <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500">
               <ArrowUpRight className="w-4 h-4" />
             </div>
           </div>
           <div>
             <p className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(totalPaid)} đ</p>
             <p className="text-[10px] md:text-xs text-emerald-500 font-bold mt-1 flex items-center gap-1">
               <ArrowUpRight className="w-3 h-3" /> 15.3% <span className="text-slate-400 font-medium">so với tháng trước</span>
             </p>
           </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col xl:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-center">
        <div className="relative flex-1 w-full xl:max-w-[400px]">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm mã đơn, tên khách hàng, SĐT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-3 items-center flex-wrap w-full xl:w-auto ml-auto">
           {/* DateFilter Component can handle styling internally or be wrapped */}
           <DateFilter />
           
           <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 outline-none"
           >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="paid">Đã thanh toán</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="deposit">Đặt cọc</option>
              <option value="cancelled">Đã hủy</option>
           </select>

           <select 
              value={paymentMethodFilter} 
              onChange={e => setPaymentMethodFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 outline-none"
           >
              <option value="all">Phương thức: Tất cả</option>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="momo">Ví MoMo</option>
              <option value="card">Quẹt thẻ</option>
           </select>

           <button 
             onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPaymentMethodFilter('all'); }}
             className="px-4 py-2.5 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-2"
           >
             <Filter className="w-4 h-4" /> Bộ lọc
           </button>
           
           <button 
             onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPaymentMethodFilter('all'); }}
             className="w-10 h-[42px] bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-all"
           >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
           </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex overflow-x-auto scrollbar-hide w-full md:w-auto border-b border-slate-200">
          <div className="flex gap-6 min-w-max px-1">
             <button 
               onClick={() => setStatusFilter('all')}
               className={cn("pb-3 text-sm font-bold border-b-2 transition-all", statusFilter === 'all' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700")}
             >
               Tất cả ({orders.length})
             </button>
             <button 
               onClick={() => setStatusFilter('paid')}
               className={cn("pb-3 text-sm font-bold border-b-2 transition-all", statusFilter === 'paid' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700")}
             >
               Đã thanh toán ({orders.filter(o => o.status === 'paid').length})
             </button>
             <button 
               onClick={() => setStatusFilter('unpaid')}
               className={cn("pb-3 text-sm font-bold border-b-2 transition-all", statusFilter === 'unpaid' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700")}
             >
               Chưa thanh toán ({orders.filter(o => o.status === 'unpaid').length})
             </button>
             <button 
               onClick={() => setStatusFilter('cancelled')}
               className={cn("pb-3 text-sm font-bold border-b-2 transition-all", statusFilter === 'cancelled' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700")}
             >
               Đã hủy ({orders.filter(o => o.status === 'cancelled').length})
             </button>
             <button 
               onClick={() => setStatusFilter('deposit')}
               className={cn("pb-3 text-sm font-bold border-b-2 transition-all", statusFilter === 'deposit' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700")}
             >
               Đặt cọc ({orders.filter(o => o.status === 'deposit').length})
             </button>
          </div>
        </div>
        
        <button 
           onClick={() => exportExcelBulk(orders)}
           className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto overflow-y-visible scrollbar-hide">
          <table className="min-w-[800px] w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-2 py-4 md:px-6 md:py-6 w-8 md:w-12 text-center">
                   <input 
                     type="checkbox"
                     checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
                     onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filteredOrders.map(o => o.id!));
                        else setSelectedIds([]);
                     }}
                     className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                   />
                </th>
                <th className="px-2 md:px-4 py-4 md:py-6 whitespace-nowrap min-w-[100px]">Mã đơn</th>
                <th className="px-2 md:px-4 py-4 md:py-6 min-w-[100px]">Khách hàng</th>
                <th className="px-2 md:px-4 py-4 md:py-6 text-right whitespace-nowrap">Tổng tiền</th>
                <th className="px-2 md:px-4 py-4 md:py-6 text-right whitespace-nowrap hidden lg:table-cell">Khách trả</th>
                <th className="px-2 md:px-4 py-4 md:py-6 whitespace-nowrap text-center">Trạng thái</th>
                <th className="px-2 md:px-4 py-4 md:py-6 whitespace-nowrap text-center hidden xl:table-cell">Phương thức</th>
                <th className="px-2 md:px-4 py-4 md:py-6 whitespace-nowrap text-right hidden sm:table-cell">Ngày tạo</th>
                <th className="px-2 md:px-4 py-4 md:py-6 text-right whitespace-nowrap w-16 md:w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-24 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-20" /></td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={6} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Chưa có dữ liệu giao dịch</td></tr>
              ) : paginatedOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                >
                  <td className="px-2 md:px-6 py-4 md:py-5 w-8 md:w-12 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(order.id!)}
                      onChange={(e) => {
                         if (e.target.checked) setSelectedIds(prev => [...prev, order.id!]);
                         else setSelectedIds(prev => prev.filter(id => id !== order.id!));
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 align-middle" onClick={() => setSelectedOrder(order)}>
                    <div>
                      <p className="font-black text-slate-900 tracking-tight text-[11px] md:text-sm whitespace-nowrap">#TX-{order.id?.slice(-6).toUpperCase()}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 whitespace-nowrap sm:hidden">
                        {order.createdAt ? formatDate(order.createdAt) : '...'}
                      </p>
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 align-middle" onClick={() => setSelectedOrder(order)}>
                    <div className="text-left">
                      <p className="font-black text-slate-800 text-[11px] md:text-sm truncate w-20 md:w-auto">{order.customerName || 'KHÁCH VÃNG LAI'}</p>
                      {order.customerPhone && <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase mt-1 whitespace-nowrap">{order.customerPhone}</p>}
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 text-right align-middle" onClick={() => setSelectedOrder(order)}>
                    <div>
                      <p className="font-black text-slate-900 text-[11px] md:text-sm whitespace-nowrap">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 whitespace-nowrap">{order.items.length} SP</p>
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 text-right align-middle hidden lg:table-cell" onClick={() => setSelectedOrder(order)}>
                    <div>
                      <p className="font-black text-emerald-600 text-[11px] md:text-sm whitespace-nowrap">{formatCurrency(order.amountGiven || (order.status === 'paid' ? order.totalAmount : 0))}</p>
                    </div>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 align-middle text-center" onClick={() => setSelectedOrder(order)}>
                    <span className={cn(
                      "px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 md:gap-2 whitespace-nowrap",
                      order.status === 'paid' ? "bg-emerald-50 text-emerald-600" :
                      order.status === 'pending' ? "bg-amber-50 text-orange-600" :
                      order.status === 'unpaid' ? "bg-orange-50 text-orange-600" :
                      order.status === 'deposit' ? "bg-blue-50 text-blue-600" :
                      "bg-rose-50 text-rose-600"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full hidden sm:block",
                        order.status === 'paid' ? "bg-emerald-500" :
                        order.status === 'pending' ? "bg-amber-500" :
                        order.status === 'unpaid' ? "bg-orange-500" :
                        order.status === 'deposit' ? "bg-blue-500" : "bg-rose-500"
                      )}></div>
                      {getStatusText(order.status)}
                    </span>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 align-middle text-center hidden xl:table-cell" onClick={() => setSelectedOrder(order)}>
                     <span className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
                        {order.paymentMethod === 'transfer' ? <ArrowUpRight className="w-3 h-3 text-blue-500"/> :
                         order.paymentMethod === 'momo' ? <ArrowUpRight className="w-3 h-3 text-pink-500"/> :
                         order.paymentMethod === 'card' ? <ArrowUpRight className="w-3 h-3 text-emerald-500"/> :
                         <ArrowDownRight className="w-3 h-3 text-amber-500" />}
                        {order.paymentMethod === 'transfer' ? 'Chuyển khoản' :
                         order.paymentMethod === 'momo' ? 'Ví MoMo' :
                         order.paymentMethod === 'card' ? 'Quẹt thẻ' : 'Tiền mặt'}
                     </span>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 text-right align-middle hidden sm:table-cell" onClick={() => setSelectedOrder(order)}>
                    <p className="font-bold text-slate-600 text-[10px] md:text-xs">
                       {order.createdAt ? formatDate(order.createdAt) : '...'}
                    </p>
                  </td>
                  <td className="px-2 md:px-4 py-4 md:py-5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {/* Xem */}
                      <div className="relative group/tooltip">
                        <button onClick={() => setSelectedOrder(order)} className="bg-white md:bg-transparent border border-slate-100 md:border-none shadow-sm md:shadow-none hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-colors">
                          <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Xem chi tiết</div>
                      </div>

                      {/* Sửa */}
                      <div className="relative group/tooltip">
                        <button 
                          disabled={!canEdit && profile?.role !== 'admin'}
                          onClick={() => openEditModal(order)} 
                          className="bg-white md:bg-transparent border border-slate-100 md:border-none shadow-sm md:shadow-none hover:bg-slate-100 text-slate-500 hover:text-slate-900 disabled:hover:bg-transparent disabled:opacity-30 rounded-md w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-colors"
                        >
                          <FileEdit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Sửa đơn</div>
                      </div>

                      {/* Thanh toán */}
                      {order.status !== 'paid' && order.status !== 'cancelled' && (
                        <div className="relative group/tooltip">
                          <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               navigate('/orders/payments', { state: { orderData: order } });
                            }} 
                            className="bg-white md:bg-transparent border border-emerald-100 md:border-none shadow-sm md:shadow-none hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 rounded-md w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Thanh toán</div>
                        </div>
                      )}

                      {/* In */}
                      <div className="relative group/tooltip">
                        <button 
                          onClick={async () => {
                             setSelectedOrder(order);
                             setTimeout(() => {
                               printElement('print-order-receipt-thermal', '80mm');
                             }, 100);
                          }} 
                          className="bg-white md:bg-transparent border border-slate-100 md:border-none shadow-sm md:shadow-none hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-md w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">In hóa đơn</div>
                      </div>

                      {/* Xóa */}
                      <div className="relative group/tooltip">
                        <button 
                          disabled={order.status === 'paid' || (!canDelete && profile?.role !== 'admin')}
                          onClick={() => setDeleteConfirm({ isOpen: true, orderId: order.id!, order })}
                          className="bg-white md:bg-transparent border border-rose-100 md:border-none shadow-sm md:shadow-none hover:bg-rose-50 text-rose-500 hover:text-rose-600 disabled:hover:bg-transparent disabled:opacity-30 rounded-md w-7 h-7 md:w-9 md:h-9 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">Xóa đơn</div>
                      </div>
                    </div>

                    {/* Mobile: Dropdown */}
                    <div className="sm:hidden relative inline-block text-left mt-2">
                      <button 
                        onClick={() => setOpenDropdownId(openDropdownId === order.id ? null : order.id!)}
                        className="hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-md w-9 h-9 flex items-center justify-center transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openDropdownId === order.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)}></div>
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-lg shadow-xl z-50 flex flex-col py-1 overflow-hidden">
                            <button onClick={() => { setOpenDropdownId(null); setSelectedOrder(order); }} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left">
                              <Eye className="w-4 h-4 text-slate-500" /> Xem chi tiết
                            </button>
                            <button disabled={!canEdit && profile?.role !== 'admin'} onClick={() => { setOpenDropdownId(null); openEditModal(order); }} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left disabled:opacity-50 disabled:bg-transparent">
                              <FileEdit className="w-4 h-4 text-slate-500" /> Sửa đơn
                            </button>
                            {order.status !== 'paid' && order.status !== 'cancelled' && (
                               <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); navigate('/orders/payments', { state: { orderData: order } }); }} className="px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 w-full text-left">
                                 <CreditCard className="w-4 h-4 text-emerald-500" /> Thanh toán
                               </button>
                            )}
                            <button onClick={() => { 
                                setOpenDropdownId(null); 
                                setSelectedOrder(order);
                                setTimeout(() => {
                                  printElement('print-order-receipt-thermal', '80mm');
                                }, 100);
                              }} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 w-full text-left">
                              <Printer className="w-4 h-4 text-slate-500" /> In hóa đơn
                            </button>
                            <button disabled={order.status === 'paid' || (!canDelete && profile?.role !== 'admin')} onClick={() => { setOpenDropdownId(null); setDeleteConfirm({ isOpen: true, orderId: order.id!, order }); }} className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 w-full text-left disabled:opacity-50 disabled:bg-transparent">
                              <Trash2 className="w-4 h-4 text-rose-500" /> Xóa
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && (
          <div className="p-4 md:p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2 md:gap-4 text-xs font-bold text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
              <span>Hiển thị</span>
              <select 
                value={itemsPerPage} 
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>trên tổng {filteredOrders.length}</span>
            </div>

            <div className="flex items-center gap-1 md:gap-2 w-full sm:w-auto justify-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                        currentPage === pageNum 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                          : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POS Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center lg:p-8">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"></motion.div>
              <motion.div initial={{ scale: 0.98, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 30 }} className="relative flex flex-col lg:flex-row w-full h-[100dvh] lg:max-h-[90vh] max-w-[1400px] bg-slate-50 lg:rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
              
              {/* Product Selection Side */}
              <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-100/20 pb-24 lg:pb-0 relative">
                <div className="p-4 lg:px-10 lg:py-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 bg-white shadow-sm gap-2 mt-4 lg:mt-0">
                  <div className="flex items-center justify-between w-full lg:w-auto">
                    <div className="flex items-center gap-2 lg:gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-900 rounded-[14px] lg:rounded-[18px] flex items-center justify-center text-white">
                        <ShoppingCart className="w-4 h-4 lg:w-6 lg:h-6" />
                      </div>
                      <div>
                        <h2 className="text-sm lg:text-xl font-black text-slate-900 tracking-tight uppercase">Hệ thống bán lẻ</h2>
                        <p className="text-[8px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">LuxeFlow POS Terminal</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="p-2 lg:p-3 hover:bg-slate-100 rounded-xl lg:rounded-2xl transition-colors lg:hidden border-2 border-slate-100 bg-white"
                    >
                      <X className="w-5 h-5 lg:w-7 lg:h-7 text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="relative flex-1 w-full lg:max-w-md lg:mx-10 mt-2 lg:mt-0 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 lg:w-5 lg:h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Tìm tên sản phẩm..." 
                        value={posSearchSearchTerm}
                        onChange={(e) => setPosSearchSearchTerm(e.target.value)}
                        className="w-full pl-10 lg:pl-12 pr-4 py-3 lg:py-4 bg-slate-50 border-none rounded-xl lg:rounded-2xl text-[10px] lg:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300" 
                      />
                    </div>
                    {/* Nút Lọc danh mục Mobile - Hướng mũi tên chỉ trong ảnh 1 */}
                    <div className="relative lg:hidden shrink-0">
                       <button 
                          onClick={() => setOpenDropdownId(openDropdownId === 'mobile-cat' ? null : 'mobile-cat')}
                          className={cn("w-[44px] h-[44px] bg-slate-50 rounded-xl flex items-center justify-center transition-colors", openDropdownId === 'mobile-cat' || selectedCategory !== 'all' ? "bg-slate-900 text-white" : "text-slate-400")}
                       >
                          <Filter className="w-4 h-4" />
                       </button>
                       <AnimatePresence>
                          {openDropdownId === 'mobile-cat' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-2xl z-50 p-2 flex flex-col gap-1">
                               {posTab === 'products' ? categories.map(cat => (
                                 <button
                                   key={cat}
                                   onClick={() => { setSelectedCategory(cat); setOpenDropdownId(null); }}
                                   className={cn("px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors", selectedCategory === cat ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50")}
                                 >
                                    {cat === 'all' ? 'Tất cả sản phẩm' : cat}
                                 </button>
                               )) : (
                                 <button onClick={() => setOpenDropdownId(null)} className="px-4 py-3 text-left text-[10px] bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-xl">Tất cả dịch vụ</button>
                               )}
                            </motion.div>
                          )}
                       </AnimatePresence>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="hidden lg:flex p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>

                <div className="p-3 lg:px-10 lg:py-5 bg-white border-b border-slate-50 flex gap-2 lg:gap-4 overflow-x-auto scrollbar-hide shrink-0 items-center">
                  <div className="flex bg-slate-100 p-1 rounded-xl lg:rounded-2xl shrink-0">
                    <button onClick={() => setPosTab('products')} className={cn("px-4 lg:px-6 py-2 rounded-lg lg:rounded-xl text-[9px] lg:text-[10px] font-black uppercase flex items-center gap-1.5 max-w-[120px] md:max-w-[200px] whitespace-nowrap", posTab === 'products' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>
                      <Package className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sản phẩm</span><span className="sm:hidden">SP</span>
                    </button>
                    <button onClick={() => setPosTab('services')} className={cn("px-4 lg:px-6 py-2 rounded-lg lg:rounded-xl text-[9px] lg:text-[10px] font-black uppercase flex items-center gap-1.5 max-w-[120px] md:max-w-[200px] whitespace-nowrap", posTab === 'services' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>
                      <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dịch vụ</span><span className="sm:hidden">DV</span>
                    </button>
                  </div>
                  {/* Category bar desktop only */}
                  <div className="hidden lg:flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mt-1 shrink-0">
                    {posTab === 'products' ? categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                          selectedCategory === cat 
                            ? "bg-slate-900 text-white shadow-lg" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        {cat === 'all' ? 'Tất cả' : cat}
                      </button>
                    )) : (
                      <button className="px-4 md:px-6 py-2 bg-slate-900 text-white rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase whitespace-nowrap">Tất cả</button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-10 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6 custom-scrollbar">
                  {posTab === 'products' ? posFilteredProducts.map(product => (
                    <button 
                      key={product.id} 
                      onClick={() => addToCart(product, 'product')}
                      disabled={product.stock <= 0}
                      className="flex flex-col bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all text-left group active:scale-95 disabled:opacity-40"
                    >
                      <div className="w-full aspect-square bg-slate-50 rounded-[18px] mb-4 overflow-hidden relative border border-slate-50">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-slate-200" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] font-black text-slate-500 border border-slate-100">
                          {product.stock} KHO
                        </div>
                      </div>
                      <p className="font-black text-[11px] text-slate-900 truncate w-full uppercase tracking-tight mb-2 px-1">{product.name}</p>
                      <div className="flex items-center justify-between px-1">
                        <p className="text-sm font-black text-blue-600 tracking-tight">{formatCurrency(product.salePrice)}</p>
                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  )) : services.filter(s => s.name.toLowerCase().includes(posSearchSearchTerm.toLowerCase())).map(service => (
                    <button 
                      key={service.id} 
                      onClick={() => addToCart(service, 'service')}
                      className="flex flex-col bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all text-left group active:scale-95"
                    >
                      <div className="w-full aspect-video bg-slate-50 rounded-[18px] mb-4 overflow-hidden relative border border-slate-50">
                        {service.images?.[0] ? (
                          <img src={service.images[0]} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-slate-200" />
                          </div>
                        )}
                      </div>
                      <p className="font-black text-[11px] text-slate-900 truncate w-full uppercase tracking-tight mb-1 px-1">{service.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">{service.duration} Phút</p>
                      <div className="flex items-center justify-between px-1 mt-auto">
                        <p className="text-sm font-black text-blue-600 tracking-tight">{formatCurrency(service.promoPrice || service.price)}</p>
                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Mobile Floating Bar for Cart */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-safe flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-[40]">
                   <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tổng tiền ({cart.length} món)</span>
                      <span className="text-xl font-black text-slate-900 italic mt-0.5">{formatCurrency(total)}</span>
                   </div>
                   <button 
                     onClick={() => setIsMobileCartOpen(true)}
                     className="h-12 px-8 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center gap-2 active:scale-95 transition-all"
                   >
                      <ShoppingCart className="w-5 h-5"/> Mở giỏ hàng
                   </button>
                </div>
              </div>

              {/* Mobile Cart Overlay */}
              {isMobileCartOpen && (
                 <div 
                    className="fixed inset-0 bg-slate-900/60 z-[50] lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileCartOpen(false)}
                 />
              )}

              {/* Cart Side (Responsive Sheet on Mobile) */}
              <div className={cn(
                 "flex flex-col bg-white z-[60] lg:z-10 shadow-2xl lg:shadow-[0_0_40px_rgba(0,0,0,0.05)] lg:border-l border-slate-100 shrink-0",
                 "fixed lg:relative bottom-0 left-0 right-0 lg:inset-auto",
                 "w-full lg:w-[450px] xl:w-[500px]",
                 "rounded-t-[32px] lg:rounded-none",
                 "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                 isMobileCartOpen ? "translate-y-0 h-[90dvh]" : "translate-y-full lg:translate-y-0 h-[90dvh] lg:h-full"
              )}>
                <div className="lg:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />
                
                <div className="p-4 lg:px-10 lg:py-8 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 tracking-tight uppercase flex items-center gap-3 text-lg">
                      <button className="lg:hidden p-1 mr-1 text-slate-400 hover:bg-slate-100 rounded-lg" onClick={() => setIsMobileCartOpen(false)}><X className="w-6 h-6" /></button>
                      Phiếu thanh toán 
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Chi tiết giỏ lẻ</p>
                  </div>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                      Xóa tất cả
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar bg-slate-50/30">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <ShoppingCart className="w-10 h-10 opacity-20" />
                      </div>
                      <p className="font-black text-[10px] uppercase tracking-[0.3em] opacity-40">Giỏ hàng rỗng</p>
                    </div>
                  ) : cart.map(item => (
                    <motion.div 
                      layout
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={`${item.id}-${item.type}`} 
                      className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3 sm:gap-5 transition-all group"
                    >
                      <div className="flex gap-3 sm:gap-5">
                         <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-50 flex items-center justify-center">
                           {(() => {
                              const img = item.image || (item.type === 'product' ? products.find(p => p.id === item.id)?.images?.[0] : services.find(s => s.id === item.id)?.images?.[0]);
                              return img ? <img src={img} className="w-full h-full object-cover" /> : item.type === 'product' ? <Package className="w-5 h-5 sm:w-6 sm:h-6 text-slate-200" /> : <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-slate-200" />;
                           })()}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-black text-[11px] sm:text-[12px] text-slate-900 truncate uppercase tracking-tight">{item.name}</p>
                           <div className="flex flex-col gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                             <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded w-max", item.type === 'product' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500")}>{item.type === 'product' ? 'HÀNG' : 'DỊCH VỤ'}</span>
                             <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 w-full mt-1 sm:mt-1.5">
                               <input 
                                 type="text" 
                                 value={new Intl.NumberFormat('en-US').format(item.price)} 
                                 onChange={(e) => {
                                   const val = e.target.value.replace(/,/g, '');
                                   if (!isNaN(Number(val))) {
                                     updateItemPrice(item.id, item.type, Number(val));
                                   }
                                 }}
                                 className="w-16 sm:w-20 bg-transparent border-b border-slate-200 text-blue-600 text-xs font-black p-0 focus:ring-0" 
                               />
                               <input
                                 type="text"
                                 placeholder="Ghi chú..."
                                 value={item.note || ''}
                                 onChange={(e) => updateItemNote(item.id, item.type, e.target.value)}
                                 className="w-full sm:flex-1 min-w-0 text-xs bg-transparent border-b border-slate-200 text-slate-600 p-0 focus:ring-0"
                               />
                             </div>
                           </div>
                         </div>
                         <div className="hidden sm:flex flex-col items-end gap-3 justify-between">
                            <button onClick={() => removeFromCart(item.id, item.type)} className="text-rose-600 text-[10px] p-1 font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Xóa</button>
                            <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                              <button onClick={() => updateQuantity(item.id, item.type, -1)} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-900"><Minus className="w-3.5 h-3.5" /></button>
                              <span className="w-8 text-center text-[11px] font-black">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, item.type, 1)} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-900"><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                         </div>
                      </div>
                      
                      {/* Mobile quantity and remove controls below */}
                      <div className="sm:hidden flex items-center justify-between w-full pt-2 border-t border-slate-50 mt-1">
                         <button onClick={() => removeFromCart(item.id, item.type)} className="text-rose-600 text-[9px] px-2 py-1 bg-rose-50 rounded font-black uppercase transition-colors shrink-0">Xóa món</button>
                         <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                           <button onClick={() => updateQuantity(item.id, item.type, -1)} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-900"><Minus className="w-3 h-3" /></button>
                           <span className="w-6 text-center text-[10px] font-black">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.id, item.type, 1)} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-900"><Plus className="w-3 h-3" /></button>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  <div className="pt-6 border-t border-slate-200">
                    <div className="mb-4">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Khách hàng</label>
                     <div className="flex gap-2 mb-2">
                        <button onClick={() => setIsNewCustomer(false)} className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors", !isNewCustomer ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400")}>Khách cũ</button>
                        <button onClick={() => {setIsNewCustomer(true); setPosCustomerId('new'); setCustomerName(''); setCustomerPhone('');}} className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors", isNewCustomer ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-400")}>Thêm mới</button>
                     </div>
                     
                     {!isNewCustomer ? (
                        <div className="space-y-1.5 relative" ref={dropdownRef}>
                           <div className="relative">
                             <input 
                               type="text" 
                               placeholder="Tìm khách hàng (Tên, SĐT)..." 
                               value={posCustomerSearchTerm}
                               onChange={(e) => {
                                 setPosCustomerSearchTerm(e.target.value);
                                 setIsCustomerDropdownOpen(true);
                                 if (e.target.value === '') setPosCustomerId(null);
                               }}
                               onClick={() => setIsCustomerDropdownOpen(true)}
                               className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                             />
                             <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           </div>

                           {isCustomerDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden z-50 max-h-64 overflow-y-auto">
                                 {filteredCustomers.length === 0 ? (
                                    <div className="p-4 text-center text-xs font-bold text-slate-400">Không tìm thấy khách hàng.</div>
                                 ) : (
                                    <ul className="py-2">
                                       {filteredCustomers.map(c => (
                                          <li 
                                            key={c.id} 
                                            onClick={() => handleSelectCustomer(c)}
                                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center gap-3"
                                          >
                                             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black uppercase shrink-0">
                                                {c.name?.charAt(0) || 'K'}
                                             </div>
                                             <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                   <span className="font-bold text-slate-900 truncate">{c.name}</span>
                                                   <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">{c.phone}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400">
                                                   <span>{customerStats[c.id]?.orderCount || 0} đơn</span>
                                                   <span>&bull;</span>
                                                   <span>{formatCurrency(customerStats[c.id]?.totalSpend || 0)}</span>
                                                </div>
                                             </div>
                                          </li>
                                       ))}
                                    </ul>
                                 )}
                              </div>
                           )}
                        </div>
                     ) : (
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-4">
                             <div className="relative">
                               <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                               <input type="text" placeholder="Họ Tên khách" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10" />
                             </div>
                             <div className="relative">
                               <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                               <input type="tel" placeholder="0xxx..." value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10" />
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <select value={customerGender} onChange={e => setCustomerGender(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10">
                               <option value="">Giới tính</option>
                               <option value="male">Nam</option>
                               <option value="female">Nữ</option>
                             </select>
                             <input type="date" value={customerBirthDate} onChange={e => setCustomerBirthDate(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10 text-slate-500" />
                           </div>
                           <input type="text" placeholder="Địa chỉ..." value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10" />
                        </div>
                     )}
                     <div className="mt-4 pt-4 border-t border-slate-100">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Người giới thiệu (Referral)</label>
                        <div className="space-y-1.5 relative" ref={referrerDropdownRef}>
                           <div className="relative">
                             <input 
                               type="text" 
                               placeholder="Tìm khách hàng đã giới thiệu..." 
                               value={posReferrerSearchTerm}
                               onChange={(e) => {
                                 setPosReferrerSearchTerm(e.target.value);
                                 setIsReferrerDropdownOpen(true);
                                 if (e.target.value === '') setPosReferredById(null);
                               }}
                               onClick={() => setIsReferrerDropdownOpen(true)}
                               className="w-full pl-4 pr-10 py-3.5 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-indigo-300"
                             />
                             <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300" />
                           </div>

                           {isReferrerDropdownOpen && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 overflow-hidden z-50 max-h-64 overflow-y-auto">
                                 {filteredReferrers.length === 0 ? (
                                    <div className="p-4 text-center text-xs font-bold text-slate-400">Không tìm thấy.</div>
                                 ) : (
                                    <ul className="py-2">
                                       {filteredReferrers.map(c => (
                                          <li 
                                            key={c.id} 
                                            onClick={() => handleSelectReferrer(c)}
                                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center gap-3"
                                          >
                                             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black uppercase shrink-0 text-xs">
                                                {c.name?.charAt(0) || 'K'}
                                             </div>
                                             <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                   <span className="font-bold text-slate-900 text-xs truncate">{c.name}</span>
                                                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">{c.phone}</span>
                                                </div>
                                             </div>
                                          </li>
                                       ))}
                                    </ul>
                                 )}
                              </div>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                     <div className="space-y-1.5 shrink-0">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Thanh toán</label>
                       <select value={posPaymentMethod} onChange={e => setPosPaymentMethod(e.target.value as any)} className="w-full px-3 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10">
                          <option value="cash">Tiền mặt</option>
                          <option value="transfer">Chuyển khoản</option>
                       </select>
                     </div>
                     <div className="space-y-1.5 shrink-0">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</label>
                       <select value={posStatus} onChange={e => setPosStatus(e.target.value as any)} className="w-full px-3 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10">
                          <option value="pending">Chờ xử lý</option>
                          <option value="unpaid">Chưa thanh toán</option>
                          <option value="paid">Đã thanh toán</option>
                          <option value="cancelled">Đã hủy</option>
                       </select>
                     </div>
                     <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tgian tạo đơn</label>
                       <div className="flex gap-2">
                         <input 
                           type="date" 
                           value={posOrderDate} 
                           onChange={e => setPosOrderDate(e.target.value)}
                           className="w-1/2 px-3 py-[13px] bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10"
                         />
                         <input 
                           type="time" 
                           value={posOrderTime} 
                           onChange={e => setPosOrderTime(e.target.value)}
                           className="w-1/2 px-3 py-[13px] bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/10"
                         />
                       </div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-4 md:p-6 border-t border-slate-100 bg-white mt-auto z-10">
                  <div className="space-y-4 mb-2 bg-slate-50/50 p-4 md:p-6 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between text-slate-400 font-black uppercase tracking-widest text-[9px]">
                      <span>Tạm tính</span>
                      <span className="text-slate-700">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <span className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Chiết khấu</span>
                      <div className="flex items-center gap-2 w-full sm:max-w-[220px]">
                        <input 
                          type="text" 
                          value={discount === 0 ? '' : new Intl.NumberFormat('en-US').format(discount)} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(val))) {
                              setDiscount(Number(val));
                            }
                          }} 
                          className="flex-1 min-w-0 text-right bg-white border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-xs font-black text-rose-500 px-3 py-2.5 transition-all placeholder:text-rose-200 placeholder:font-medium"
                          placeholder="0"
                        />
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'vnd' | 'percent')}
                          className="w-20 shrink-0 text-xs font-bold text-rose-500 bg-rose-50 border-none rounded-xl py-2.5 px-3 pr-8 focus:ring-0"
                        >
                          <option value="vnd">VNĐ</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>
                    {/* Removed Phí vận chuyển */}
                    <div className="h-px bg-slate-100 my-2"></div>
                    <div className="flex items-center justify-between text-2xl font-black text-slate-900 tracking-tighter">
                      <span>TỔNG</span>
                      <span className="text-blue-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-6">
                    <button 
                      disabled={cart.length === 0 || loading}
                      onClick={handleCheckout}
                      className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingOrderId ? <ClipboardList className="w-5 h-5" /> : <Printer className="w-5 h-5" />)}
                      {editingOrderId ? 'Lưu cập nhật' : 'In & Thanh toán'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>, 
      document.body)}

      {/* Order Details Modal (3-column layout) */}
      {createPortal(
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedOrder(null)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[98vw] max-w-7xl h-[95vh] bg-slate-50 rounded-[32px] shadow-2xl z-50 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 md:p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-[18px] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                       <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">Chi tiết hóa đơn</h2>
                       <span className={cn(
                         "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                         selectedOrder.status === 'paid' ? "bg-emerald-50 text-emerald-600" :
                         selectedOrder.status === 'pending' ? "bg-amber-50 text-orange-600" :
                         selectedOrder.status === 'unpaid' ? "bg-orange-50 text-orange-600" :
                         selectedOrder.status === 'deposit' ? "bg-blue-50 text-blue-600" :
                         "bg-rose-50 text-rose-600"
                       )}>
                         <div className={cn("w-1.5 h-1.5 rounded-full",
                           selectedOrder.status === 'paid' ? "bg-emerald-500" :
                           selectedOrder.status === 'pending' ? "bg-amber-500" :
                           selectedOrder.status === 'unpaid' ? "bg-orange-500" :
                           selectedOrder.status === 'deposit' ? "bg-blue-500" : "bg-rose-500"
                         )}></div>
                         {getStatusText(selectedOrder.status)}
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">#TX-{selectedOrder.id?.toUpperCase()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                  {canEdit && (
                    <button onClick={() => openEditModal(selectedOrder)} className="px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <FileEdit className="w-4 h-4" /> Sửa
                    </button>
                  )}
                  
                  {/* Export Options */}
                  <div className="relative">
                    <button onClick={() => setOpenDropdownId(openDropdownId === 'export-modal' ? null : 'export-modal')} className="px-4 py-2.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <Download className="w-4 h-4" /> Xuất file
                    </button>
                    <AnimatePresence>
                      {openDropdownId === 'export-modal' && (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-1">
                            <button onClick={async () => {
                               setOpenDropdownId(null);
                               exportPdf('print-order-receipt', `HoaDon_${selectedOrder.id}.pdf`);
                            }} className="px-4 py-3 w-full text-left hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2"><FileText className="w-4 h-4"/> Xuất PDF</button>
                            <button onClick={() => {
                               setOpenDropdownId(null);
                               exportExcelBulk([selectedOrder]);
                            }} className="px-4 py-3 w-full text-left hover:bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Xuất Excel</button>
                            <button onClick={() => {
                               setOpenDropdownId(null);
                               exportWord('print-order-receipt', `HoaDon_${selectedOrder.id}.docx`);
                            }} className="px-4 py-3 w-full text-left hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-xl flex items-center gap-2"><FileText className="w-4 h-4"/> Xuất Word</button>
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Print Options */}
                  <div className="relative">
                    <button onClick={() => setOpenDropdownId(openDropdownId === 'print-modal' ? null : 'print-modal')} className="px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <Printer className="w-4 h-4" /> In ấn
                    </button>
                    <AnimatePresence>
                      {openDropdownId === 'print-modal' && (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-1">
                            <button onClick={() => { setOpenDropdownId(null); printElement('print-order-receipt-thermal', '80mm'); }} className="px-4 py-3 w-full text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl">In nhiệt (80mm)</button>
                            <button onClick={() => { setOpenDropdownId(null); printElement('print-order-receipt', 'A4'); }} className="px-4 py-3 w-full text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl">In A4</button>
                            <button onClick={() => { setOpenDropdownId(null); printElement('print-order-receipt', 'A5'); }} className="px-4 py-3 w-full text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl">In A5</button>
                            <button onClick={() => { setOpenDropdownId(null); setPrintCustomSizeModalOpen(true); }} className="px-4 py-3 w-full text-left hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl">In tùy chỉnh</button>
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {canDelete && (
                    <button onClick={() => handleDeleteOrder(selectedOrder.id!)} className="px-4 py-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      <Trash2 className="w-4 h-4" /> Xóa
                    </button>
                  )}
                  <button onClick={() => setSelectedOrder(null)} className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors ml-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body 3 Columns */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50/50 p-4 md:p-6 gap-6">
                
                {/* Column 1: Info & Status */}
                <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide shrink-0">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative space-y-4">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <User className="w-3.5 h-3.5" /> Thông tin khách hàng
                       </h3>
                       {canEdit && (
                          <button onClick={() => {
                             if (isEditingCustomer) handleUpdateCustomer();
                             else {
                               setEditCustomerName(selectedOrder.customerName || '');
                               setEditCustomerPhone(selectedOrder.customerPhone || '');
                               setIsEditingCustomer(true);
                             }
                          }} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">
                             {isEditingCustomer ? 'Lưu lại' : 'Chỉnh sửa'}
                          </button>
                       )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Tên khách hàng</p>
                         {isEditingCustomer ? (
                            <input type="text" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500" />
                         ) : (
                            <p className="font-black text-slate-900 text-sm tracking-tight">{selectedOrder.customerName || 'KHÁCH VÃNG LAI'}</p>
                         )}
                      </div>
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Số điện thoại</p>
                         {isEditingCustomer ? (
                            <input type="text" value={editCustomerPhone} onChange={e => setEditCustomerPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500" />
                         ) : (
                            <p className="font-bold text-slate-700 text-sm tracking-tight">{selectedOrder.customerPhone || 'Không có'}</p>
                         )}
                      </div>
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Thời gian tạo</p>
                         <p className="font-bold text-slate-700 text-sm tracking-tight">{selectedOrder.createdAt ? formatDate(selectedOrder.createdAt) : 'Không xác định'}</p>
                      </div>
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Phương thức thanh toán</p>
                         <p className="font-bold text-slate-700 text-sm tracking-tight">{selectedOrder.paymentMethod === 'cash' ? 'Tiền mặt' : selectedOrder.paymentMethod === 'transfer' ? 'Chuyển khoản' : selectedOrder.paymentMethod === 'momo' ? 'Ví MoMo' : selectedOrder.paymentMethod === 'card' ? 'Quẹt thẻ' : 'Chưa thanh toán'}</p>
                      </div>
                    </div>
                  </div>

                {/* Status Update */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Tiến độ đơn hàng
                  </h3>
                  <div className="flex flex-col gap-2">
                    {['pending', 'unpaid', 'deposit', 'paid', 'cancelled'].map(s => (
                      <button
                        key={s}
                        disabled={!canEdit || selectedOrder.status === 'paid' || selectedOrder.status === 'cancelled'}
                        onClick={() => {
                           if (s === 'paid') {
                              navigate('/orders/payments', { state: { orderData: selectedOrder } });
                           } else {
                              updateOrderStatus(selectedOrder.id!, s);
                           }
                        }}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-left flex items-center justify-between",
                          selectedOrder.status === s 
                            ? (s === 'paid' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : 
                               s === 'cancelled' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" :
                               s === 'deposit' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" :
                               s === 'unpaid' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" :
                               "bg-amber-500 text-white shadow-lg shadow-amber-500/20")
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100"
                        )}
                      >
                        <span>{getStatusText(s)}</span>
                        {selectedOrder.status === s && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 2: Items & Financials */}
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide">
                {/* Items List */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4 shrink-0">
                    <Package className="w-3.5 h-3.5" /> Danh sách sản phẩm ({selectedOrder.items.length})
                  </h3>
                  <div className="space-y-3 overflow-y-auto pr-2 scrollbar-hide flex-1">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 md:gap-4 hover:border-blue-200 transition-colors">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                          {(() => {
                             const img = item.image || (item.type === 'product' ? products.find(p => p.id === item.id)?.images?.[0] : services.find(s => s.id === item.id)?.images?.[0]);
                             return img ? <img src={img} className="w-full h-full object-cover" /> : item.type === 'product' ? <Package className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-black text-xs text-slate-900 uppercase tracking-tight truncate" title={item.name}>{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded uppercase", item.type === 'product' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500")}>
                               {item.type === 'product' ? 'Sản phẩm' : 'Dịch vụ'}
                             </span>
                             <p className="text-[10px] text-slate-500 font-bold">{formatCurrency(item.price)} <span className="text-slate-300">x</span> {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm text-blue-600">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Summary Inside Column 2 */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 shrink-0">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                      <span>Tiền hàng</span>
                      <span className="text-slate-900">{formatCurrency(selectedOrder.totalAmount + (selectedOrder.discount || 0) - (selectedOrder.shippingFee || 0))}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex items-center justify-between text-rose-500 font-bold uppercase tracking-widest text-[10px]">
                        <span>Giảm giá</span>
                        <span>- {formatCurrency(selectedOrder.discount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Tổng thanh toán</span>
                      <span className="text-2xl font-black text-blue-600">{formatCurrency(selectedOrder.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Invoice Preview */}
              <div className="hidden lg:flex w-[400px] flex-col overflow-hidden bg-white border-l border-slate-100 p-6 shrink-0 relative">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5" /> Preview Hóa Đơn
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-50 rounded-lg">80mm</div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto scrollbar-hide border border-slate-200 bg-slate-50 rounded-2xl p-4 shadow-inner relative flex justify-center items-start">
                    {/* Render the actual PrintOrderReceipt component inline for preview */}
                    <div className="bg-white shadow-md print-preview-wrapper w-full max-w-[300px]">
                       <PrintOrderReceipt 
                         order={{
                           ...selectedOrder,
                           subtotal: selectedOrder.items?.reduce((acc, cur) => acc + (cur.price * cur.quantity), 0) || selectedOrder.totalAmount,
                           total: selectedOrder.totalAmount
                         } as any} 
                         paperSize="80mm" 
                         id="preview-receipt-inline"
                         hidden={false}
                       />
                    </div>
                 </div>
                 
                 {/* Only keep Payment Actions below preview if not paid/cancelled */}
                 {selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                       <button onClick={handleConfirmPayment} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
                          Xác nhận & Hoàn tất
                       </button>
                    </div>
                 )}
              </div>
            </div>
            
            {/* Keeping the hidden PrintOrderReceipt for actual printing */}
            <div className="hidden">
              <PrintOrderReceipt 
                order={{
                  ...selectedOrder,
                  subtotal: selectedOrder.items?.reduce((acc, cur) => acc + (cur.price * cur.quantity), 0) || selectedOrder.totalAmount,
                  total: selectedOrder.totalAmount
                } as any} 
                paperSize="A4" 
                id="print-order-receipt"
              />
              <PrintOrderReceipt 
                order={{
                  ...selectedOrder,
                  subtotal: selectedOrder.items?.reduce((acc, cur) => acc + (cur.price * cur.quantity), 0) || selectedOrder.totalAmount,
                  total: selectedOrder.totalAmount
                } as any} 
                paperSize="80mm" 
                id="print-order-receipt-thermal"
              />
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Custom Size Dialog */}
      {createPortal(
      <AnimatePresence>
        {printCustomSizeModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPrintCustomSizeModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl p-6 md:p-8 shadow-2xl w-full max-w-sm">
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Tùy chỉnh Kích thước In</h3>
                <p className="text-xs font-bold text-slate-500 mb-6">Nhập chiều rộng và chiều cao tính bằng mm. Ví dụ A4 là 210 x 297.</p>
                <div className="flex gap-4 mb-8">
                   <div className="flex-1 space-y-2">
                       <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Chiều Rộng (mm)</label>
                       <input type="number" value={printWidth} onChange={e => setPrintWidth(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 font-bold focus:ring-2 focus:ring-blue-600/20" />
                   </div>
                   <div className="flex-1 space-y-2">
                       <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Chiều Cao (mm)</label>
                       <input type="number" value={printHeight} onChange={e => setPrintHeight(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 font-bold focus:ring-2 focus:ring-blue-600/20" />
                   </div>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setPrintCustomSizeModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Hủy</button>
                   <button onClick={() => {
                        setPrintCustomSizeModalOpen(false);
                        if (printWidth && printHeight) {
                           printElement('print-order-receipt', `${printWidth}mm ${printHeight}mm`);
                        }
                   }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest">In ngay</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body)}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa hóa đơn"
        message={deleteConfirm.order?.status === 'paid' 
          ? 'Hóa đơn này đã thanh toán. Chấp nhận xóa sẽ trừ doanh thu, hoàn tồn kho, và cập nhật lại điểm khách hàng.'
          : 'Bạn có chắc chắn muốn xóa hóa đơn chưa thanh toán này?'}
        onConfirm={executeDeleteOrder}
        onCancel={() => setDeleteConfirm({ isOpen: false, orderId: '', order: null })}
      />

      {/* Hidden Bulk Print Areas */}
      <div id="bulk-print-receipts-thermal" className="hidden">
        {selectedIds.map((id, idx) => {
           const o = orders.find(x => x.id === id);
           if (!o) return null;
           return (
             <div key={id} style={{ pageBreakAfter: idx < selectedIds.length - 1 ? 'always' : 'auto' }}>
                <PrintOrderReceipt 
                  hidden={false}
                  order={{
                    ...o,
                    subtotal: o.items?.reduce((acc: any, cur: any) => acc + (cur.price * cur.quantity), 0) || o.totalAmount,
                    total: o.totalAmount
                  } as any} 
                  paperSize="80mm" 
                  id={`bulk-thermal-${id}`}
                />
             </div>
           )
        })}
      </div>

      <div id="bulk-print-receipts-a4" className="hidden">
        {selectedIds.map((id, idx) => {
           const o = orders.find(x => x.id === id);
           if (!o) return null;
           return (
             <div key={id} style={{ pageBreakAfter: idx < selectedIds.length - 1 ? 'always' : 'auto' }}>
                <PrintOrderReceipt 
                  hidden={false}
                  order={{
                    ...o,
                    subtotal: o.items?.reduce((acc: any, cur: any) => acc + (cur.price * cur.quantity), 0) || o.totalAmount,
                    total: o.totalAmount
                  } as any} 
                  paperSize="A4" 
                  id={`bulk-a4-${id}`}
                />
             </div>
           )
        })}
      </div>
    </div>
  );
}
