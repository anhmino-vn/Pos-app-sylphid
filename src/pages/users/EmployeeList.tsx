import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { UserProfile, db, handleFirestoreError, OperationType, Department, Role, auth } from '../../lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { Users as UsersIcon, Plus, Edit2, Trash2, X, Loader2, CheckCircle2, ShieldCheck, Mail, Phone, Calendar, Building2, UserCog, AlertCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../lib/utils';

export function EmployeeList() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [position, setPosition] = useState('');
  const [workStatus, setWorkStatus] = useState<'working' | 'probation' | 'resigned' | 'on_leave'>('working');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    });

    const qD = query(collection(db, 'departments'));
    const unsubDept = onSnapshot(qD, (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    });

    const qR = query(collection(db, 'roles'));
    const unsubRole = onSnapshot(qR, (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
    });

    return () => { unsubUsers(); unsubDept(); unsubRole(); };
  }, []);

  const openAdd = () => {
     setSelectedUser(null);
     setEmail('');
     setPassword('');
     setName('');
     setPhone('');
     setEmployeeCode(`NV${Math.floor(Math.random() * 10000)}`);
     setDepartmentId('');
     setRoleId('');
     setPosition('');
     setWorkStatus('working');
     setIsModalOpen(true);
  }

  const openEdit = (user: UserProfile) => {
     if (user.email === 'anhmino.it@gmail.com') return;
     setSelectedUser(user);
     setEmail(user.email);
     setName(user.name || '');
     setPhone(user.phone || '');
     setEmployeeCode(user.employeeCode || '');
     setDepartmentId(user.departmentId || '');
     setRoleId(user.roleId || '');
     setPosition(user.position || '');
     setWorkStatus(user.workStatus || 'working');
     setIsModalOpen(true);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (selectedUser) {
         await updateDoc(doc(db, 'users', selectedUser.uid), {
            name, phone, employeeCode, departmentId, roleId, position, workStatus,
            updatedAt: serverTimestamp()
         });
      } else {
         if (!email || !password) throw new Error("Vui lòng nhập Email và Mật khẩu!");
         const { createStaffAccount } = await import('../../lib/firebase');
         const newUser = await createStaffAccount(email, password);
         
         await setDoc(doc(db, 'users', newUser.uid), {
            email, name, phone, employeeCode, departmentId, roleId, position, workStatus,
            role: 'staff',
            shopName: 'HQ Spa',
            status: 'active',
            createdAt: serverTimestamp()
         });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
         alert('Tính năng đăng nhập bằng Email/Mật khẩu chưa được bật. Vui lòng vào Firebase Console -> Authentication -> Sign-in method và bật Email/Password.');
      } else if (err.code === 'auth/email-already-in-use') {
         alert('Email này đã được sử dụng cho một tài khoản khác.');
      } else {
         alert(err.message || 'Lỗi khi lưu nhân sự');
      }
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: UserProfile) => {
    if (user.email === 'anhmino.it@gmail.com') return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: user.status === 'locked' ? 'active' : 'locked',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, user: UserProfile | null, isBulk?: boolean}>({ isOpen: false, user: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleDelete = (user: UserProfile) => {
    if (user.email === 'anhmino.it@gmail.com') return;
    setDeleteConfirm({ isOpen: true, user });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ isOpen: true, user: null, isBulk: true });
  };

  const executeDeleteEmployee = async () => {
    if (deleteConfirm.isBulk) {
       if (selectedIds.length === 0) return;
       try {
          const { logActivity } = await import('../../lib/activityUtils');
          let deleted = 0;
          let deactivated = 0;
          for (const id of selectedIds) {
             const user = users.find(u => u.uid === id);
             if (!user || user.email === 'anhmino.it@gmail.com') continue;

             const bSnap = await getDocs(query(collection(db, 'bookings'), where('staffId', '==', user.uid)));
             const txSnap = await getDocs(query(collection(db, 'customer_transactions'), where('staffId', '==', user.uid)));

             if (!bSnap.empty || !txSnap.empty) {
                await updateDoc(doc(db, 'users', user.uid), {
                  status: 'locked',
                  updatedAt: serverTimestamp()
                });
                deactivated++;
             } else {
                await deleteDoc(doc(db, 'users', user.uid));
                deleted++;
             }
             await logActivity(auth.currentUser as any, 'Nhân sự', 'Xóa/Khóa Hàng Loạt', `Đơn vị: user ${user.email}`);
          }
          toast.success(`Đã xóa ${deleted} và khóa ${deactivated} nhân sự`);
          setSelectedIds([]);
       } catch (error) {
          toast.error('Lỗi thao tác hàng loạt!');
       } finally {
          setDeleteConfirm({ isOpen: false, user: null });
       }
       return;
    }

    const user = deleteConfirm.user;
    if (!user) return;

    try {
      // Check if employee has data
      const bSnap = await getDocs(query(collection(db, 'bookings'), where('staffId', '==', user.uid)));
      const lSnap = await getDocs(query(collection(db, 'activity_logs'), where('userEmail', '==', user.email)));
      
      const hasData = !bSnap.empty || !lSnap.empty;

      if (hasData) {
         await updateDoc(doc(db, 'users', user.uid), {
           status: 'locked',
           updatedAt: serverTimestamp()
         });
         toast.success('Nhân sự đã có dữ liệu giao dịch/lịch sử trên hệ thống. Đã chuyển sang trạng thái "Khóa" thay vì xóa cứng.');
      } else {
         await deleteDoc(doc(db, 'users', user.uid));
         toast.success('Xóa nhân sự thành công!');
      }

      const { logActivity } = await import('../../lib/activityUtils');
      const { auth } = await import('../../lib/firebase');
      await logActivity(auth.currentUser as any, 'Nhân sự', 'Xóa', `Đã xóa/khóa tài khoản user ${user.email}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    } finally {
      setDeleteConfirm({ isOpen: false, user: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mx-1 gap-4">
         <div>
            <h2 className="text-lg font-black text-slate-900 uppercase">Danh sách nhân sự</h2>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500">Quản lý hồ sơ nhân sự, phòng ban, và trạng thái</p>
         </div>
         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {selectedIds.length > 0 && (
               <button onClick={handleBulkDelete} className="flex-1 sm:flex-none justify-center px-4 md:px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-rose-100 transition-all shadow-sm whitespace-nowrap">
                  <Trash2 className="w-4 h-4" /> Xóa {selectedIds.length} mục
               </button>
            )}
            <button onClick={openAdd} className="flex-1 sm:flex-none justify-center px-4 md:px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 whitespace-nowrap">
               <Plus className="w-4 h-4" /> Thêm mới
            </button>
         </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
         {loading ? (
            <div className="py-24 text-center flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2 opacity-20" />
            </div>
         ) : users.length === 0 ? (
            <div className="py-24 text-center">
               <UsersIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
               <p className="text-slate-500 font-medium">Chưa có nhân viên nào.</p>
            </div>
         ) : (
            <div className="overflow-x-auto w-full">
               <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                     <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-4 md:px-6 py-4 w-12">
                           <input 
                             type="checkbox"
                             checked={users.length > 0 && selectedIds.length === users.length}
                             onChange={(e) => {
                                if (e.target.checked) setSelectedIds(users.map(u => u.uid));
                                else setSelectedIds([]);
                             }}
                             className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                           />
                        </th>
                        <th className="px-2 md:px-4 py-4">Nhân sự</th>
                        <th className="px-4 md:px-6 py-4">Chức vụ & Phòng ban</th>
                        <th className="px-4 md:px-6 py-4">Vai trò</th>
                        <th className="px-4 md:px-6 py-4">Trạng thái</th>
                        <th className="px-4 md:px-6 py-4 text-right">Tác vụ</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {users.map(user => {
                        const dept = departments.find(d => d.id === user.departmentId);
                        const role = roles.find(r => r.id === user.roleId) || (user.role === 'admin' ? { name: 'Super Admin', isSystem: true } : { name: 'Chưa phân quyền' });

                        return (
                        <tr key={user.uid} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-4 md:px-6 py-4 w-12">
                             <input 
                               type="checkbox"
                               checked={selectedIds.includes(user.uid!)}
                               onChange={(e) => {
                                  if (e.target.checked) setSelectedIds(prev => [...prev, user.uid!]);
                                  else setSelectedIds(prev => prev.filter(id => id !== user.uid!));
                               }}
                               className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                             />
                           </td>
                           <td className="px-2 md:px-4 py-4 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 shrink-0 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                                    {user.email[0].toUpperCase()}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm truncate">{user.name || 'Chưa cập nhật'}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-0.5">
                                      <span className="truncate max-w-[80px]">{user.employeeCode || 'Chưa có mã'}</span>
                                      <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                                      <span className="truncate max-w-[120px]">{user.email}</span>
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-4 md:px-6 py-4">
                              <div className="text-sm font-bold text-slate-900">{user.position || 'Chưa có chức vụ'}</div>
                              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                 <Building2 className="w-3.5 h-3.5" /> {dept ? dept.name : 'Chưa có phòng ban'}
                              </div>
                           </td>
                           <td className="px-4 md:px-6 py-4">
                              <span className={cn("px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap", (role as any)?.isSystem ? "bg-amber-50 text-amber-600" : "")}>
                                 {role.name}
                              </span>
                           </td>
                           <td className="px-4 md:px-6 py-4 flex gap-2 flex-wrap min-w-[200px]">
                              <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap", user.status === 'locked' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                                 {user.status === 'locked' ? 'Khóa' : 'Đang HĐ'}
                              </span>
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500 whitespace-nowrap">
                                 {user.workStatus === 'working' ? 'Làm việc' : user.workStatus === 'probation' ? 'Thử việc' : user.workStatus === 'on_leave' ? 'Nghỉ phép' : 'Đã nghỉ việc'}
                              </span>
                           </td>
                           <td className="px-4 md:px-6 py-4 text-right">
                              {user.email !== 'anhmino.it@gmail.com' && (
                                 <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => toggleStatus(user)} title={user.status === 'locked' ? "Mở khóa" : "Khóa tài khoản"} className={cn("p-2 rounded-xl transition-colors", user.status === 'locked' ? "text-emerald-500 hover:bg-emerald-50" : "text-amber-500 hover:bg-amber-50")}>
                                       {user.status === 'locked' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => openEdit(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(user)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                                 </div>
                              )}
                           </td>
                        </tr>
                        )})}
                  </tbody>
               </table>
            </div>
         )}
      </div>

      <AnimatePresence>
         {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10 shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><UserCog className="w-6 h-6" /></div>
                        <div>
                           <h3 className="text-xl font-black text-slate-900 uppercase">{selectedUser ? 'Cập nhật tài khoản' : 'Tạo mới tài khoản'}</h3>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Thông tin nhân sự</p>
                        </div>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="overflow-y-auto p-6 bg-slate-50/50 flex-1">
                     <form id="userForm" onSubmit={handleSave} className="space-y-6">
                        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                           <h4 className="text-xs font-black uppercase text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2"><UserCog className="w-4 h-4" /> Tài khoản & Đăng nhập</h4>
                           
                           {!selectedUser && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Email đăng nhập</label>
                                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Mật khẩu</label>
                                    <input required type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" />
                                 </div>
                              </div>
                           )}
                           {selectedUser && (
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Email đăng nhập (Không thể thay đổi)</label>
                                 <input disabled type="email" value={email} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 cursor-not-allowed" />
                              </div>
                           )}
                        </div>

                        <div className="bg-white p-4 sm:p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4 sm:space-y-6">
                           <h4 className="text-xs font-black uppercase text-slate-900 mb-2 sm:mb-4 border-b border-slate-100 pb-2 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Hồ sơ cá nhân</h4>
                           
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Họ & Tên</label>
                                 <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" />
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Số điện thoại</label>
                                 <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" />
                              </div>
                              <div className="sm:col-span-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Mã nhân viên (Tạo tự động)</label>
                                 <input type="text" value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" />
                              </div>
                           </div>
                        </div>

                        <div className="bg-white p-4 sm:p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-4 sm:space-y-6">
                           <h4 className="text-xs font-black uppercase text-slate-900 mb-2 sm:mb-4 border-b border-slate-100 pb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> Công việc & Vận hành</h4>
                           
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Phòng ban</label>
                                 <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20">
                                    <option value="">-- Chọn phòng ban --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Chức danh / Chức vụ</label>
                                 <input type="text" value={position} onChange={e => setPosition(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20" placeholder="VD: Trưởng phòng, Chuyên viên..." />
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Vai trò hệ thống / Phân quyền</label>
                                 <select required value={roleId} onChange={e => setRoleId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20">
                                    <option value="">-- Chọn nhóm quyền --</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} {r.isSystem ? '(System)' : ''}</option>)}
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Trạng thái làm việc</label>
                                 <select value={workStatus} onChange={e => setWorkStatus(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20">
                                    <option value="working">Đang làm việc</option>
                                    <option value="probation">Thử việc</option>
                                    <option value="on_leave">Nghỉ phép</option>
                                    <option value="resigned">Đã nghỉ việc</option>
                                 </select>
                              </div>
                           </div>
                        </div>

                     </form>
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Hủy</button>
                     <button type="submit" form="userForm" disabled={saving} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {selectedUser ? "Cập nhật nhân sự" : "Tạo mới tài khoản"}
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xác nhận xóa nhân sự"
        message="Nhân sự đã có dữ liệu giao dịch hoặc lịch sử trên hệ thống sẽ được chuyển sang trạng thái Khóa thay vì xóa cứng. Thao tác xóa cứng không thể hoàn tác."
        onConfirm={executeDeleteEmployee}
        onCancel={() => setDeleteConfirm({ isOpen: false, user: null })}
      />
    </div>
  );
}
