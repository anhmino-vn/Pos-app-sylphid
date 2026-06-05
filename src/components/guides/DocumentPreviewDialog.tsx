import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, FileEdit, Download, FileBox } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { PrintConfigModal, PrintConfig } from './PrintConfigModal';
import { Guide } from '../../lib/firebase';

interface DocumentPreviewDialogProps {
  guide: Guide | null;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (guide: Guide) => void;
}

export function DocumentPreviewDialog({ guide, isOpen, canEdit, onClose, onEdit, initialPrint = false }: DocumentPreviewDialogProps & { initialPrint?: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
     if (isOpen && initialPrint) {
        setIsPrintModalOpen(true);
     }
  }, [isOpen, initialPrint]);

  // Default page style
  const [pageStyle, setPageStyle] = useState(`
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `);

  const handlePrintAction = useReactToPrint({
    contentRef: contentRef as any,
    documentTitle: guide?.title || 'Document',
    pageStyle: pageStyle,
  });

  const handlePrintConfig = (config: PrintConfig) => {
    let pStyle = '';
    if (config.size === 'A4') {
      pStyle = `@page { size: A4 portrait; margin: 10mm; }`;
    } else if (config.size === 'A5') {
      pStyle = `@page { size: A5 portrait; margin: 10mm; }`;
    } else if (config.size === 'custom') {
      pStyle = `@page { size: ${config.width || 210}mm ${config.height || 297}mm; margin: 10mm; }`;
    }
    
    setPageStyle(`
      ${pStyle}
      @media print {
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `);

    // Wait a brief moment for state to update
    setTimeout(() => {
      handlePrintAction();
    }, 100);
  };

  const handleDownload = () => {
    if (guide?.fileUrl) {
      window.open(guide.fileUrl, '_blank');
    }
  };

  if (!guide) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={onClose} 
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="relative w-full max-w-5xl mx-auto bg-white rounded-3xl h-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white shrink-0">
                <h3 className="font-black text-slate-900 uppercase truncate pr-4">{guide.title}</h3>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button 
                      onClick={() => { onClose(); onEdit(guide); }} 
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      title="Chỉnh sửa"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsPrintModalOpen(true)} 
                    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                    title="In tài liệu"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {guide.fileUrl && (
                    <button 
                      onClick={handleDownload} 
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      title="Tải xuống"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-px h-6 bg-slate-100 mx-2"></div>
                  <button 
                    onClick={onClose} 
                    className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col items-center justify-center relative">
                <div ref={contentRef} className="w-full h-full max-w-4xl mx-auto flex flex-col items-center justify-center">
                  {guide.fileUrl ? (
                    guide.fileType?.includes('pdf') || guide.fileName?.toLowerCase().endsWith('.pdf') ? (
                      <iframe 
                        src={`${guide.fileUrl}#view=FitH`} 
                        className="w-full h-[70vh] rounded-xl border border-slate-200 shadow-sm bg-white" 
                        title="PDF Preview" 
                      />
                    ) : guide.fileType?.includes('video') ? (
                      <video src={guide.fileUrl} controls className="max-w-full max-h-[70vh] rounded-2xl shadow-xl bg-black" />
                    ) : guide.fileType?.includes('image') || guide.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                      <img 
                        src={guide.fileUrl} 
                        className="max-w-full h-auto max-h-[70vh] object-contain rounded-xl shadow-sm" 
                        alt={guide.title} 
                      />
                    ) : (
                      <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-slate-100">
                        <FileBox className="w-20 h-20 text-slate-200 mx-auto mb-6" />
                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg mb-2">Định dạng không hỗ trợ xem trực tiếp</h4>
                        <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Tệp này có thể yêu cầu khả năng tải về. Hãy sử dụng tính năng tải xuống để xem nội dung.</p>
                        <button 
                          onClick={handleDownload} 
                          className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all inline-flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          <Download className="w-4 h-4" /> Tải Xuống File
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 w-full min-h-[50vh] text-left">
                      <h2 className="text-2xl font-black text-slate-900 mb-6">{guide.title}</h2>
                      <div className="prose prose-slate max-w-none font-medium whitespace-pre-wrap">{guide.content || 'Không có mô tả chi tiết'}</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nested Print Modal */}
      <PrintConfigModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        onConfirm={handlePrintConfig} 
      />
    </>
  );
}
