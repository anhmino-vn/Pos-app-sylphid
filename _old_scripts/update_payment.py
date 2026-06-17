with open('src/pages/Payment.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  useEffect(() => {
    if (!orderData && !debtData) {
      toast.error('Không tìm thấy thông tin thanh toán');
      navigate('/orders/create');
    }
  }, [orderData, debtData, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleCompletePayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompletePayment]);

  if (!orderData && !debtData) return null;"""

replacement = """  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
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

  if (!orderData && !debtData) {
     return (
       <div className="flex flex-col min-h-[calc(100vh-72px)] -m-4 sm:-m-6 md:-m-8 bg-[#F1F5F9] font-sans">
         <div className="bg-white px-6 py-4 shadow-sm border-b border-slate-200 shrink-0">
           <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán đơn hàng</h1>
           <div className="flex items-center text-xs text-slate-500 mt-1 font-semibold">
             <span>POS Bán hàng</span>
             <ChevronRight size={14} className="mx-1" />
             <span className="text-blue-600">Thanh toán</span>
           </div>
         </div>
         <div className="flex-1 p-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-lg font-black text-slate-800">Đơn hàng chờ thanh toán</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Chọn một đơn hàng bên dưới để tiếp tục thanh toán</p>
                 </div>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Tìm mã đơn, tên khách..." 
                      className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none w-64"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                 </div>
               </div>

               {loadingOrders ? (
                  <div className="flex justify-center items-center py-20">
                     <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
               ) : pendingOrders.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-100">
                     <Box className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                     <h3 className="text-lg font-bold text-slate-700">Không có đơn hàng nào chờ thanh toán</h3>
                     <p className="text-sm text-slate-500 mt-2">Tất cả các đơn hàng đã được thanh toán hoặc hủy.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {pendingOrders
                        .filter(o => 
                           (o.id && o.id.toLowerCase().includes(searchQuery.toLowerCase())) || 
                           (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           (o.customerPhone && o.customerPhone.includes(searchQuery))
                        )
                        .map(order => (
                        <div 
                          key={order.id} 
                          onClick={() => setOrderData(order)}
                          className="bg-white border-2 border-slate-100 rounded-2xl p-5 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                        >
                           <div>
                              <div className="flex justify-between items-start mb-4">
                                 <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mã đơn</div>
                                    <div className="font-black text-blue-600">#{order.id?.slice(-6).toUpperCase()}</div>
                                 </div>
                                 <div className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-md">
                                    Chờ thanh toán
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
                                 <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                    <img src={`https://ui-avatars.com/api/?name=${order.customerName || 'Khách'}&background=e2e8f0&color=475569&bold=true`} alt="Customer" />
                                 </div>
                                 <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">{order.customerName || 'Khách lẻ'}</div>
                                    <div className="text-xs text-slate-500">{order.customerPhone || 'Không có SĐT'}</div>
                                 </div>
                              </div>
                           </div>
                           <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                              <span className="text-sm font-semibold text-slate-500">{order.items?.length || 0} sản phẩm</span>
                              <span className="font-black text-slate-800 text-lg">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount || 0)}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
       </div>
     );
  }"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/pages/Payment.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced content")
else:
    print("Could not find target content")
