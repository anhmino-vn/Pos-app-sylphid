import React from 'react';
import { EmployeeList } from './users/EmployeeList';

export function Users() {
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Danh Sách Nhân Viên</h1>
          <p className="text-slate-500 font-medium mt-1">Quản lý toàn bộ nhân sự trong hệ thống</p>
        </div>
      </div>
      <EmployeeList />
    </div>
  );
}
