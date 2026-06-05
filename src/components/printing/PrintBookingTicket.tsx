import React from 'react';
import QRCode from 'react-qr-code';
import { Booking } from '../../lib/firebase';
import { formatCurrency, formatDate } from '../../lib/utils';

interface PrintBookingTicketProps {
  booking: Booking;
  paperSize: '58mm' | '80mm' | 'A4';
  id?: string;
}

export function PrintBookingTicket({ booking, paperSize, id = 'print-booking-ticket' }: PrintBookingTicketProps) {
  const isThermal = paperSize === '58mm' || paperSize === '80mm';
  
  return (
    <div id={id} className="hidden">
      <div className={`bg-white text-black ${isThermal ? 'p-2' : 'p-8'} font-sans mx-auto`}>
         <div className="text-center mb-6">
          <h1 className={`${isThermal ? 'text-lg' : 'text-2xl'} font-black uppercase tracking-widest text-[#003B73]`}>SYLPHID</h1>
          <p className={`${isThermal ? 'text-[10px]' : 'text-sm'} font-medium mt-1 uppercase tracking-widest`}>Khoa học dẫn lối – Sức khỏe vươn tầm</p>
          <p className={`${isThermal ? 'text-[10px]' : 'text-sm'} font-medium mt-1`}>127 Louis II, KĐT Louis, Đại Mỗ, Hà Nội</p>
        </div>

        <div className="text-center mb-6 border-b border-transparent border-t-2 border-black border-dashed pt-4">
          <h2 className={`${isThermal ? 'text-xl' : 'text-3xl'} font-black uppercase tracking-tighter mb-2`}>PHIẾU DỊCH VỤ</h2>
          <p className={`${isThermal ? 'text-[10px]' : 'text-sm'} font-bold`}>Mã VP: #{booking.id?.substring(0, 8).toUpperCase()}</p>
        </div>

        <div className={`mb-6 ${isThermal ? 'text-[10px]' : 'text-sm'} space-y-2 border-b border-black border-dashed pb-4`}>
          <div className="flex justify-between">
            <span className="opacity-70">Khách hàng:</span>
            <span className="font-black">{booking.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">SĐT liên hệ:</span>
            <span className="font-black">{booking.customerPhone}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Ngày hẹn:</span>
            <span className="font-black">{booking.bookingDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Giờ hẹn:</span>
            <span className="font-black">{booking.bookingTime}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="opacity-70">Kỹ thuật viên:</span>
            <span className="font-black uppercase">{booking.staffName || 'CSKH Xắp Xếp'}</span>
          </div>
        </div>

        <div className={`mb-6 ${isThermal ? 'text-[10px]' : 'text-sm'} space-y-1 border-b border-black border-dashed pb-4`}>
           <p className="opacity-70">Dịch vụ sử dụng:</p>
           <p className={`${isThermal ? 'text-sm' : 'text-xl'} font-black`}>{booking.serviceName}</p>
           {booking.notes && (
             <p className="mt-2 text-xs italic">Ghi chú: {booking.notes}</p>
           )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 mb-6">
          <QRCode value={`BOOKING:${booking.id}`} size={isThermal ? 80 : 120} level="L" />
          <p className={`${isThermal ? 'text-[8px]' : 'text-[10px]'} uppercase font-bold tracking-widest text-center`}>Quét mã vào phòng dịch vụ</p>
        </div>

        <div className={`text-center space-y-1 ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
          <p className="font-black italic">Chúc quý khách có trải nghiệm tuyệt vời!</p>
        </div>
      </div>
    </div>
  );
}
