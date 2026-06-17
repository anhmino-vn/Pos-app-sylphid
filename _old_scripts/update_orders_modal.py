with open('src/pages/Orders.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import for PaymentModal
import_target = "import { AddCustomerModal } from '../components/AddCustomerModal';"
import_replacement = "import { AddCustomerModal } from '../components/AddCustomerModal';\nimport { PaymentModal } from '../components/PaymentModal';"
if import_target in content:
    content = content.replace(import_target, import_replacement)
else:
    # Try finding another import to place it near
    import_target = "import { motion, AnimatePresence } from 'motion/react';"
    content = content.replace(import_target, import_target + "\nimport { PaymentModal } from '../components/PaymentModal';")

# Add state
state_target = "const [searchQuery, setSearchQuery] = useState('');"
state_replacement = "const [searchQuery, setSearchQuery] = useState('');\n  const [orderToPay, setOrderToPay] = useState<any>(null);"
content = content.replace(state_target, state_replacement)

# Replace navigate
nav_target1 = "navigate('/orders/payments', { state: { orderData: order } });"
nav_replacement1 = "setOrderToPay(order);"
content = content.replace(nav_target1, nav_replacement1)

# Add Modal rendering at the end, right before the last closing tags
# In Orders.tsx, the structure ends with:
#       {/* Print Receipt Element */}
#       <div className="hidden">
#           ...
#       </div>
#     </div>
#   );
# }

# We will inject the AnimatePresence block before the final </div>
end_target = "    </div>\n  );\n}"
end_replacement = """      <AnimatePresence>
        {orderToPay && (
          <PaymentModal 
            orderData={orderToPay} 
            onClose={() => setOrderToPay(null)} 
            onSuccess={() => setOrderToPay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}"""
content = content.replace(end_target, end_replacement)

with open('src/pages/Orders.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Orders.tsx to use PaymentModal")
