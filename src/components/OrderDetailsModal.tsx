import React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Receipt,
  Building2,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Order } from '../lib/supabase';
import {
  formatCurrency,
  formatDate,
  cn,
  generateExportFileName,
} from "../lib/utils";
import { exportPdf, exportWord, printElement } from "../lib/printUtils";

import { PrintOrderReceipt } from "./printing/PrintOrderReceipt";

interface Props {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailsModal({ order, onClose }: Props) {
  if (!order) return null;

  const isPaid = order.status === "paid";
  const isCancelled = order.status === "cancelled";
  const isDebt = order.paymentMethod === "debt";

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full h-[100dvh] md:h-auto max-w-[800px] bg-white md:rounded-[32px] lg:rounded-[44px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col md:max-h-[90vh]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-8 border-b border-slate-100 bg-slate-50/50 gap-4 sm:gap-0">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <Receipt className="w-5 h-5 text-blue-600 shrink-0" />
                <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase italic tracking-tighter whitespace-nowrap">
                  Nghiệp Vụ Hóa Đơn
                </h2>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Mã HĐ: {order.id?.toUpperCase() || "N/A"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border",
                  isPaid
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : order.status === "unpaid"
                      ? "bg-orange-50 text-orange-600 border-orange-100"
                      : isCancelled
                        ? "bg-rose-50 text-rose-600 border-rose-100"
                        : "bg-amber-50 text-amber-600 border-amber-100",
                )}
              >
                {isPaid ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {isPaid
                  ? "Đã thanh toán"
                  : isCancelled
                    ? "Đã hủy"
                    : order.status === "unpaid"
                      ? "Chưa thanh toán"
                      : "Chờ xử lý"}
              </div>
              {isDebt && (
                <div className="px-4 py-2 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  Công Nợ
                </div>
              )}
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Thông tin khách hàng
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase italic">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Khách hàng
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {order.customerPhone || "---"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Số điện thoại
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Thông tin giao dịch
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {order.createdAt
                          ? formatDate(order.createdAt.toDate())
                          : "N/A"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Thời gian tạo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase italic">
                        {order.paymentMethod === "cash"
                          ? "Tiền mặt"
                          : order.paymentMethod === "transfer"
                            ? "Chuyển khoản"
                            : order.paymentMethod?.replace("_", " ") ||
                              "Chưa chọn"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                        Phương thức TT
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 rounded-[32px] border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 text-center bg-slate-50">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">
                  Chi tiết dịch vụ / Sản phẩm
                </h4>
              </div>
              <div className="p-0 lg:p-6 overflow-x-auto">
                <table className="w-full text-left min-w-full lg:min-w-[700px] hidden lg:table">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4 pt-2 w-16">Hình</th>
                      <th className="pb-4 pt-2">Mặt hàng</th>
                      <th className="pb-4 pt-2 text-right">Giá niêm yết</th>
                      <th className="pb-4 pt-2 text-right">Giá ưu đãi</th>
                      <th className="pb-4 pt-2 text-center w-12">SL</th>
                      <th className="pb-4 pt-2 text-right">Thành tiền</th>
                      <th className="pb-4 pt-2 pl-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-4 pr-4">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-xl border border-slate-100"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <p
                            className="font-bold text-xs text-slate-900 uppercase max-w-[180px] break-words"
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <p className="text-[9px] text-slate-500 uppercase mt-1">
                            {item.type === "product" ? "Sản phẩm" : "Dịch vụ"}
                          </p>
                        </td>
                        <td className="py-4 text-right font-black text-slate-400 line-through text-[10px]">
                          {formatCurrency(item.originalPrice || item.price)}
                        </td>
                        <td className="py-4 text-right font-black text-slate-600 text-xs">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="py-4 text-center font-black text-slate-600 text-xs">
                          {item.quantity}
                        </td>
                        <td className="py-4 text-right font-black text-blue-600 text-sm">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                        <td className="py-4 pl-4 text-left text-[10px] text-slate-500 font-medium italic break-words max-w-[150px]">
                          {item.note || "---"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile View */}
                <div className="lg:hidden flex flex-col divide-y divide-slate-100 px-3 py-1">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="py-3 flex gap-2 sm:gap-3 w-full overflow-hidden items-center"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[10px] overflow-hidden bg-slate-100 border border-slate-200">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-1">
                         <div className="flex justify-between items-center w-full gap-1">
                            <p className="font-bold text-[10px] sm:text-xs text-slate-900 uppercase truncate flex-1 leading-tight">
                              {item.name}
                            </p>
                            <p className="font-black text-blue-600 text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                             {formatCurrency(item.price * item.quantity)}
                            </p>
                         </div>
                         <div className="flex justify-between items-center w-full mt-0.5">
                            <p className="text-[8px] sm:text-[9px] text-slate-500 uppercase">
                              {item.type === "product" ? "Sản phẩm" : "Dịch vụ"}
                            </p>
                            <p className="font-black text-slate-600 text-[8px] sm:text-[9px] whitespace-nowrap shrink-0">
                             {formatCurrency(item.price)} x{item.quantity}
                            </p>
                         </div>
                        {item.note && (
                          <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium italic mt-1 bg-slate-50 p-1.5 rounded-md border border-slate-100 truncate">
                            {item.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                  <span>Tạm tính</span>
                  <span>
                    {formatCurrency(order.subtotal || order.totalAmount)}
                  </span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-rose-500 uppercase">
                    <span>Chiết khấu</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="h-px bg-slate-100 my-1" />
                <div className="flex justify-between items-center sm:hidden">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest shrink-0">
                    Tổng cộng
                  </span>
                  <span className="text-base font-black text-blue-600 italic tracking-tighter pl-2 truncate overflow-hidden">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
                <div className="hidden sm:flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-widest shrink-0">
                    Tổng cộng
                  </span>
                  <span className="text-2xl font-black text-blue-600 italic tracking-tighter truncate pl-2">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between lg:justify-end gap-1.5 md:gap-3 rounded-b-[40px]">
            <button
              onClick={onClose}
              className="flex-1 lg:flex-none px-1 md:px-6 py-2.5 md:py-3 bg-white border border-slate-200 text-slate-900 font-black text-[8px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-[20px] shadow-sm hover:bg-slate-50 transition-colors text-center"
            >
              Đóng
            </button>
            <button
              onClick={() =>
                exportWord(
                  "print-order-receipt",
                  `${generateExportFileName(order)}.docx`,
                )
              }
              className="flex-1 lg:flex-none px-1 md:px-6 py-2.5 md:py-3 bg-blue-50 text-blue-600 font-black text-[8px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-[20px] shadow-sm hover:bg-blue-100 transition-colors text-center"
            >
              Xuất Word
            </button>
            <button
              onClick={() =>
                exportPdf(
                  "print-order-receipt",
                  `${generateExportFileName(order)}.pdf`,
                  "a4",
                )
              }
              className="flex-1 lg:flex-none px-1 md:px-6 py-2.5 md:py-3 bg-rose-50 text-rose-600 font-black text-[8px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-[20px] shadow-sm hover:bg-rose-100 transition-colors text-center"
            >
              Xuất PDF
            </button>
            <button
              onClick={() => printElement("print-order-receipt", "A4")}
              className="flex-[1.5] lg:flex-none px-1 md:px-6 py-2.5 md:py-3 bg-slate-900 text-white font-black text-[8px] md:text-[10px] uppercase tracking-widest rounded-xl md:rounded-[20px] shadow-sm shadow-slate-900/20 hover:bg-slate-800 transition-colors text-center shrink-0"
            >
              In hóa đơn
            </button>
          </div>
        </motion.div>
      </div>

      <PrintOrderReceipt order={order} id="print-order-receipt" hidden={true} />
    </AnimatePresence>,
    document.body
  );
}
