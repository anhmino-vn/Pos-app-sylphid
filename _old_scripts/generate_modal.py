import re

with open('src/pages/Payment.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace export function Payment() with PaymentModal
content = content.replace('export function Payment() {', 'export function PaymentModal({ orderData: initialOrderData, debtData: initialDebtData, onClose, onSuccess }: { orderData?: any, debtData?: any, onClose: () => void, onSuccess?: () => void }) {')

# Remove useLocation and useNavigate from body
content = content.replace('const location = useLocation();', '')
content = content.replace('const navigate = useNavigate();', '')

# Replace location.state with initialData
content = content.replace('useState<any>(location.state?.orderData || null);', 'useState<any>(initialOrderData || null);')
content = content.replace('useState<any>(location.state?.debtData || null);', 'useState<any>(initialDebtData || null);')

# Replace navigate() with onSuccess/onClose
content = content.replace("navigate('/finances/debts');", "if (onSuccess) onSuccess(); else onClose();")
content = content.replace("navigate('/orders');", "if (onSuccess) onSuccess(); else onClose();")
content = content.replace("navigate('/orders/create');", "onClose();")

# Modify the outer div of the main render
# The main render starts at 'return (' followed by '<div className="flex flex-col min-h-[calc(100vh-72px)] -m-4 sm:-m-6 md:-m-8 bg-[#F1F5F9] font-sans">'
old_outer = 'return (\n    <div className="flex flex-col min-h-[calc(100vh-72px)] -m-4 sm:-m-6 md:-m-8 bg-[#F1F5F9] font-sans">'
new_outer = '''return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#F1F5F9] rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>'''
content = content.replace(old_outer, new_outer)

# Fix the end of the return statement
content = re.sub(r'    </div>\n  \);\n}\s*$', '      </motion.div>\n    </div>\n  );\n}', content)

# Add close button to header
header_target = '<h1 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán đơn hàng</h1>'
header_replacement = '''<div className="flex justify-between items-center w-full">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán đơn hàng</h1>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X size={20}/></button>
        </div>'''
content = content.replace(header_target, header_replacement)

# Remove the pending orders view because it's not needed in the modal.
# Find where the if (!orderData && !debtData) { return (...) } is.
# We can just change the condition to return null since modal should only be invoked with data.
pending_ui_start = 'if (!orderData && !debtData) {\n     return ('
if pending_ui_start in content:
    idx = content.find(pending_ui_start)
    end_idx = content.find('  }\n\n  const handleNumpadClick', idx)
    if end_idx != -1:
        content = content[:idx] + 'if (!orderData && !debtData) return null;\n' + content[end_idx + 4:]

with open('src/components/PaymentModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Created src/components/PaymentModal.tsx')
