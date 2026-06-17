with open('src/components/PaymentModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change Grid
content = content.replace('grid-cols-1 lg:grid-cols-12', 'grid-cols-1 lg:grid-cols-10')

# Col 1
content = content.replace('className="lg:col-span-3 space-y-4"', 'className="lg:col-span-2 space-y-4"')
# Col 2
content = content.replace('className="lg:col-span-4 flex flex-col gap-6"', 'className="lg:col-span-5 flex flex-col gap-6"')
# Col 3
content = content.replace('className="lg:col-span-5 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"', 'className="lg:col-span-3 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"')

# Also, let's fix the QR Code alignment in Col 2. We changed it to flex-col xl:flex-row earlier.
# Search for: className="flex flex-col xl:flex-row gap-4 items-center xl:items-start justify-center"
target_qr_flex = 'className="flex flex-col xl:flex-row gap-4 items-center xl:items-start justify-center"'
new_qr_flex = 'className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center"'
content = content.replace(target_qr_flex, new_qr_flex)

# Also, the QR Code image box has w-48 h-48. It is slightly too big if the screen is small. We can make it w-40 h-40.
content = content.replace('w-48 h-48', 'w-40 h-40')

# Shrink the text inside Col 1 slightly so it doesn't break poorly
content = content.replace('text-xs text-slate-500 font-medium', 'text-[11px] text-slate-500 font-medium leading-tight mt-0.5')

# Reduce Col 1 button padding from p-4 to p-3 to save horizontal space
content = content.replace('p-4 rounded-xl border-2', 'p-3 rounded-xl border-2')

with open('src/components/PaymentModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done layout adjustment')
