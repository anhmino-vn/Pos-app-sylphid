import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  if (isNaN(amount) || amount === null || amount === undefined) {
     return '0 đ';
  }
  return new Intl.NumberFormat('en-US').format(amount) + ' đ';
}

export function parseSafeDate(date: any): Date {
  if (!date) return new Date();
  let d: Date;
  try {
    if (date instanceof Date) {
      d = date;
    } else if (typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date.seconds !== undefined) {
      d = new Date(date.seconds * 1000);
    } else if (typeof date === 'string') {
      d = parseISO(date);
      if (!isValid(d)) d = new Date(date);
    } else {
      d = new Date(date);
    }
    if (!isValid(d) || isNaN(d.getTime())) return new Date();
    return d;
  } catch (e) {
    return new Date();
  }
}

export function formatDate(date: any) {
  if (!date) return '---';
  const d = parseSafeDate(date);
  // parseSafeDate falls back to current date, but we want '---' if it was completely invalid.
  // Actually, if date was passed, parseSafeDate returns a valid Date. We can just format it.
  try {
    return format(d, 'HH:mm dd/MM/yyyy');
  } catch (e) {
    return '---';
  }
}

export function generateExportFileName(order: any, prefix: string = '') {
  if (!order) return `${prefix}_HoaDon`;
  let d: Date = new Date();
  if (order.createdAt) {
      if (order.createdAt instanceof Date) d = order.createdAt;
      else if (typeof order.createdAt.toDate === 'function') d = order.createdAt.toDate();
      else d = new Date(order.createdAt);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  const timeStr = `${hours}h${minutes}_${day}-${month}-${year}`;
  const code = order.id ? `#TX-${order.id.slice(-6).toUpperCase()}` : '';
  const cleanName = (order.customerName || 'KhachHang').replace(/[^a-zA-Z0-9\s-àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, '').trim().replace(/\s+/g, '-');
  return `${timeStr}_${code}_${cleanName}`;
}

export function generateDocCode(prefix: string = 'DOC') {
  const date = new Date();
  const dateStr = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  const randomStr = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${dateStr}${randomStr}`;
}
