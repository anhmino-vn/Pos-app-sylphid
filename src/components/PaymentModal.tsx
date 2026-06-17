import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, writeBatch } from '../lib/firebaseAdapter';
import { db } from '../lib/supabase';
import { formatCurrency, cn, generateDocCode } from '../lib/utils';
import { useAuth } from '../App';
import {
  Banknote,
  Landmark,
  CreditCard,
  Wallet,
  Layers,
  CheckCircle2,
  Copy,
  ChevronRight,
  Delete,
  X,
  Box, Search, Loader2
} from 'lucide-react';

export function PaymentModal({ orderData: initialOrderData, debtData: initialDebtData, onClose, onSuccess }: { orderData?: any, debtData?: any, onClose: () => void, onSuccess?: () => void }) {
  
  
  const { user, profile } = useAuth();
  const [orderData, setOrderData] = useState<any>(initialOrderData || null);
  const [debtData, setDebtData] = useState<any>(initialDebtData || null);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card' | 'wallet' | 'combined'>('cash');
  const [amountGivenStr, setAmountGivenStr] = useState<string>('');
  const [orderNote, setOrderNote] = useState(orderData?.note || '');
  const [orderStatus, setOrderStatus] = useState('Chờ thanh toán');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<any>(() => {
    try {
      const local = localStorage.getItem('mock_payment_configs');
      if (local) {
        const parsed = JSON.parse(local);
        return parsed.find((p: any) => p.is_default) || parsed[0] || null;
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    const fetchPaymentConfig = async () => {
       try {
           const { data, error } = await supabase.from('payment_configs').select('*');
           
           let finalConfigs = [];
           if (error) {
               const local = localStorage.getItem('mock_payment_configs');
               if (local) finalConfigs = JSON.parse(local);
           } else {
               finalConfigs = data || [];
           }
           
           if (finalConfigs.length === 0) {
               const local = localStorage.getItem('mock_payment_configs');
               if (local) finalConfigs = JSON.parse(local);
           }

           if (finalConfigs.length > 0) {
              const def = finalConfigs.find((p: any) => p.is_default) || finalConfigs[0];
              setPaymentConfig(def);
           }
       } catch (err) {
           console.error('Lỗi khi tải cấu hình thanh toán:', err);
       }
    };
    fetchPaymentConfig();
  }, []);

  const isDebtMode = !!debtData;
  const isSingleDebt = isDebtMode && debtData.orderIds?.length === 1;
  const singleDebtOrderId = isSingleDebt ? debtData.orderIds[0] : '';
  const displayOrderId = isDebtMode 
    ? (isSingleDebt ? `ĐƠN #TX-${singleDebtOrderId.slice(-6).toUpperCase()}` : 'THU NỢ KHÁCH HÀNG')
    : `ĐƠN #TX-${orderData?.id?.slice(-6).toUpperCase() || 'PENDING'}`;

  const totalAmount = isDebtMode ? debtData.totalAmount : (orderData?.totalAmount || 0);
  const parsedAmount = parseInt(amountGivenStr.replace(/\D/g, ''), 10);
  const amountGiven = isNaN(parsedAmount) || amountGivenStr === '' ? totalAmount : parsedAmount;
  const changeGiven = amountGiven > totalAmount ? amountGiven - totalAmount : 0;

  const handleCompletePayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (paymentMethod === 'cash' && amountGiven < totalAmount) {
        toast.error('Số tiền khách đưa chưa đủ!');
        setIsProcessing(false);
        return;
      }

      if (isDebtMode) {
        const code = generateDocCode('PT');
        const paymentRef = doc(collection(db, 'debt_payments'));
        const batch = writeBatch(db);

        const paymentData = {
          code,
          customerId: debtData.customerId,
          customerName: debtData.customerName,
          amount: totalAmount,
          paymentMethod,
          notes: orderNote,
          orderIds: debtData.orderIds,
          createdBy: user?.id || '',
          creatorName: profile?.name || user?.email || '',
          createdAt: new Date()
        };

        batch.set(paymentRef, paymentData);

        debtData.orderIds.forEach((id: string) => {
          batch.update(doc(db, 'orders', id), {
            status: 'paid',
            paymentMethod,
            updatedAt: new Date()
          });
        });

        batch.set(doc(collection(db, 'activity_logs')), {
          userId: user?.id,
          userEmail: user?.email,
          userName: profile?.name,
          action: 'Thanh toán công nợ',
          details: `Tạo phiếu thu ${code} số tiền ${formatCurrency(totalAmount)}đ cho KH ${debtData.customerName}`,
          module: 'finances',
          createdAt: new Date()
        });

        await batch.commit();
        toast.success('Thanh toán công nợ thành công!');
        if (onSuccess) onSuccess(); else onClose();
        return;
      }
      const finalData = {
        ...orderData,
        paymentMethod,
        amountGiven: paymentMethod === 'cash' ? amountGiven : totalAmount,
        changeGiven: paymentMethod === 'cash' ? changeGiven : 0,
        status: 'paid',
        note: orderNote,
        completedAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), finalData);

      // Handle Loyalty Points
      if (orderData.customerId) {
         try {
            const cRef = doc(db, 'customers', orderData.customerId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
               const customer = cSnap.data();
               let currentPoints = customer.points || 0;
               let usedPointsTotal = customer.usedPoints || 0;
               let lifetimePoints = customer.totalPoints || 0;

               // Deduct points used
               if (orderData.pointsUsed > 0) {
                  currentPoints -= orderData.pointsUsed;
                  usedPointsTotal += orderData.pointsUsed;
                  await addDoc(collection(db, 'loyalty_logs'), {
                     customerId: orderData.customerId,
                     type: 'redeem',
                     points: orderData.pointsUsed,
                     reason: 'Sử dụng điểm thanh toán đơn hàng',
                     orderId: orderRef.id,
                     createdAt: serverTimestamp()
                  });
               }

               // Award points
               const settingsSnap = await getDoc(doc(db, 'loyalty_settings', 'default'));
               if (settingsSnap.exists()) {
                  const settings = settingsSnap.data();
                  if (settings.enabled && settings.pointsEarnAmount > 0) {
                     const tier = customer.tier || 'Member';
                     const tierConfig = (settings.tiers || []).find((t: any) => t.id === tier);
                     const multiplier = tierConfig ? (tierConfig.pointMultiplier || 1) : 1;
                     
                     let rawPoints = (totalAmount / settings.pointsEarnAmount) * settings.pointsEarnValue * multiplier;
                     let pointsEarned = 0;
                     if (settings.roundingRule === 'down') pointsEarned = Math.floor(rawPoints);
                     else if (settings.roundingRule === 'up') pointsEarned = Math.ceil(rawPoints);
                     else pointsEarned = Math.round(rawPoints);

                     if (pointsEarned > 0) {
                        currentPoints += pointsEarned;
                        lifetimePoints += pointsEarned;
                        await addDoc(collection(db, 'loyalty_logs'), {
                           customerId: orderData.customerId,
                           type: 'earn',
                           points: pointsEarned,
                           reason: 'Tích điểm đơn hàng',
                           orderId: orderRef.id,
                           createdAt: serverTimestamp()
                        });
                     }
                  }

                  // Handle Referral Points (Basic Implementation)
                  if (settings.referralEnabled && orderData.referredById) {
                     // Check if this is the first order for this customer
                     // In a real scenario we'd query past orders, but since we are updating orderCount later or now:
                     const isFirstOrder = (customer.orderCount || 0) === 0;
                     if (isFirstOrder) {
                        // Reward referrer
                        if (settings.referrerReward > 0) {
                           const refDocRef = doc(db, 'customers', orderData.referredById);
                           const refSnap = await getDoc(refDocRef);
                           if (refSnap.exists()) {
                              const refData = refSnap.data();
                              await updateDoc(refDocRef, {
                                 points: (refData.points || 0) + settings.referrerReward,
                                 totalPoints: (refData.totalPoints || 0) + settings.referrerReward,
                                 referralCount: (refData.referralCount || 0) + 1
                              });
                              await addDoc(collection(db, 'loyalty_logs'), {
                                 customerId: orderData.referredById,
                                 type: 'referral',
                                 points: settings.referrerReward,
                                 reason: `Thưởng giới thiệu khách hàng: ${customer.name}`,
                                 orderId: orderRef.id,
                                 createdAt: serverTimestamp()
                              });
                           }
                        }

                        // Reward referee
                        if (settings.refereeReward > 0) {
                           currentPoints += settings.refereeReward;
                           lifetimePoints += settings.refereeReward;
                           await addDoc(collection(db, 'loyalty_logs'), {
                              customerId: orderData.customerId,
                              type: 'referral',
                              points: settings.refereeReward,
                              reason: 'Thưởng khách hàng được giới thiệu',
                              orderId: orderRef.id,
                              createdAt: serverTimestamp()
                           });
                        }
                     }
                  }
               }

               await updateDoc(cRef, {
                  points: currentPoints,
                  usedPoints: usedPointsTotal,
                  totalPoints: lifetimePoints
               });
            }
         } catch (e) {
            console.error('Lỗi xử lý điểm thành viên:', e);
         }
      }

      toast.success('Thanh toán thành công!');
      if (onSuccess) onSuccess(); else onClose(); // Navigate to invoice list or somewhere else
    } catch (err: any) {
      toast.error('Lỗi thanh toán: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!orderData && !debtData) {
      import('../lib/firebaseAdapter').then(({ onSnapshot, query, orderBy, collection }) => {
         const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
         const unsub = onSnapshot(q, (snap) => {
             const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             const pending = all.filter((o: any) => o.status === 'pending' || o.status === 'Chờ thanh toán');
             setPendingOrders(pending);
             setLoadingOrders(false);
         });
         return unsub;
      });
    }
  }, [orderData, debtData]);

  useEffect(() => {
    if (!orderData && !debtData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleCompletePayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompletePayment, orderData, debtData]);

  if (!orderData && !debtData) return null;

  const handleNumpadClick = (val: string) => {
    if (val === 'CLEAR') {
      setAmountGivenStr('');
    } else if (val === 'BACKSPACE') {
      setAmountGivenStr(prev => prev.slice(0, -1));
    } else if (val === '+10K') {
      setAmountGivenStr((amountGiven + 10000).toString());
    } else if (val === '+50K') {
      setAmountGivenStr((amountGiven + 50000).toString());
    } else if (val === 'EXACT') {
      setAmountGivenStr(totalAmount.toString());
    } else {
      setAmountGivenStr(prev => {
        const newVal = prev + val;
        return newVal.replace(/^0+/, '') || '0';
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã copy');
  };

  // VietQR generation
  const BANK_BINS: Record<string, string> = {
    'Vietcombank': '970436', 'Techcombank': '970407', 'MB Bank': '970422',
    'VIB': '970441', 'ACB': '970416', 'BIDV': '970418',
    'VietinBank': '970415', 'Sacombank': '970403', 'VPBank': '970432', 'TPBank': '970423'
  };
  const BANK_NAME = paymentConfig?.bank_name || 'MB Bank';
  const BANK_ID = paymentConfig?.bank_name ? (BANK_BINS[paymentConfig.bank_name] || '970422') : '970422';
  const ACCOUNT_NO = paymentConfig?.account_number || '123456789999';
  const ACCOUNT_NAME = paymentConfig?.account_name || 'CONG TY TNHH SYLPHID HEALTH & WELLNESS';
  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };
  const qrContent = isDebtMode 
    ? (isSingleDebt 
        ? `TX-${singleDebtOrderId.slice(-6).toUpperCase()} ${removeAccents(debtData.customerName || '')}`.trim()
        : `${removeAccents(debtData.customerName || '')} Thanh toan`.trim())
    : `TX-${orderData?.id?.slice(-6).toUpperCase() || 'DH'} ${removeAccents(orderData?.customerName || 'Khach le')}`.trim();
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(qrContent)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const quickAmounts = [
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
    Math.ceil(totalAmount / 500000) * 500000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= totalAmount).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#F1F5F9] rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 shrink-0">
        <div className="flex justify-between items-center w-full">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán đơn hàng</h1>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X size={20}/></button>
        </div>
        <div className="flex items-center text-xs text-slate-500 mt-1 font-semibold">
          <span>POS Bán hàng</span>
          <ChevronRight size={14} className="mx-1" />
          <span>Tạo đơn hàng</span>
          <ChevronRight size={14} className="mx-1" />
          <span className="text-blue-600">Thanh toán</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Mã đơn hàng</div>
            <div className="font-black text-blue-600 uppercase tracking-wider">{displayOrderId}</div>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
            <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden">
               <img src={`https://ui-avatars.com/api/?name=${isDebtMode ? debtData.customerName : (orderData?.customerName || 'Khách')}&background=e2e8f0&color=475569&bold=true`} alt="Customer" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Khách hàng</div>
              <div className="font-bold text-slate-800 text-sm">{isDebtMode ? debtData.customerName : (orderData?.customerName || 'Khách lẻ')}</div>
              <div className="text-xs text-slate-500">{isDebtMode ? debtData.customerPhone : orderData?.customerPhone}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6 hidden md:flex">
            <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden">
               <img src={`https://ui-avatars.com/api/?name=${isDebtMode ? (profile?.name || 'Staff') : (orderData?.creatorName || 'Staff')}&background=e2e8f0&color=475569&bold=true`} alt="Staff" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Nhân viên phụ trách</div>
              <div className="font-bold text-slate-800 text-sm">{isDebtMode ? (profile?.name || user?.email) : (orderData?.creatorName || 'Nguyễn An')}</div>
            </div>
          </div>
          <div className="border-l border-slate-200 pl-6 hidden lg:block">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Ngày tạo</div>
            <div className="font-bold text-slate-800 text-sm">{new Date().toLocaleString('vi-VN')}</div>
          </div>
          <div className="border-l border-slate-200 pl-6">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Trạng thái</div>
            <div className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black uppercase rounded-md">
              Chờ thanh toán
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Col 1: Payment Methods */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-bold text-slate-800 text-base mb-4">1. Chọn phương thức thanh toán</h2>
          
          <button 
            onClick={() => setPaymentMethod('cash')}
            className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between", paymentMethod === 'cash' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200")}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", paymentMethod === 'cash' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                <Banknote size={24} />
              </div>
              <div>
                <div className={cn("font-bold", paymentMethod === 'cash' ? "text-emerald-800" : "text-slate-700")}>Tiền mặt</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Thanh toán bằng tiền mặt</div>
              </div>
            </div>
            {paymentMethod === 'cash' && <CheckCircle2 className="text-emerald-500" size={20} />}
          </button>

          <button 
            onClick={() => setPaymentMethod('transfer')}
            className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between", paymentMethod === 'transfer' ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200")}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", paymentMethod === 'transfer' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500")}>
                <Landmark size={24} />
              </div>
              <div>
                <div className={cn("font-bold", paymentMethod === 'transfer' ? "text-blue-800" : "text-slate-700")}>Chuyển khoản</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Quét mã QR hoặc chuyển khoản</div>
              </div>
            </div>
            {paymentMethod === 'transfer' && <CheckCircle2 className="text-blue-500" size={20} />}
          </button>

          <button 
            onClick={() => setPaymentMethod('card')}
            className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between", paymentMethod === 'card' ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200")}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", paymentMethod === 'card' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500")}>
                <CreditCard size={24} />
              </div>
              <div>
                <div className={cn("font-bold", paymentMethod === 'card' ? "text-indigo-800" : "text-slate-700")}>Thẻ ngân hàng</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Thanh toán bằng thẻ ATM/Visa</div>
              </div>
            </div>
            {paymentMethod === 'card' && <CheckCircle2 className="text-indigo-500" size={20} />}
          </button>

          <button 
            onClick={() => setPaymentMethod('wallet')}
            className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between", paymentMethod === 'wallet' ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white hover:border-purple-200")}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", paymentMethod === 'wallet' ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-500")}>
                <Wallet size={24} />
              </div>
              <div>
                <div className={cn("font-bold", paymentMethod === 'wallet' ? "text-purple-800" : "text-slate-700")}>Ví điện tử</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">MoMo, ZaloPay, VNPay...</div>
              </div>
            </div>
            {paymentMethod === 'wallet' && <CheckCircle2 className="text-purple-500" size={20} />}
          </button>

          <button 
            onClick={() => setPaymentMethod('combined')}
            className={cn("w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between", paymentMethod === 'combined' ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white hover:border-orange-200")}
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-lg", paymentMethod === 'combined' ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500")}>
                <Layers size={24} />
              </div>
              <div>
                <div className={cn("font-bold", paymentMethod === 'combined' ? "text-orange-800" : "text-slate-700")}>Kết hợp phương thức</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Thanh toán bằng nhiều hình thức</div>
              </div>
            </div>
            {paymentMethod === 'combined' && <CheckCircle2 className="text-orange-500" size={20} />}
          </button>
        </div>

        {/* Col 2: Dynamic Payment Details */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <h2 className="font-bold text-slate-800 text-base mb-0">
            2. {paymentMethod === 'cash' ? 'Thanh toán tiền mặt' : paymentMethod === 'transfer' ? 'Chuyển khoản ngân hàng' : 'Chi tiết thanh toán'}
          </h2>

          <AnimatePresence mode="wait">
            {paymentMethod === 'cash' && (
              <motion.div 
                key="cash"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col"
              >
                <div className="space-y-3 mb-6">
                  {!isDebtMode && (
                    <>
                      <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                        <span>Tổng tiền hàng</span>
                        <span>{formatCurrency(orderData?.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                        <span>Giảm giá</span>
                        <span>{formatCurrency(orderData?.discount || 0)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="font-bold text-slate-800">Tổng thanh toán</span>
                    <span className="font-black text-blue-600 text-xl">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-slate-700 whitespace-nowrap mt-4">Khách đưa</span>
                    <div className="relative flex-1">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={amountGivenStr ? new Intl.NumberFormat('vi-VN').format(parseInt(amountGivenStr, 10)) : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAmountGivenStr(val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Delete') {
                              e.preventDefault();
                              setAmountGivenStr('');
                            }
                          }}
                          className={cn(
                            "w-full text-right border-2 rounded-xl py-3 pr-10 pl-4 text-lg font-black outline-none transition-colors",
                            amountGivenStr !== '' && amountGiven < totalAmount 
                              ? "border-rose-300 focus:border-rose-500 text-rose-600 bg-rose-50/50" 
                              : "border-slate-200 focus:border-blue-500 text-slate-800"
                          )}
                          placeholder={new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₫</span>
                        {amountGivenStr !== '' && (
                          <button onClick={() => setAmountGivenStr('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      {amountGivenStr !== '' && amountGiven < totalAmount && (
                        <p className="text-[11px] font-bold text-rose-500 mt-1.5 text-right">
                          Số tiền bạn nhập thấp hơn số tiền cần thanh toán
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    {quickAmounts.map((amt, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setAmountGivenStr(amt.toString())}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors border border-slate-200"
                      >
                        {formatCurrency(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6 py-4 px-5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-800">Tiền thừa trả khách</span>
                  <span className="font-black text-emerald-600 text-xl">{formatCurrency(changeGiven)}</span>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-4 gap-2 mt-auto">
                  {['1', '2', '3'].map(n => (
                    <button key={n} onClick={() => handleNumpadClick(n)} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xl text-slate-700 transition-colors">{n}</button>
                  ))}
                  <button onClick={() => handleNumpadClick('BACKSPACE')} className="py-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl font-bold text-xl text-slate-500 transition-colors flex justify-center items-center"><Delete size={24} /></button>
                  
                  {['4', '5', '6'].map(n => (
                    <button key={n} onClick={() => handleNumpadClick(n)} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xl text-slate-700 transition-colors">{n}</button>
                  ))}
                  <button onClick={() => handleNumpadClick('+10K')} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 transition-colors">+10.000</button>

                  {['7', '8', '9'].map(n => (
                    <button key={n} onClick={() => handleNumpadClick(n)} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xl text-slate-700 transition-colors">{n}</button>
                  ))}
                  <button onClick={() => handleNumpadClick('+50K')} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 transition-colors">+50.000</button>

                  <button onClick={() => handleNumpadClick('000')} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-lg text-slate-700 transition-colors">000</button>
                  <button onClick={() => handleNumpadClick('0')} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xl text-slate-700 transition-colors">0</button>
                  <button onClick={() => handleNumpadClick('EXACT')} className="py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xl text-slate-700 transition-colors">.</button>
                  <button onClick={() => handleCompletePayment()} className="py-4 bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-xl font-bold text-lg text-white transition-colors shadow-md shadow-blue-500/20">Nhập</button>
                </div>
              </motion.div>
            )}

            {paymentMethod === 'transfer' && (
              <motion.div 
                key="transfer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col"
              >
                <p className="text-sm font-semibold text-slate-500 mb-6">Quét mã QR hoặc chuyển khoản theo thông tin bên dưới</p>

                <div className="flex flex-col xl:flex-row gap-5 items-center xl:items-start justify-center">
                  {/* QR Code */}
                  <div className="p-4 bg-white border-2 border-blue-100 rounded-2xl shadow-sm flex flex-col items-center">
                     <p className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wider text-center px-2 line-clamp-1">{ACCOUNT_NAME}</p>
                     <p className="font-black text-blue-600 text-xl mb-3">{formatCurrency(totalAmount)}</p>
                     <div className="w-40 h-40 bg-slate-100 rounded-xl overflow-hidden mb-2">
                       <img src={qrUrl} alt="VietQR" className="w-full h-full object-cover" />
                     </div>
                     <div className="flex gap-2">
                       <img src="https://img.vietqr.io/image/vietqr.png" alt="VietQR" className="h-4" />
                       <img src="https://img.vietqr.io/image/napas247.png" alt="Napas" className="h-4" />
                     </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-4 w-full">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Ngân hàng</div>
                      <div className="font-bold text-slate-800 text-sm">{BANK_NAME}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Chủ tài khoản</div>
                      <div className="font-bold text-slate-800 text-sm uppercase">{ACCOUNT_NAME}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Số tài khoản</div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-lg tracking-wider">{ACCOUNT_NO}</span>
                        <button onClick={() => copyToClipboard(ACCOUNT_NO)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Copy size={16} /></button>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Nội dung chuyển khoản</div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-600 text-sm">{qrContent}</span>
                        <button onClick={() => copyToClipboard(qrContent)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Copy size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs font-semibold flex items-center justify-center text-center">
                    Sau khi chuyển khoản thành công, vui lòng bấm "Thanh toán hoàn tất" để cập nhật trạng thái đơn hàng.
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Fallbacks for other methods */}
            {['card', 'wallet', 'combined'].includes(paymentMethod) && (
              <motion.div 
                key="other"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col items-center justify-center text-slate-400"
              >
                <Landmark size={48} className="mb-4 opacity-50" />
                <p className="font-semibold text-center">Chức năng thanh toán qua {paymentMethod} đang được phát triển.</p>
                <p className="text-sm mt-2 text-center">Vui lòng sử dụng thiết bị bên ngoài và bấm "Thanh toán hoàn tất" khi thành công.</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Col 3: Order Details */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 shrink-0">
            <h2 className="font-bold text-slate-800 text-base">3. Thông tin {isDebtMode ? 'thanh toán công nợ' : 'đơn hàng'}</h2>
            {!isDebtMode && <p className="text-sm text-slate-500 mt-1 font-semibold">{orderData?.items?.length || 0} sản phẩm / dịch vụ</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isDebtMode ? (
              <div className="bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-100 space-y-2">
                <p className="font-black text-lg">Đang tiến hành thu nợ</p>
                <p className="text-sm font-semibold">Khách hàng: {debtData.customerName}</p>
                <p className="text-sm font-semibold">Số lượng đơn: {debtData.orderCount} đơn</p>
                <p className="text-sm font-semibold mt-2">Toàn bộ các đơn hàng đã chọn sẽ được chuyển sang trạng thái "Đã thanh toán" sau khi hoàn tất.</p>
              </div>
            ) : (
              orderData?.items?.map((item: any) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Box size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm line-clamp-2">{item.name}</h4>
                    {item.note && <p className="text-xs text-slate-500 mt-1 italic">"{item.note}"</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-slate-500">x{item.quantity}</div>
                    <div className="text-xs text-slate-400 line-through mt-0.5">{item.originalPrice && item.originalPrice !== item.price ? formatCurrency(item.originalPrice) : ''}</div>
                  </div>
                  <div className="w-24 text-right shrink-0">
                    <div className="text-xs text-slate-500 mb-1">{formatCurrency(item.price)}</div>
                    <div className="font-black text-slate-800 text-sm">{formatCurrency(item.price * item.quantity)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 space-y-3">
            {!isDebtMode && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Tổng tiền hàng</span>
                  <span className="font-bold text-slate-800">{formatCurrency(orderData?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Giảm giá</span>
                  <span className="font-bold text-slate-800">{formatCurrency(orderData?.discount || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Phí dịch vụ</span>
                  <span className="font-bold text-slate-800">0 ₫</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                  <span>Thuế VAT ({orderData?.tax || 0}%)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(orderData?.taxAmount || 0)}</span>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="font-black text-slate-800 text-base">Tổng thanh toán</span>
              <span className="font-black text-blue-600 text-2xl">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex gap-4 pt-3 border-t border-slate-200">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Ghi chú (nếu có)</label>
                <input 
                  type="text" 
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  placeholder="Nhập ghi chú..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Trạng thái</label>
                <select 
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="Chờ thanh toán">Chờ thanh toán</option>
                  <option value="Đã thanh toán">Đã thanh toán</option>
                  <option value="Đang giao">Đang giao</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              {!isDebtMode && (
                <>
                  <button 
                    onClick={() => onClose()}
                    className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                  >
                    Hủy đơn
                  </button>
                  <button 
                    onClick={() => {
                      toast.success('Đã lưu tạm đơn hàng');
                      if (onSuccess) onSuccess(); else onClose();
                    }}
                    className="px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
                  >
                    Lưu tạm
                  </button>
                </>
              )}
              {isDebtMode && (
                <button 
                  onClick={() => { if (onSuccess) onSuccess(); else onClose(); }}
                  className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                >
                  Hủy thu nợ
                </button>
              )}
              <button 
                onClick={handleCompletePayment}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-2 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> {isProcessing ? 'Đang xử lý...' : 'Thanh toán hoàn tất (F9)'}
              </button>
            </div>
          </div>
        </div>

      </div>
      </motion.div>
    </div>
  );
}