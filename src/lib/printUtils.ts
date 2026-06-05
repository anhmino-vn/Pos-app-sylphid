import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import html2pdf from 'html2pdf.js';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export function printElement(elementId: string, paperSize: string = 'A4') {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    console.error(`Element with id ${elementId} not found`);
    alert(`Không tìm thấy giao diện in (ID: ${elementId})`);
    return;
  }

  // Cải thiện in ấn trong iframe/browser:
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const cloneEl = originalEl.cloneNode(true) as HTMLElement;
  cloneEl.classList.remove('hidden');
  cloneEl.style.display = 'block';

  let sizeCss = 'auto';
  if (paperSize === '58mm') {
    sizeCss = '58mm auto';
    cloneEl.style.width = '100%';
  } else if (paperSize === '80mm') {
    sizeCss = '80mm auto';
    cloneEl.style.width = '100%';
  } else if (paperSize === 'A5') {
    sizeCss = '148mm 210mm';
    cloneEl.style.width = '100%';
  } else if (paperSize === 'A4') {
    sizeCss = '210mm 297mm';
    cloneEl.style.width = '100%';
  } else {
    // Custom format e.g. "100mm 150mm"
    sizeCss = paperSize;
    const parts = paperSize.split(' ');
    if (parts.length >= 1) cloneEl.style.width = '100%';
  }
  
  cloneEl.style.margin = '0 auto';
  cloneEl.style.boxSizing = 'border-box';

  doc.open();
  doc.write('<html><head><title>Print</title>');
  
  // Clone current head styles (including tailwind CSS classes)
  document.querySelectorAll('style, link[rel="stylesheet"], style').forEach(node => {
    doc.write(node.outerHTML);
  });
  
  doc.write(`
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman:wght@400;700&display=swap');
      * {
         font-family: 'Times New Roman', serif !important;
      }
      @media print {
        @page { 
          margin: 0; 
          size: ${sizeCss}; 
        }
        body { 
          margin: 0; 
          padding: ${paperSize === 'A4' ? '15mm 12mm' : (paperSize === 'A5' ? '10mm 8mm' : '0')};
          background: white;
          color: black;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr, td, th { page-break-inside: avoid; }
        .page-break { page-break-before: always; }
        .no-break { page-break-inside: avoid; }
      }
      .no-print { display: none !important; }
      body {
         font-family: 'Times New Roman', serif;
         background: white;
      }
    </style>
  `);
  doc.write('</head><body>');
  doc.write(cloneEl.outerHTML);
  doc.write('</body></html>');
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 1000); // 1s for styles/fonts to load
}

export async function exportPdf(elementId: string, filename: string = 'document.pdf', format: string = 'a4') {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    alert(`Không tìm thấy giao diện xuất (ID: ${elementId})`);
    return;
  }

  // Create an iframe to sandbox the rendering and modify CSS safely
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
     return;
  }
  iframeDoc.open();
  iframeDoc.write('<html><head></head><body></body></html>');
  iframeDoc.close();

  const styleWrapper = iframeDoc.createElement('div');
  styleWrapper.style.fontFamily = "'Times New Roman', serif";
  // Enforce A4/A5 width proportional to 96dpi inner width to prevent arbitrary stretching or cutoffs
  const isA5Format = format.toLowerCase() === 'a5';
  styleWrapper.style.width = isA5Format ? '128mm' : '186mm'; // 148-20 or 210-24
  styleWrapper.style.margin = '0';
  styleWrapper.style.padding = '0';
  
  // Clone the element into the iframe
  const cloneEl = originalEl.cloneNode(true) as HTMLElement;
  cloneEl.classList.remove('hidden');
  cloneEl.style.display = 'block';
  styleWrapper.appendChild(cloneEl);
  iframeDoc.body.appendChild(styleWrapper);

  // Fetch all styles, replace oklch with rgb fallback, and inject into iframe
  const stylePromises = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(async (node) => {
    try {
      let cssText = '';
      if (node.tagName === 'STYLE') {
        cssText = node.innerHTML;
      } else if (node.tagName === 'LINK') {
        const href = (node as HTMLLinkElement).href;
        if (href) {
          const res = await fetch(href);
          cssText = await res.text();
        }
      }
      
      // html2canvas fails on oklch(), fallback to rgb(0,0,0) or gray to prevent crash
      // Tailwind v4 uses oklch heavily.
      // E.g. oklch(0.9 0.1 250) -> rgb(128,128,128)
      if (cssText) {
        const sanitizedCss = cssText.replace(/oklch\([^)]+\)/g, 'rgb(128, 128, 128)');
        const newStyle = iframeDoc.createElement('style');
        newStyle.innerHTML = sanitizedCss;
        iframeDoc.head.appendChild(newStyle);
      }
    } catch (e) {
      console.warn('Could not process style node', e);
    }
  });

  await Promise.all(stylePromises);

  // Add custom print styles for Times New Roman and pagination
  const customStyle = iframeDoc.createElement('style');
  customStyle.innerHTML = `
    * { font-family: 'Times New Roman', serif !important; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, td, th { page-break-inside: avoid; }
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
    body { background: white; color: black; }
  `;
  iframeDoc.head.appendChild(customStyle);

  try {
    const isA5 = format.toLowerCase() === 'a5';
    // Top, Left, Bottom, Right? Wait. html2pdf margin array is [Top, Right, Bottom, Left] standard, or [V, H] or single number. 
    // Actually it is [top, left, bottom, right] according to jspdf/html2pdf options.
    const margin: [number, number, number, number] = isA5 ? [10, 8, 10, 8] : [12, 12, 12, 12];
    
    const opt = {
      margin: margin,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 1.0 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false
      },
      jsPDF: { unit: 'mm', format: format.toLowerCase(), orientation: 'portrait' as const },
      pagebreak: { mode: 'css', avoid: ['.no-break', 'tr'] }
    };
    
    // Pass the styleWrapper which is now inside the sandbox iframe
    await html2pdf().set(opt).from(styleWrapper).save();
    
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.');
  } finally {
    document.body.removeChild(iframe);
  }
}

export function exportWord(elementId: string, filename: string = 'document.docx') {
  const originalEl = document.getElementById(elementId);
  if (!originalEl) {
    alert(`Không tìm thấy giao diện xuất (ID: ${elementId})`);
    return;
  }

  const cloneEl = originalEl.cloneNode(true) as HTMLElement;
  cloneEl.classList.remove('hidden');
  cloneEl.style.display = 'block';

  // Use application/msword format strategy for .doc (which opens perfectly in Word)
  const header = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Export</title>
  <style>
    @page { margin: 1.2cm; }
    body, * { font-family: 'Times New Roman', serif !important; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid black; padding: 4px; text-align: left; word-wrap: break-word; }
    .no-border, .border-none { border: none !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .page-break { page-break-after: always; }
  </style>
</head><body>`;
  const footer = "</body></html>";
  const sourceHTML = header + cloneEl.innerHTML + footer;
  
  const blob = new Blob(['\ufeff', sourceHTML], {
     type: 'application/msword;charset=utf-8'
  });
  saveAs(blob, filename.replace('.docx', '.doc'));
}

export async function exportExcelBulk(orders: any[]) {
   const workbook = new ExcelJS.Workbook();
   
   // Create the "Tổng Hợp" (Summary) sheet
   const summarySheet = workbook.addWorksheet('Tổng Hợp');
   summarySheet.columns = [
      { header: 'Khách hàng', key: 'customerName', width: 25 },
      { header: 'Số điện thoại', key: 'customerPhone', width: 15 },
      { header: 'Dịch vụ sử dụng', key: 'services', width: 35 },
      { header: 'Sản phẩm bán ra', key: 'products', width: 35 },
      { header: 'Số lượng', key: 'qty', width: 10 },
      { header: 'Giá niêm yết', key: 'originalPrice', width: 15 },
      { header: 'Giá ưu đãi', key: 'salePrice', width: 15 },
      { header: 'Chiết khấu', key: 'discount', width: 15 },
      { header: 'Thành tiền', key: 'lineTotal', width: 15 },
      { header: 'Tổng tiền', key: 'grandTotal', width: 20 },
   ];

   let totalCustomers = 0;
   let totalServices = 0;
   let totalProducts = 0;
   let totalRevenue = 0;

   orders.forEach((order) => {
      totalCustomers++;
      totalRevenue += order.totalAmount || 0;
      
      const items = order.items || [];
      
      items.forEach((item: any, idx: number) => {
         const isFirstRow = idx === 0;
         const isService = item.type === 'service';
         const isProduct = item.type === 'product';
         
         const qty = item.quantity || 1;
         if (isService) totalServices += qty;
         if (isProduct) totalProducts += qty;
         
         const originalPrice = item.originalPrice || item.price || 0;
         const salePrice = item.price || 0;
         const lineTotal = qty * salePrice;
         
         summarySheet.addRow({
            customerName: isFirstRow ? order.customerName : '',
            customerPhone: isFirstRow ? order.customerPhone : '',
            services: isService ? item.name : '',
            products: isProduct ? item.name : '',
            qty: qty,
            originalPrice: originalPrice,
            salePrice: salePrice,
            discount: isFirstRow ? (order.discount || '') : '',
            lineTotal: lineTotal,
            grandTotal: isFirstRow ? order.totalAmount : ''
         });
      });
      
      // If order has no items, still show customer
      if (items.length === 0) {
         summarySheet.addRow({
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            services: '',
            products: '',
            qty: '',
            originalPrice: '',
            salePrice: '',
            discount: order.discount || '',
            lineTotal: '',
            grandTotal: order.totalAmount || 0
         });
      }
   });

   // Add TOTAL row
   summarySheet.addRow([]); // Empty row for spacing
   const totalRow = summarySheet.addRow({
      customerName: `TỔNG CỘNG (${totalCustomers} Khách)`,
      customerPhone: '',
      services: `Tổng DV: ${totalServices}`,
      products: `Tổng SP: ${totalProducts}`,
      qty: totalServices + totalProducts,
      originalPrice: '',
      salePrice: '',
      discount: '',
      lineTotal: '',
      grandTotal: totalRevenue
   });
   
   totalRow.font = { name: 'Times New Roman', size: 12, bold: true };

   // Format numbers
   summarySheet.eachRow((r, rowNumber) => {
       r.font = r.font || { name: 'Times New Roman', size: 12 };
       [6, 7, 8, 9, 10].forEach(colIndex => { // columns with prices
          const cell = r.getCell(colIndex);
          if (typeof cell.value === 'number') {
             cell.numFmt = '#,##0.00';
          }
       });
   });

   // Keep the individual sheets as well for detailed view
   for (let i = 0; i < orders.length; i++) {
       const order = orders[i];
       const sheet = workbook.addWorksheet(`HĐ_${order.id?.slice(-6) || i}`);
       
       sheet.columns = [
          { header: 'Tên KH', key: 'name', width: 20 },
          { header: 'SĐT', key: 'phone', width: 15 },
          { header: 'Sản phẩm/Dịch vụ', key: 'items', width: 40 },
          { header: 'SL', key: 'qty', width: 10 },
          { header: 'Giá Ưu Đãi', key: 'price', width: 15 },
          { header: 'Thành Tiền', key: 'total', width: 15 },
          { header: 'Tạm Tính', key: 'subtotal', width: 15 },
          { header: 'Giảm Giá', key: 'discount', width: 15 },
          { header: 'Tổng Tiền', key: 'grand', width: 15 },
       ];
       
       order.items.forEach((item: any, idx: number) => {
          sheet.addRow({
             name: idx === 0 ? order.customerName : '',
             phone: idx === 0 ? order.customerPhone : '',
             items: item.name,
             qty: item.quantity,
             price: item.price,
             total: item.price * item.quantity,
             subtotal: idx === 0 ? order.subtotal || order.totalAmount : '',
             discount: idx === 0 ? order.discount : '',
             grand: idx === 0 ? order.totalAmount : ''
          });
       });

       sheet.eachRow(r => {
           r.font = { name: 'Times New Roman', size: 12 };
           [5, 6, 7, 8, 9].forEach(colIndex => {
              const cell = r.getCell(colIndex);
              if (typeof cell.value === 'number') {
                 cell.numFmt = '#,##0.00';
              }
           });
       });
   }
   
   const buffer = await workbook.xlsx.writeBuffer();
   const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
   saveAs(blob, `DanhSachHoaDon.xlsx`);
}



