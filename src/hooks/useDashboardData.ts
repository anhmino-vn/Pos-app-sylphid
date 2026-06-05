import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp } from '../lib/firebaseAdapter';
import { db, Order, Product, Booking, handleFirestoreError, OperationType } from '../lib/supabase';
import { DateRange } from '../store/useDateFilterStore';
import { startOfDay } from 'date-fns';

export interface DashboardData {
  totalRevenue: number;
  newOrdersCount: number;
  newAppointmentsCount: number;
  inventoryTotal: number;
  lowStockCount: number;
  loading: boolean;
  chartData: any[];
  topProducts: any[];
  topCustomers: any[];
  allOrders: Order[];
  todayBookings: Booking[];
  todayOrdersCount: number;
  todayRevenue: number;
  todayProfit: number;
  todayNewCustomers: number;
  todayReferrals: number;
  totalUnpaidDebt: number;
  unpaidCustomersCount: number;
}

export function useDashboardData(dateRange: DateRange): DashboardData {
  const [data, setData] = useState<DashboardData>({
    totalRevenue: 0,
    newOrdersCount: 0,
    newAppointmentsCount: 0,
    inventoryTotal: 0,
    lowStockCount: 0,
    loading: true,
    chartData: [],
    topProducts: [],
    topCustomers: [],
    allOrders: [],
    todayBookings: [],
    todayOrdersCount: 0,
    todayRevenue: 0,
    todayProfit: 0,
    todayNewCustomers: 0,
    todayReferrals: 0,
    totalUnpaidDebt: 0,
    unpaidCustomersCount: 0
  });

  useEffect(() => {
    let startDate = dateRange.startDate;
    let endDate = dateRange.endDate;

    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 86400000);

    let currentProducts: Product[] = [];
    let currentBookings: Booking[] = [];
    let currentOrders: Order[] = [];
    let currentCustomers: any[] = [];
    let isProductsLoaded = false;
    let isBookingsLoaded = false;
    let isOrdersLoaded = false;
    let isCustomersLoaded = false;

    const computeStats = () => {
       if (!isProductsLoaded || !isBookingsLoaded || !isOrdersLoaded || !isCustomersLoaded) return;

       // 1. Inventory stats (ignores date filter as requested)
       const inventoryTotal = currentProducts.reduce((acc, p) => acc + (p.stock || 0), 0);
       const lowStockCount = currentProducts.filter(p => p.stock < 10).length;

       // 2. Bookings stats
       const todayB = currentBookings.filter(b => {
          const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate);
          return bDate >= today && bDate < tomorrow;
       });

       const sortedTodayB = todayB.sort((a,b) => {
         const tA = a.bookingDate?.toDate ? a.bookingDate.toMillis() : new Date(a.bookingDate).getTime();
         const tB = b.bookingDate?.toDate ? b.bookingDate.toMillis() : new Date(b.bookingDate).getTime();
         return tA - tB;
       });

       const rangeBookings = currentBookings.filter(b => {
         const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate);
         if (!startDate || !endDate) return true;
         return bDate >= startDate && bDate <= endDate;
       });

       // 3. Orders stats
       // Lọc bỏ các đơn hàng đã bị xóa (soft delete)
       const activeOrders = currentOrders.filter(o => (o.status as string) !== 'deleted' && !o.deletedAt && !(o as any).deleted_at);

       const filteredOrders = activeOrders.filter(o => {
           const orderDate = o.createdAt?.toDate();
           if (!orderDate) return false;
           if (!startDate || !endDate) return true;
           return orderDate >= startDate && orderDate <= endDate;
       });

       const totalRevenue = filteredOrders
         .filter(o => o.status === 'paid')
         .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

       const todayOrdersCountRaw = activeOrders.filter(o => {
         const orderDate = o.createdAt?.toDate();
         return orderDate && orderDate >= today && orderDate < tomorrow;
       }).length;

       // Chart Data mapping (revenue over period)
       const chartMap = new Map<string, number>();
       filteredOrders.forEach(o => {
           if (o.status !== 'paid' || !o.createdAt) return;
           const kDate = o.createdAt.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
           chartMap.set(kDate, (chartMap.get(kDate) || 0) + (o.totalAmount || 0));
       });

       let generatedChart = [];
       const daysDiff = startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 7;
       
       if (daysDiff <= 31 && startDate) {
           for(let i=0; i<=daysDiff; i++) {
              let d = new Date(startDate);
              d.setDate(startDate.getDate() + i);
              let label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
              generatedChart.push({ name: label, revenue: chartMap.get(label) || 0 });
           }
       } else {
           generatedChart = Array.from(chartMap.entries()).sort((a,b) => {
               const pa = a[0].split('/').reverse().join('');
               const pb = b[0].split('/').reverse().join('');
               return pa.localeCompare(pb);
           }).map(e => ({ name: e[0], revenue: e[1] }));
           if (generatedChart.length === 0) generatedChart = [{ name: 'Không có dữ liệu', revenue: 0 }];
       }

       // Top Items logic
       const topItems = activeOrders
         .filter(o => o.status === 'paid')
         .flatMap(o => o.items || [])
         .reduce((acc: any, item) => {
           acc[item.id] = acc[item.id] || { name: item.name, sales: 0, salePrice: item.price, type: item.type };
           acc[item.id].sales += item.quantity;
           return acc;
         }, {});
       
       const sortedTop = Object.values(topItems)
         .sort((a: any, b: any) => b.sales - a.sales)
         .slice(0, 4);

       // Top Customers logic
       const topCustomersData = activeOrders
         .filter(o => o.status === 'paid' && o.customerId)
         .reduce((acc: any, o) => {
             acc[o.customerId!] = acc[o.customerId!] || { id: o.customerId, name: o.customerName || 'Khách lẻ', spend: 0, count: 0 };
             acc[o.customerId!].spend += o.totalAmount || 0;
             acc[o.customerId!].count += 1;
             return acc;
         }, {});
         
       const sortedTopCustomers = Object.values(topCustomersData)
         .sort((a: any, b: any) => b.spend - a.spend)
         .slice(0, 5);

       // Advanced Dashboard Stats
       const todayOrders = activeOrders.filter(o => {
         const orderDate = o.createdAt?.toDate();
         return orderDate && orderDate >= today && orderDate < tomorrow;
       });
       const todayOrdersCount = todayOrders.length;
       const todayRevenue = todayOrders.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
       const todayProfit = todayRevenue * 0.6; // Tạm tính 60% doanh thu là lợi nhuận
       
       const unpaidOrders = activeOrders.filter(o => o.status === 'unpaid');
       const totalUnpaidDebt = unpaidOrders.reduce((acc, o) => acc + (o.totalAmount || 0) - ((o as any).amountPaid || 0), 0);
       const unpaidCustomersSet = new Set(unpaidOrders.map(o => o.customerId).filter(Boolean));
       
       const todayCustomers = currentCustomers.filter(c => {
         const cDate = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
         return cDate && cDate >= today && cDate < tomorrow;
       });
       
       const todayNewCustomers = todayCustomers.length;
       const todayReferrals = todayCustomers.filter(c => c.referredById).length;

       setData({
         totalRevenue,
         newOrdersCount: filteredOrders.length,
         newAppointmentsCount: rangeBookings.length,
         inventoryTotal: inventoryTotal,
         lowStockCount: lowStockCount,
         loading: false,
         chartData: generatedChart,
         topProducts: sortedTop,
         topCustomers: sortedTopCustomers,
         allOrders: activeOrders, // Only use active orders for table
         todayBookings: sortedTodayB,
         todayOrdersCount,
         todayRevenue,
         todayProfit,
         todayNewCustomers,
         todayReferrals,
         totalUnpaidDebt,
         unpaidCustomersCount: unpaidCustomersSet.size
       });
    };

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      isProductsLoaded = true;
      computeStats();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
       currentBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
       isBookingsLoaded = true;
       computeStats();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    const unsubscribeOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      currentOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      isOrdersLoaded = true;
      computeStats();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      currentCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      isCustomersLoaded = true;
      computeStats();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    return () => {
      unsubscribeProducts();
      unsubscribeBookings();
      unsubscribeOrders();
      unsubscribeCustomers();
    };
  }, [dateRange]);

  return data;
}
