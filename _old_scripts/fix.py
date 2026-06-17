with open('src/pages/Settings.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# add imports
imports = [
    "import { InvoiceSettings } from './settings/InvoiceSettings';\n",
    "import { PaymentSettings } from './settings/PaymentSettings';\n"
]

# find the last import
last_import = 0
for i, line in enumerate(lines):
    if line.startswith('import '):
        last_import = i

lines = lines[:last_import+1] + imports + lines[last_import+1:]

# find boundaries
start = -1
end = -1
for i, line in enumerate(lines):
    if 'INVOICE TAB' in line and start == -1:
        start = i
    if 'INVENTORY TAB' in line and end == -1:
        end = i

if start != -1 and end != -1:
    replacement = [
        '                {/* INVOICE TAB */}\n',
        '                {activeTab === "invoice" && (\n',
        '                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">\n',
        '                     <InvoiceSettings />\n',
        '                  </motion.div>\n',
        '                )}\n',
        '\n',
        '                {/* PAYMENT TAB */}\n',
        '                {activeTab === "payment" && (\n',
        '                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">\n',
        '                     <PaymentSettings />\n',
        '                  </motion.div>\n',
        '                )}\n',
        '\n'
    ]
    lines = lines[:start] + replacement + lines[end:]
    with open('src/pages/Settings.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('done')
else:
    print('indices not found', start, end)
