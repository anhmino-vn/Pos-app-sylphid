import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, ChevronDown, Award, CalendarDays, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType, HrPayrollSlip } from '../../lib/supabase';
import { collection, query, where, getDocs } from '../../lib/firebaseAdapter';
import { useAuth } from '../../App';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

export const MyPayroll = () => {
  const { user } = useAuth();
  const [slips, setSlips] = useState<HrPayrollSlip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchSlips = async () => {
      try {
        const snap = await getDocs(
          query(collection('hrPayrollSlips'), where('userId', '==', user.id))
        );
        
        // Mock data if none exists just for demo purposes of the UI
        if (snap.empty) {
          const mockSlip: HrPayrollSlip = {
            id: 'mock-1',
            userId: user.id,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            baseSalary: 5000000,
            totalCommission: 1500000,
            bonus: 500000,
            deductions: 0,
            netSalary: 7000000,
            status: 'draft',
            createdAt: new Date().toISOString()
          };
          setSlips([mockSlip]);
        } else {
          setSlips(snap.docs.map(d => ({ id: d.id, ...d.data() } as HrPayrollSlip)));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'hrPayrollSlips');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSlips();
  }, [user]);

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lương Thưởng</h1>
          <p className="text-sm text-slate-500">Xem phiếu lương cá nhân</p>
        </div>
        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
          <DollarSign size={24} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-4">
          {slips.sort((a,b) => b.month - a.month).map((slip) => (
            <div key={slip.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="text-slate-400" size={20} />
                  <span className="font-bold text-slate-700">Tháng {slip.month}/{slip.year}</span>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                  slip.status === 'paid' ? 'bg-green-100 text-green-700' :
                  slip.status === 'finalized' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {slip.status === 'paid' ? 'Đã Thanh Toán' : slip.status === 'finalized' ? 'Đã Chốt' : 'Tạm Tính'}
                </div>
              </div>
              
              <div className="p-5">
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-500 font-medium mb-1">Thực Lãnh</p>
                  <p className="text-3xl font-black text-emerald-600">{formatCurrency(slip.netSalary)}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-500 flex items-center gap-2"><CalendarDays size={16}/> Lương cơ bản</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(slip.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-500 flex items-center gap-2"><Award size={16}/> Hoa hồng dịch vụ</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(slip.totalCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-500 flex items-center gap-2 text-green-500"><DollarSign size={16}/> Thưởng</span>
                    <span className="font-semibold text-green-600">+{formatCurrency(slip.bonus)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 flex items-center gap-2 text-red-500"><ChevronDown size={16}/> Khấu trừ/Phạt</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(slip.deductions)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {slips.length === 0 && (
            <div className="text-center p-10 bg-white rounded-xl border border-slate-100">
              <p className="text-slate-500">Chưa có phiếu lương nào.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
