with open('src/components/PaymentModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Col 2: QR Code Flex
content = content.replace(
    'className="flex flex-col sm:flex-row gap-6 items-center sm:items-start justify-center"',
    'className="flex flex-col xl:flex-row gap-4 items-center xl:items-start justify-center"'
)

# Fix Col 3: Compress Bottom Section
content = content.replace(
    'className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 space-y-4"',
    'className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 space-y-3"'
)

old_note_status = """<div className="space-y-3 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Ghi chú đơn hàng (nếu có)</label>
                <input 
                  type="text" 
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  placeholder="Nhập ghi chú..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Trạng thái đơn hàng</label>
                <select 
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="Chờ thanh toán">Chờ thanh toán</option>
                  <option value="Đã thanh toán">Đã thanh toán</option>
                  <option value="Đang giao">Đang giao</option>
                </select>
              </div>
            </div>"""

new_note_status = """<div className="flex gap-4 pt-3 border-t border-slate-200">
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
            </div>"""
content = content.replace(old_note_status, new_note_status)

# Reduce button padding
content = content.replace('px-5 py-3 text-sm font-bold text-slate-600', 'px-4 py-2.5 text-sm font-bold text-slate-600')
content = content.replace('px-5 py-3 text-sm font-bold text-blue-600', 'px-4 py-2.5 text-sm font-bold text-blue-600')
content = content.replace('flex-1 py-3 px-2 text-sm font-black text-white', 'flex-1 py-2.5 px-2 text-sm font-black text-white')

# Make top part of Col 3 padding smaller
content = content.replace('className="flex-1 overflow-y-auto p-6 space-y-4"', 'className="flex-1 overflow-y-auto p-4 space-y-3"')

with open('src/components/PaymentModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal layout compressed")
