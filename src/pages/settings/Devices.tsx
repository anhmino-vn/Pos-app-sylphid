import React from 'react';
import { Construction } from 'lucide-react';

export function Devices() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-500">
        <Construction size={40} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Máy in / Thiết bị</h2>
      <p className="text-slate-500 text-center max-w-md">
        Tính năng này đang trong quá trình phát triển và sẽ sớm được ra mắt trong bản cập nhật tiếp theo.
      </p>
    </div>
  );
}
