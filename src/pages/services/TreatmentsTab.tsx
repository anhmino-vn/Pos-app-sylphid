import React from 'react';
import { Construction } from 'lucide-react';

export function TreatmentsTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-500">
        <Construction size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Liệu trình (Treatments)</h2>
      <p className="text-slate-500 text-center max-w-md">
        Tính năng theo dõi và quản lý các buổi liệu trình cho khách hàng đang trong quá trình phát triển và sẽ sớm được ra mắt.
      </p>
    </div>
  );
}
