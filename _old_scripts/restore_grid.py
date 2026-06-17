with open('src/components/PaymentModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change Grid back to 12
content = content.replace('grid-cols-1 lg:grid-cols-10', 'grid-cols-1 lg:grid-cols-12')

# Col 1
content = content.replace('className="lg:col-span-2 space-y-4"', 'className="lg:col-span-3 space-y-4"')
# Col 2
content = content.replace('className="lg:col-span-5 flex flex-col gap-6"', 'className="lg:col-span-4 flex flex-col gap-6"')
# Col 3
content = content.replace('className="lg:col-span-3 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"', 'className="lg:col-span-5 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"')

# QR flex
content = content.replace('className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center"', 'className="flex flex-col xl:flex-row gap-5 items-center xl:items-start justify-center"')

with open('src/components/PaymentModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Restored 12-col layout')
