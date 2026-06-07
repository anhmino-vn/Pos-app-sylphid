import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, User, Activity, AlertCircle, FileText, Calendar, Droplets, Heart } from 'lucide-react';
import { HealthRecord } from '../../lib/supabase';
import { cn, formatDate } from '../../lib/utils';

interface Props {
  record: HealthRecord;
  onClose: () => void;
  onEdit: () => void;
}

export function HealthRecordDrawer({ record, onClose, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'metrics' | 'history' | 'files'>('info');

  const tabs = [
    { id: 'info', label: 'Khách hàng', icon: User },
    { id: 'metrics', label: 'Chỉ số cơ thể', icon: Activity },
    { id: 'history', label: 'Bệnh lý', icon: AlertCircle },
    { id: 'files', label: 'Tài liệu', icon: FileText },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 40 }} className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">Hồ sơ: {record.code}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{record.customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><Edit2 className="w-4 h-4 text-blue-600" /></button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-6 pt-4 gap-1 border-b border-slate-100 shrink-0 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all -mb-px',
                  activeTab === tab.id ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {activeTab === 'info' && (
              <div className="space-y-4">
                {[
                  { label: 'Khách hàng', value: record.customerName },
                  { label: 'Số điện thoại', value: record.customerPhone },
                  { label: 'Email', value: record.customerEmail || '—' },
                  { label: 'Ngày sinh', value: record.dateOfBirth ? formatDate(record.dateOfBirth).split(' ')[1] : '—' },
                  { label: 'Giới tính', value: record.gender === 'male' ? 'Nam' : record.gender === 'female' ? 'Nữ' : 'Khác' },
                  { label: 'Địa chỉ', value: record.customerAddress || '—' },
                  { label: 'Ngày tạo hồ sơ', value: record.createdAt ? formatDate(record.createdAt) : '—' },
                  { label: 'Người phụ trách', value: record.inChargeStaffName || '—' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Chiều cao', value: record.height ? `${record.height} cm` : '—', icon: Activity },
                  { label: 'Cân nặng', value: record.weight ? `${record.weight} kg` : '—', icon: Activity },
                  { label: 'BMI', value: record.bmi || '—', icon: Activity },
                  { label: 'Huyết áp', value: record.bloodPressure || '—', icon: Heart },
                  { label: 'Nhịp tim', value: record.heartRate ? `${record.heartRate} bpm` : '—', icon: Heart },
                  { label: 'Đường huyết', value: record.bloodSugar ? `${record.bloodSugar} mmol/L` : '—', icon: Droplets },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col p-5 bg-white rounded-2xl border border-slate-100 shadow-sm items-center text-center">
                    <item.icon className="w-5 h-5 text-rose-500 mb-2 opacity-50" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                    <span className="text-xl font-black text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">Bệnh nền</h4>
                  <div className="flex flex-wrap gap-2">
                    {record.conditions && record.conditions.length > 0 ? (
                      record.conditions.map(c => (
                        <span key={c} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold capitalize">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-medium text-slate-500">Không có dữ liệu</span>
                    )}
                  </div>
                </div>
                {[
                  { label: 'Dị ứng', value: record.allergies },
                  { label: 'Thuốc đang dùng', value: record.currentMedications },
                  { label: 'Tiền sử điều trị', value: record.treatmentHistory },
                  { label: 'Tình trạng hiện tại', value: record.currentCondition },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-2">{item.label}</h4>
                    <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-3">
                {(!record.attachments || record.attachments.length === 0) ? (
                  <div className="py-12 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Chưa có tài liệu đính kèm</p>
                  </div>
                ) : (
                  record.attachments.map((file, idx) => (
                    <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{file.type || 'Tài liệu'}</p>
                      </div>
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
