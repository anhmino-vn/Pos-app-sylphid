import React from 'react';
import QRCode from 'react-qr-code';
import { Order } from '../../lib/firebase';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Sparkles } from 'lucide-react';
import { useSettings } from '../../lib/settings';

interface ReceiptOrder extends Omit<Order, 'items'> {
  creatorName?: string;
  subtotal?: number;
  total?: number;
  items: {
    id: string;
    productId?: string;
    type?: 'product' | 'service';
    name: string;
    quantity: number;
    price: number;
  }[];
}

interface PrintOrderReceiptProps {
  order: ReceiptOrder;
  paperSize?: '58mm' | '80mm' | 'A4';
  id?: string;
  hidden?: boolean;
}

export function PrintOrderReceipt({ order, paperSize, id = 'print-order-receipt', hidden = true }: PrintOrderReceiptProps) {
  const { settings } = useSettings();
  const actualPaperSize = paperSize || settings.invoice.paperSize;
  const isThermal = actualPaperSize === '58mm' || actualPaperSize === '80mm';
  
  // Custom logic for the requested template
  const calculateOriginalPrice = (item: any) => {
     return item.originalPrice || item.price; // If originalPrice is stored, use it. Else fallback to price.
  };

  if (isThermal) {
    return (
      <div id={id} className={hidden ? "hidden" : ""}>
        <div className={`bg-white text-black p-2 font-sans mx-auto text-[10px]`}>
          <div className="text-center mb-4 flex flex-col items-center">
            {settings.business.logo ? (
              <img src={settings.business.logo} alt="SYLPHID Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain', marginBottom: '8px' }} />
            ) : (
              <img 
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
                  <svg viewBox="0 0 950 210" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(10, 10)">
                      <circle cx="85" cy="85" r="85" fill="none" stroke="black" stroke-width="3"/>
                      <circle cx="85" cy="85" r="77" fill="none" stroke="black" stroke-width="2"/>
                      <circle cx="85" cy="85" r="71" fill="black"/>
                      <text x="56" y="98" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="80" fill="white" letter-spacing="-2" text-anchor="middle">S</text>
                      <text x="114" y="132" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="80" fill="white" letter-spacing="-2" text-anchor="middle">H</text>
                    </g>
                    <g transform="translate(210, 150)">
                      <text x="0" y="0" font-family="'Times New Roman', Times, serif" font-weight="900" font-size="140" transform="scale(0.85, 1.4)" fill="black" letter-spacing="2">SYLPHID</text>
                    </g>
                    <text x="0" y="200" font-family="'Times New Roman', Times, serif" font-weight="bold" font-size="34" fill="black" textLength="940" lengthAdjust="spacing">KHOA HỌC DẪN LỐI - SỨC KHỎE VƯƠN TẦM</text>
                  </svg>
                `.trim())}`} 
                alt="SYLPHID" 
                style={{ height: '45px', width: 'auto', display: 'block', marginBottom: '6px' }} 
              />
            )}
            <p className="font-bold text-[10px] uppercase">Trung tâm chăm sóc sức khỏe Nhật Bản</p>
            <div className="mt-1 text-[8px]">
              <p>Địa chỉ: 127 Louis II, KĐT Louis, Đại Mỗ, Hà Nội</p>
              <p>Hotline: 0889.719.222</p>
              <p>Website: sylphidvietnam.com</p>
            </div>
          </div>

          <div className="text-center mb-4 border-b border-dashed border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-1">HÓA ĐƠN</h2>
            <p>Mã: #{order.id?.substring(0, 8).toUpperCase()}</p>
            <p>Ngày lập: {formatDate(order.createdAt)}</p>
          </div>

          <div className="mb-4 space-y-1">
            <p><span className="font-bold">Tên khách hàng:</span> {order.customerName || 'Khách vãng lai'}</p>
            <p><span className="font-bold">SĐT:</span> {order.customerPhone || ''}</p>
          </div>

          <table className="w-full mb-4">
            <thead className="border-b border-dashed border-black">
              <tr>
                <th className="text-left py-1 w-[40%]">Tên SP/DV</th>
                <th className="text-center py-1">SL</th>
                <th className="text-right py-1">T.Tiền</th>
              </tr>
            </thead>
            <tbody className="border-b border-dashed border-black">
              {order.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-1 pr-1 font-bold">
                    [{item.type === 'product' ? 'Sản phẩm' : 'Dịch vụ'}] {item.name}
                  </td>
                  <td className="text-center py-1 align-top">{item.quantity}</td>
                  <td className="text-right py-1 align-top">{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between">
              <span>Khuyến mãi/Chiết khấu:</span>
              <span>- {formatCurrency(order.discount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Hình thức thanh toán:</span>
              <span className="uppercase font-bold">{order.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-black pt-1 mt-1 text-sm font-black uppercase">
              <span>Tổng tiền:</span>
              <span>{formatCurrency(order.totalAmount || order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold uppercase mt-1">
              <span>Đã thanh toán:</span>
              <span>{formatCurrency(order.amountGiven || (order.status === 'paid' ? order.totalAmount : 0))}</span>
            </div>
          </div>

          {order.paymentMethod === 'transfer' && (
             <div className="mb-4 border border-dashed border-black p-2 rounded-xl text-center">
                <p className="font-bold">VIB: 943771531</p>
                <p className="text-[8px] mt-1">Nội dung: {(`TX-${(order.id?.slice(-6).toUpperCase() || '')} - ${(order.customerName || 'KHACH')}`).trim()}</p>
             </div>
          )}

          <div className="flex flex-col items-center justify-center gap-2 mb-4 mt-4 text-center pb-8 border-b border-dashed border-black">
            {order.paymentMethod === 'transfer' && order.id && (
               <img src={`https://img.vietqr.io/image/VIB-943771531-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(`TX-${order.id.slice(-6).toUpperCase()} - ${order.customerName || 'KHACH'}`)}&accountName=LE%20NGOC%20KHANH`} alt="QR Code" className="w-44 h-44 object-contain mix-blend-multiply mx-auto" />
            )}
            <p className="font-bold italic text-black text-[10px] mt-2">Cảm ơn quý khách và hẹn gặp lại!</p>
          </div>
        </div>
      </div>
    );
  }

  // Khởi tạo các biến để tránh lỗi null
  const invoiceData = {
     createdAt: order.createdAt,
     customerName: order.customerName || 'KHÁCH VÃNG LAI',
     customerPhone: order.customerPhone || 'KHÔNG CÓ',
     id: order.id || '',
     totalAmount: order.totalAmount || 0,
     discount: order.discount || 0,
     shippingFee: order.shippingFee || 0,
     amountGiven: order.amountGiven || 0,
     status: order.status || 'pending',
     paymentMethod: order.paymentMethod || 'cash'
  };

  const invoiceTransferContent = `TX-${invoiceData.id.slice(-6).toUpperCase()} - ${invoiceData.customerName}`;
  const hasAnyNote = order.items.some((item: any) => item.note && item.note.trim() !== '');
  const colSpanCount = hasAnyNote ? 7 : 6;

  // A4 Layout - Exactly as requested Template
  return (
    <div id={id} className={hidden ? "hidden" : ""}>
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          size: A4;
          margin: 12mm 12mm 12mm 12mm;
        }
        @import url('https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        
        #${id} * {
          font-family: 'Times New Roman', 'Tinos', serif !important;
        }
        #${id} .page-wrapper {
          width: 100%;
          max-width: 186mm; /* 210mm - 24mm margin */
          box-sizing: border-box;
          margin: 0 auto;
          background: white;
          color: black;
          padding: 0;
          overflow: visible;
        }
        #${id} table.main-table {
          table-layout: fixed;
          width: 100%;
          border-collapse: collapse;
        }
        #${id} table.main-table > thead > tr {
          page-break-inside: avoid;
        }
        #${id} table.main-table > tbody > tr {
          page-break-inside: avoid;
        }
        #${id} .cell-content {
          word-break: break-word;
          overflow-wrap: break-word;
          padding: 4px;
          line-height: 1.2;
        }
        #${id} .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 0;
        }
        #${id} .left-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        #${id} .right-header {
          text-align: left;
          font-size: 14px;
          line-height: 1.3;
        }
        #${id} .info-row {
          display: flex;
          margin-bottom: 4px;
          font-size: 15px;
        }
        #${id} .info-label {
          white-space: nowrap;
          margin-right: 8px;
        }
        #${id} .info-value {
          flex-grow: 1;
          border-bottom: 1px dotted black;
          display: inline-block;
        }
      `}} />
      <div className="page-wrapper" style={{ fontFamily: "'Times New Roman', 'Tinos', serif" }}>
        <table className="main-table w-full text-base border-collapse">
          <thead className="table-header-group border-none">
            {/* Header row 1: The entire invoice top section */}
            <tr>
              <td colSpan={colSpanCount} className="border-none p-0 align-top">
                <table style={{ width: '100%', border: 'none', marginBottom: '16px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', width: '55%', verticalAlign: 'middle', padding: 0, textAlign: 'center' }}>
                        <table style={{ margin: '0 auto', border: 'none', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: 'none', padding: '0 16px 0 0', verticalAlign: 'middle' }}>
                                {settings.business.logo ? (
                                  <img src={settings.business.logo} alt="SYLPHID Logo" width="50" height="50" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                                ) : (
                                  <img 
                                    width="50" height="50"
                                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
                                      <svg viewBox="0 0 180 180" width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                                        <g transform="translate(5, 5)">
                                          <circle cx="85" cy="85" r="85" fill="none" stroke="#005ac3" stroke-width="3"/>
                                          <circle cx="85" cy="85" r="77" fill="none" stroke="#005ac3" stroke-width="2"/>
                                          <circle cx="85" cy="85" r="71" fill="#005ac3"/>
                                          <text x="56" y="98" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="80" fill="white" letter-spacing="-2" text-anchor="middle">S</text>
                                          <text x="114" y="132" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="80" fill="white" letter-spacing="-2" text-anchor="middle">H</text>
                                        </g>
                                      </svg>
                                    `.trim())}`} 
                                    alt="SH Logo" 
                                    style={{ width: '50px', height: '50px', objectFit: 'contain' }} 
                                  />
                                )}
                              </td>
                              <td style={{ border: 'none', padding: '0', verticalAlign: 'middle' }}>
                                <h1 style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '38px', fontWeight: '900', margin: 0, lineHeight: 1, letterSpacing: '1px', color: 'black' }}>
                                  SYLPHID
                                </h1>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '11px', fontWeight: 'bold', margin: '4px 0 2px 0', color: 'black', letterSpacing: '0px', textAlign: 'center' }}>
                          KHOA HỌC DẪN LỐI - SỨC KHỎE VƯƠN TẦM
                        </p>
                        <p style={{ margin: '0', fontSize: '13px', textAlign: 'center' }}>
                          Trung tâm chăm sóc sức khoẻ Nhật Bản
                        </p>
                      </td>
                      <td style={{ border: 'none', width: '45%', verticalAlign: 'middle', padding: '0 0 0 10px', textAlign: 'left', fontSize: '14px', lineHeight: '1.3' }}>
                        <p style={{ margin: '0 0 2px 0', wordBreak: 'break-word' }}>Địa chỉ: 127 Louis II, KĐT Louis, Đại Mỗ, Hà Nội</p>
                        <p style={{ margin: '0 0 2px 0' }}>Hotline: 0889.719.222</p>
                        <p style={{ margin: 0 }}>Website: sylphidvietnam.com</p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ width: '100%', height: '2px', backgroundColor: 'black', marginBottom: '16px' }}></div>

                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: 'black' }}>HÓA ĐƠN</h2>
                </div>

                <table style={{ width: '100%', border: 'none', marginBottom: '12px', borderCollapse: 'collapse', fontSize: '15px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '130px', border: 'none', padding: '4px 0', verticalAlign: 'bottom' }}>Ngày lập:</td>
                      <td style={{ border: 'none', padding: '4px 0', borderBottom: '1px dotted black', verticalAlign: 'bottom' }}>{formatDate(invoiceData.createdAt)}</td>
                    </tr>
                    <tr>
                      <td style={{ width: '130px', border: 'none', padding: '4px 0', verticalAlign: 'bottom' }}>Tên khách hàng:</td>
                      <td style={{ border: 'none', padding: '4px 0', borderBottom: '1px dotted black', verticalAlign: 'bottom', textTransform: 'uppercase' }}>{invoiceData.customerName}</td>
                    </tr>
                    <tr>
                      <td style={{ width: '130px', border: 'none', padding: '4px 0', verticalAlign: 'bottom' }}>SĐT:</td>
                      <td style={{ border: 'none', padding: '4px 0', borderBottom: '1px dotted black', verticalAlign: 'bottom' }}>{invoiceData.customerPhone}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            {/* Header row 2: Table Column Headers */}
            <tr style={{ backgroundColor: 'white', color: 'black' }}>
              <th className="border border-black align-middle text-center font-bold" style={{ width: hasAnyNote ? '10%' : '10%', padding: '4px' }}>Phân loại</th>
              <th className="border border-black align-middle text-center font-bold" style={{ width: hasAnyNote ? '43%' : '50%', padding: '4px' }}>Tên sản phẩm, dịch vụ</th>
              <th className="border border-black align-middle text-center font-bold" style={{ width: hasAnyNote ? '12%' : '12%', padding: '4px' }}>Giá niêm<br/>yết</th>
              <th className="border border-black align-middle text-center font-bold" style={{ width: hasAnyNote ? '12%' : '12%', padding: '4px' }}>Giá ưu đãi</th>
              <th className="border border-black align-middle text-center font-bold" style={{ width: '4%', padding: '4px' }}>SL</th>
              <th className="border border-black align-middle text-center font-bold" style={{ width: hasAnyNote ? '12%' : '12%', padding: '4px' }}>Thành tiền</th>
              {hasAnyNote && <th className="border border-black align-middle text-center font-bold" style={{ width: '7%', padding: '4px' }}>Ghi chú</th>}
            </tr>
          </thead>
          <tbody className="text-center border-b border-black">
            {order.items.map((item: any, index) => {
               const quantity = item?.quantity || 1;
               const originalPrice = calculateOriginalPrice(item);
               const salePrice = item?.price || 0;
               const lineTotal = salePrice * quantity;
               
               return (
                 <tr key={index} className="border-b border-black">
                   <td className="border border-black text-center text-sm cell-content">
                      {item?.type === 'product' ? 'Sản phẩm' : item?.type === 'service' ? 'Dịch vụ' : ''}
                   </td>
                   <td className="border border-black text-left text-sm cell-content font-medium">
                      {item?.name || ''}
                   </td>
                   <td className="border border-black text-center text-sm cell-content">
                      {item?.name ? formatCurrency(originalPrice) : ''}
                   </td>
                   <td className="border border-black text-center text-sm cell-content">
                      {item?.name ? formatCurrency(salePrice) : ''}
                   </td>
                   <td className="border border-black text-center text-sm cell-content">
                      {item?.name ? quantity : ''}
                   </td>
                   <td className="border border-black text-center text-sm cell-content font-bold">
                      {item?.name ? formatCurrency(lineTotal) : ''}
                   </td>
                   {hasAnyNote && (
                     <td className="border border-black text-center text-sm cell-content whitespace-pre-wrap">
                        {item?.name ? (item.note || '') : ''}
                     </td>
                   )}
                 </tr>
               )
            })}
          </tbody>
        </table>

        {/* Footer Summary - outside the table so it only appears at the end */}
        <table style={{ width: '100%', marginTop: '16px', border: '1px solid black', pageBreakInside: 'avoid', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              {/* Left Column: QR Code + Transfer Info */}
              <td style={{ width: '50%', padding: '12px', borderRight: '1px solid black', textAlign: 'center', verticalAlign: 'top' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 2px 0', fontSize: '14px' }}>Thanh toán chuyển khoản</p>
                <p style={{ margin: '0', fontSize: '14px', textTransform: 'uppercase' }}>NGÂN HÀNG: VIB – 943771531</p>
                <p style={{ margin: '0', fontSize: '14px', textTransform: 'uppercase' }}>LÊ NGỌC KHÁNH</p>
                
                <div style={{ marginTop: '2px', fontSize: '14px', textAlign: 'center' }}>
                    <span>Nội dung CK:</span><br/>
                    <span style={{ fontWeight: 'bold' }}>{invoiceTransferContent}</span>
                </div>
                
                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                    <img src={`https://img.vietqr.io/image/VIB-943771531-compact2.png?amount=${invoiceData.totalAmount}&addInfo=${encodeURIComponent(invoiceTransferContent)}&accountName=LE%20NGOC%20KHANH`} alt="QR Code" width="120" height="120" style={{ width: '120px', height: '120px', display: 'block', margin: '0 auto' }} />
                </div>
              </td>
              
              {/* Right Column: Pricing Info */}
              <td style={{ width: '50%', padding: '12px', verticalAlign: 'top' }}>
                <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', border: 'none', padding: '6px 0', fontWeight: 'bold', verticalAlign: 'bottom' }}>Số tiền tạm tính:</td>
                      <td style={{ width: '50%', border: 'none', padding: '6px 0', fontWeight: 'bold', borderBottom: '1px dotted black', textAlign: 'center', verticalAlign: 'bottom' }}>{formatCurrency(order.subtotal || invoiceData.totalAmount + invoiceData.discount)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '6px 0', fontWeight: 'bold', verticalAlign: 'bottom' }}>Chiết khấu/Giảm giá:</td>
                      <td style={{ border: 'none', padding: '6px 0', fontWeight: 'bold', borderBottom: '1px dotted black', textAlign: 'center', verticalAlign: 'bottom' }}>{invoiceData.discount > 0 ? formatCurrency(invoiceData.discount) : '0 đ'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '6px 0', fontWeight: 'bold', verticalAlign: 'bottom' }}>Hình thức thanh toán:</td>
                      <td style={{ border: 'none', padding: '6px 0', borderBottom: '1px dotted black', textAlign: 'center', textTransform: 'uppercase', verticalAlign: 'bottom' }}>{invoiceData.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '16px 0 6px 0', fontWeight: 'bold', verticalAlign: 'bottom' }}>Tổng tiền:</td>
                      <td style={{ border: 'none', padding: '16px 0 6px 0', fontWeight: 'bold', borderBottom: '1px dotted black', textAlign: 'center', verticalAlign: 'bottom' }}>{formatCurrency(invoiceData.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  );
}
