const fs = require('fs');
const path = require('path');

const files = {
    'src/pages/customers/Vouchers.tsx': 'Voucher / Mã giảm giá',
    'src/pages/bookings/TreatmentRooms.tsx': 'Phòng điều trị',
    'src/pages/bookings/BookingHistory.tsx': 'Lịch sử hẹn',
    'src/pages/services/ServiceCombos.tsx': 'Tạo Combo',
    'src/pages/finances/Incomes.tsx': 'Phiếu thu',
    'src/pages/finances/Expenses.tsx': 'Phiếu chi',
    'src/pages/finances/Debts.tsx': 'Công nợ',
    'src/pages/users/Timesheets.tsx': 'Chấm công',
    'src/pages/users/Payroll.tsx': 'Bảng lương',
    'src/pages/users/StaffCommissions.tsx': 'Hoa hồng nhân viên',
    'src/pages/settings/StoreSettings.tsx': 'Thông tin cửa hàng',
    'src/pages/settings/Branches.tsx': 'Chi nhánh',
    'src/pages/settings/Devices.tsx': 'Máy in / Thiết bị'
};

const getTemplate = (name, title) => `import React from 'react';
import { Construction } from 'lucide-react';

export function ${name}() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-500">
        <Construction size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">${title}</h2>
      <p className="text-slate-500 text-center max-w-md">
        Tính năng này đang trong quá trình phát triển và sẽ sớm được ra mắt trong bản cập nhật tiếp theo.
      </p>
    </div>
  );
}
`;

for (const [filePath, title] of Object.entries(files)) {
    const fullPath = path.join(__dirname, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const componentName = path.basename(filePath, '.tsx');
    fs.writeFileSync(fullPath, getTemplate(componentName, title), 'utf8');
}

console.log("Placeholders generated!");
