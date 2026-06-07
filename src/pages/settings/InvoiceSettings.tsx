import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, CheckCircle2, X, FileText, Code, Upload, Star, Download, FileType2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface InvoiceTemplate {
  id: string;
  name: string;
  type: 'html' | 'docx';
  file_url: string;
  is_default: boolean;
  content?: string; // only for html
}

export function InvoiceSettings() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'html' | 'docx'>('html');
  const [fileUrl, setFileUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('invoice_templates').select('*').order('created_at', { ascending: false });
      if (error) {
        // Fallback to local storage if table doesn't exist yet
        const localData = localStorage.getItem('mock_invoice_templates');
        if (localData) {
           setTemplates(JSON.parse(localData));
        } else {
           // Provide some default HTML template
           const defaultHtml = `
<div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <h1 style="text-align: center;">HÓA ĐƠN BÁN HÀNG</h1>
  <p><strong>Mã đơn:</strong> {{invoice_number}}</p>
  <p><strong>Ngày tạo:</strong> {{created_at}}</p>
  <hr/>
  <p><strong>Khách hàng:</strong> {{customer_name}}</p>
  <p><strong>SĐT:</strong> {{customer_phone}}</p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <thead>
      <tr style="border-bottom: 2px solid #000;">
        <th style="text-align: left; padding: 8px;">Tên món</th>
        <th style="text-align: right; padding: 8px;">SL</th>
        <th style="text-align: right; padding: 8px;">Đơn giá</th>
        <th style="text-align: right; padding: 8px;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;">{{name}}</td>
        <td style="text-align: right; padding: 8px;">{{quantity}}</td>
        <td style="text-align: right; padding: 8px;">{{price}}</td>
        <td style="text-align: right; padding: 8px;">{{total}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>
  <div style="text-align: right; margin-top: 20px;">
    <p>Tạm tính: <strong>{{subtotal}}</strong></p>
    <p>Chiết khấu: <strong>{{discount}}</strong></p>
    <h3 style="color: red;">Tổng thanh toán: {{total_amount}}</h3>
  </div>
</div>`;
           const initialMock = [{
              id: '1', name: 'Mẫu Tiêu Chuẩn (A4/A5)', type: 'html', file_url: '', content: defaultHtml, is_default: true
           }];
           localStorage.setItem('mock_invoice_templates', JSON.stringify(initialMock));
           setTemplates(initialMock as any);
        }
      } else {
        setTemplates(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (!e.target.files || e.target.files.length === 0) return;
     const file = e.target.files[0];
     // In a real app, upload to Supabase Storage and get URL.
     // For now, we mock the file URL just to store the reference.
     toast.success(`Đã tải lên: ${file.name}`);
     setFileUrl(`https://mock-storage.com/${file.name}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Vui lòng nhập tên mẫu');
      return;
    }

    const payload = {
      name,
      type,
      file_url: fileUrl,
      content: htmlContent,
      is_default: isDefault || templates.filter(t => t.type === type).length === 0
    };

    try {
      if (payload.is_default) {
        // Unset default for same type
        const currentLocal = JSON.parse(localStorage.getItem('mock_invoice_templates') || '[]');
        currentLocal.forEach((t: any) => { if (t.type === type) t.is_default = false; });
        localStorage.setItem('mock_invoice_templates', JSON.stringify(currentLocal));
      }

      if (editingId) {
        const { error } = await supabase.from('invoice_templates').update(payload).eq('id', editingId);
        if (error) {
           // Mock
           const currentLocal = JSON.parse(localStorage.getItem('mock_invoice_templates') || '[]');
           const index = currentLocal.findIndex((t: any) => t.id === editingId);
           if (index > -1) currentLocal[index] = { ...currentLocal[index], ...payload };
           localStorage.setItem('mock_invoice_templates', JSON.stringify(currentLocal));
        }
        toast.success('Cập nhật mẫu thành công');
      } else {
        const { error } = await supabase.from('invoice_templates').insert(payload);
        if (error) {
           // Mock
           const newMock = { id: Date.now().toString(), ...payload, created_at: new Date().toISOString() };
           const currentLocal = JSON.parse(localStorage.getItem('mock_invoice_templates') || '[]');
           localStorage.setItem('mock_invoice_templates', JSON.stringify([newMock, ...currentLocal]));
        }
        toast.success('Thêm mẫu hóa đơn thành công');
      }
      
      closeModal();
      fetchTemplates();
    } catch (e: any) {
      toast.error('Có lỗi xảy ra: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá mẫu này không?')) return;
    try {
      const { error } = await supabase.from('invoice_templates').delete().eq('id', id);
      if (error) {
         const currentLocal = JSON.parse(localStorage.getItem('mock_invoice_templates') || '[]');
         localStorage.setItem('mock_invoice_templates', JSON.stringify(currentLocal.filter((t: any) => t.id !== id)));
      }
      toast.success('Đã xoá mẫu hóa đơn');
      fetchTemplates();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleSetDefault = async (template: InvoiceTemplate) => {
    try {
      const currentLocal = JSON.parse(localStorage.getItem('mock_invoice_templates') || '[]');
      currentLocal.forEach((t: any) => { 
         if (t.type === template.type) t.is_default = (t.id === template.id); 
      });
      localStorage.setItem('mock_invoice_templates', JSON.stringify(currentLocal));
      
      toast.success('Đã chọn mẫu mặc định');
      fetchTemplates();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const openModalForEdit = (template?: InvoiceTemplate) => {
    if (template) {
       setEditingId(template.id);
       setName(template.name);
       setType(template.type);
       setFileUrl(template.file_url);
       setHtmlContent(template.content || '');
       setIsDefault(template.is_default);
    } else {
       setEditingId(null);
       setName('');
       setType('html');
       setFileUrl('');
       setHtmlContent('');
       setIsDefault(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cấu hình Hóa đơn</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý các Template DOCX và HTML sử dụng cơ chế Template Engine</p>
        </div>
        <button 
          onClick={() => openModalForEdit()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus size={18} />
          Thêm mẫu mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Đang tải cấu hình...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-[24px] border border-dashed border-slate-200">
             <FileText className="w-12 h-12 text-slate-300 mb-4" />
             <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có mẫu nào</h3>
             <button onClick={() => openModalForEdit()} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors mt-4">Tạo mẫu ngay</button>
          </div>
        ) : (
          templates.map((template) => (
            <motion.div 
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("bg-white rounded-[24px] border p-6 relative overflow-hidden transition-all shadow-sm hover:shadow-md", template.is_default ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200")}
            >
              {template.is_default && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-bl-xl">
                  Mặc định {template.type}
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", template.type === 'docx' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600")}>
                       {template.type === 'docx' ? <FileType2 size={24} /> : <Code size={24} />}
                    </div>
                    <div>
                       <h3 className="font-black text-slate-900 text-base">{template.name}</h3>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{template.type === 'docx' ? 'Microsoft Word' : 'HTML Template'}</p>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                 {!template.is_default && (
                   <button onClick={() => handleSetDefault(template)} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Star size={14} /> Mặc định
                   </button>
                 )}
                 <button onClick={() => openModalForEdit(template)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                 </button>
                 <button onClick={() => handleDelete(template.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                 </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Guide Section */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-[24px] p-6 mt-8">
         <h4 className="font-black text-blue-900 mb-2">Hướng dẫn sử dụng Placeholder</h4>
         <p className="text-sm text-blue-800/70 mb-4">Bạn có thể chèn các từ khóa sau vào file Word (DOCX) hoặc HTML để hệ thống tự động điền dữ liệu lúc xuất hóa đơn.</p>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono text-slate-600">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{invoice_number}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{created_at}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{customer_name}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{customer_phone}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{total_amount}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{subtotal}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{discount}}'}</div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">{'{{payment_method}}'}</div>
         </div>
         <p className="text-sm text-blue-800/70 mt-4 font-bold">Vòng lặp danh sách sản phẩm:</p>
         <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs mt-2 overflow-x-auto">
            {`{{#items}}\n  Tên SP: {{name}} | SL: {{quantity}} | Giá: {{price}} | TT: {{total}}\n{{/items}}`}
         </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[5%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-[24px] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <h3 className="font-black text-lg text-slate-800">{editingId ? 'Cập nhật mẫu hóa đơn' : 'Thêm mẫu mới'}</h3>
                <button onClick={closeModal} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                <form id="templateForm" onSubmit={handleSubmit} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tên mẫu *</label>
                       <input 
                         type="text" 
                         value={name}
                         onChange={(e) => setName(e.target.value)}
                         placeholder="VD: Mẫu A4 Bán hàng"
                         className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                         required
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Định dạng *</label>
                       <select 
                         value={type}
                         onChange={(e) => setType(e.target.value as any)}
                         className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                       >
                          <option value="html">HTML (In Web & Xuất PDF)</option>
                          <option value="docx">DOCX (Xuất file Word)</option>
                       </select>
                     </div>
                  </div>

                  {type === 'docx' ? (
                     <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50">
                        <Upload className="w-10 h-10 text-slate-300 mb-4" />
                        <p className="text-sm font-bold text-slate-700 mb-2">Tải lên file Word (.docx)</p>
                        <p className="text-xs text-slate-500 text-center max-w-sm mb-6">File Word cần chứa các placeholder định dạng {'{{key}}'} để hệ thống điền dữ liệu tự động.</p>
                        <label className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                           Chọn file DOCX
                           <input type="file" accept=".docx" className="hidden" onChange={handleFileUpload} />
                        </label>
                        {fileUrl && <p className="text-xs text-emerald-600 mt-4 font-bold flex items-center gap-1"><CheckCircle2 size={14}/> Đã tải lên thành công</p>}
                     </div>
                  ) : (
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Mã HTML Template</label>
                       <textarea 
                         value={htmlContent}
                         onChange={(e) => setHtmlContent(e.target.value)}
                         placeholder="Nhập mã HTML..."
                         className="w-full h-[300px] px-4 py-3 bg-slate-900 border border-slate-200 rounded-xl text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-blue-500 transition-colors custom-scrollbar"
                         required
                       />
                     </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                         <span className="text-sm font-bold text-slate-700 block">Đặt làm mẫu mặc định</span>
                         <span className="text-xs text-slate-500 font-medium">Hệ thống sẽ dùng mẫu này khi nhấn In hoặc Xuất file</span>
                      </div>
                    </label>
                  </div>
                </form>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Huỷ</button>
                <button type="submit" form="templateForm" className="flex-[2] px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                   {editingId ? 'Lưu thay đổi' : 'Thêm mẫu mới'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
