with open('src/pages/Orders.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = "const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);"
replacement = "const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);\n  const [orderToPay, setOrderToPay] = useState<any>(null);"

if target in content and "setOrderToPay] = useState" not in content:
    content = content.replace(target, replacement)
    with open('src/pages/Orders.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Added orderToPay state')
else:
    print('Already added or target not found')
