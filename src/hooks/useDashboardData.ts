import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp, doc } from '../lib/firebaseAdapter';
import { db, Order, Product, Booking, handleFirestoreError, OperationType } from '../lib/supabase';
import { DateRange } from '../store/useDateFilterStore';
import { startOfDay } from 'date-fns';
import { parseSafeDate } from '../lib/utils';

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
  topStaff: { name: string, rev: number }[];
  recentActivities: any[];
  treatmentWarningsCount: number;
  allOrders: Order[];
  todayBookings: Booking[];
  todayOrdersCount: number;
  todayRevenue: number;
  todayProfit: number;
  todayNewCustomers: number;
  todayReferrals: number;
  totalUnpaidDebt: number;
  unpaidCustomersCount: number;
  prevRevenue: number;
  prevOrdersCount: number;
  prevProfit: number;
  prevNewCustomers: number;
  prevBookingsCount: number;
  prevReferrals: number;
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
    topStaff: [],
    recentActivities: [],
    treatmentWarningsCount: 0,
    allOrders: [],
    todayBookings: [],
    todayOrdersCount: 0,
    todayRevenue: 0,
    todayProfit: 0,
    todayNewCustomers: 0,
    todayReferrals: 0,
    totalUnpaidDebt: 0,
    unpaidCustomersCount: 0,
    prevRevenue: 0,
    prevOrdersCount: 0,
    prevProfit: 0,
    prevNewCustomers: 0,
    prevBookingsCount: 0,
    prevReferrals: 0
  });

  useEffect(() => {
    let startDate = dateRange.startDate;
    let endDate = dateRange.endDate;

    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 86400000);
    
    const targetStart = startDate || today;
    const targetEnd = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : (startDate ? new Date(new Date(startDate).setHours(23, 59, 59, 999)) : tomorrow);

    const diffTime = targetEnd.getTime() - targetStart.getTime();
    const prevEnd = new Date(targetStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - diffTime);


    let currentProducts: Product[] = [];
    let currentBookings: Booking[] = [];
    let currentOrders: Order[] = [];
    let currentCustomers: any[] = [];
    let currentActivities: any[] = [];
    let currentTreatments: any[] = [];
    let isProductsLoaded = false;
    let isBookingsLoaded = false;
    let isOrdersLoaded = false;
    let isCustomersLoaded = false;
    let isActivitiesLoaded = false;
    let isTreatmentsLoaded = false;
    let currentSettings: any = null;
    let isSettingsLoaded = false;

    const computeStats = () => {
       if (!isProductsLoaded || !isBookingsLoaded || !isOrdersLoaded || !isCustomersLoaded || !isActivitiesLoaded || !isTreatmentsLoaded || !isSettingsLoaded) return;

       // 1. Inventory stats (ignores date filter as requested)
       const lowStockThreshold = currentSettings?.inventory?.lowStockThreshold || 10;
       const inventoryTotal = currentProducts.reduce((acc, p) => acc + (p.stock || 0), 0);
       const lowStockCount = currentProducts.filter(p => p.stock < lowStockThreshold).length;

       // 2. Bookings stats
       const todayB = currentBookings.filter(b => {
          const bDate = parseSafeDate(b.bookingDate);
          return bDate >= targetStart && bDate <= targetEnd;
       });

       const sortedTodayB = todayB.sort((a,b) => {
         const tA = parseSafeDate(a.bookingDate).getTime();
         const tB = parseSafeDate(b.bookingDate).getTime();
         return tA - tB;
       });

       const rangeBookings = currentBookings.filter(b => {
         const bDate = parseSafeDate(b.bookingDate);
         if (!startDate || !endDate) return true;
         return bDate >= startDate && bDate <= endDate;
       });

       // 3. Orders stats
       // Lọc bỏ các đơn hàng đã bị xóa (soft delete)
       const activeOrders = currentOrders.filter(o => (o.status as string) !== 'deleted' && !o.deletedAt && !(o as any).deleted_at);

       const filteredOrders = activeOrders.filter(o => {
           const orderDate = parseSafeDate(o.createdAt);
           if (!orderDate || isNaN(orderDate.getTime())) return false;
           if (!startDate || !endDate) return true;
           return orderDate >= startDate && orderDate <= endDate;
       });

       const totalRevenue = filteredOrders
         .filter(o => o.status === 'paid')
         .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

        const todayOrdersCountRaw = activeOrders.filter(o => {
          const orderDate = parseSafeDate(o.createdAt);
          return orderDate && !isNaN(orderDate.getTime()) && orderDate >= targetStart && orderDate <= targetEnd;
        }).length;

       let generatedChart = [];
       const daysDiff = startDate && endDate ? Math.round((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 7;
       
       if (daysDiff === 0 && startDate) {
           // Single day selected: Group by hour
           const hourlyMap = new Map<string, { revenue: number, profit: number }>();
           filteredOrders.forEach(o => {
               if (o.status !== 'paid' || !o.createdAt) return;
               const d = parseSafeDate(o.createdAt);
               const h = d.getHours().toString().padStart(2, '0') + ':00';
               const existing = hourlyMap.get(h) || { revenue: 0, profit: 0 };
               const orderRev = o.totalAmount || 0;
               const orderProfit = orderRev * 0.6;
               hourlyMap.set(h, { revenue: existing.revenue + orderRev, profit: existing.profit + orderProfit });
           });
           
           for(let i = 0; i <= 23; i += 3) {
               const h = i.toString().padStart(2, '0') + ':00';
               const data = hourlyMap.get(h) || { revenue: 0, profit: 0 };
               generatedChart.push({ name: h, revenue: data.revenue, profit: data.profit });
           }
       } else if (daysDiff <= 31 && startDate) {
           // Chart Data mapping (revenue over period) by day
           const chartMap = new Map<string, { revenue: number, profit: number }>();
           filteredOrders.forEach(o => {
               if (o.status !== 'paid' || !o.createdAt) return;
               const kDate = parseSafeDate(o.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
               const existing = chartMap.get(kDate) || { revenue: 0, profit: 0 };
               const orderRev = o.totalAmount || 0;
               const orderProfit = orderRev * 0.6;
               chartMap.set(kDate, { revenue: existing.revenue + orderRev, profit: existing.profit + orderProfit });
           });

           for(let i=0; i<=daysDiff; i++) {
              let d = new Date(startDate);
              d.setDate(startDate.getDate() + i);
              let label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
              const data = chartMap.get(label) || { revenue: 0, profit: 0 };
              generatedChart.push({ name: label, revenue: data.revenue, profit: data.profit });
           }
       } else {
           // Group by month if large range
           const monthMap = new Map<string, { revenue: number, profit: number }>();
           filteredOrders.forEach(o => {
               if (o.status !== 'paid' || !o.createdAt) return;
               const kDate = parseSafeDate(o.createdAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
               const existing = monthMap.get(kDate) || { revenue: 0, profit: 0 };
               const orderRev = o.totalAmount || 0;
               const orderProfit = orderRev * 0.6;
               monthMap.set(kDate, { revenue: existing.revenue + orderRev, profit: existing.profit + orderProfit });
           });

           generatedChart = Array.from(monthMap.entries()).sort((a,b) => {
               const pa = a[0].split('/').reverse().join('');
               const pb = b[0].split('/').reverse().join('');
               return pa.localeCompare(pb);
           }).map(e => ({ name: e[0], revenue: e[1].revenue, profit: e[1].profit }));
           if (generatedChart.length === 0) generatedChart = [{ name: 'Không có dữ liệu', revenue: 0, profit: 0 }];
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
         const orderDate = parseSafeDate(o.createdAt);
         return orderDate && !isNaN(orderDate.getTime()) && orderDate >= targetStart && orderDate <= targetEnd;
       });
       const todayOrdersCount = todayOrders.length;
       const todayRevenue = todayOrders.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
       const todayProfit = todayRevenue * 0.6; // Tạm tính 60% doanh thu là lợi nhuận
       
       const unpaidOrders = activeOrders.filter(o => o.status === 'unpaid');
       const totalUnpaidDebt = unpaidOrders.reduce((acc, o) => acc + (o.totalAmount || 0) - ((o as any).amountPaid || 0), 0);
       const unpaidCustomersSet = new Set(unpaidOrders.map(o => o.customerId).filter(Boolean));
       
       const todayCustomers = currentCustomers.filter(c => {
         const cDate = parseSafeDate(c.createdAt);
         return cDate && !isNaN(cDate.getTime()) && cDate >= targetStart && cDate <= targetEnd;
       });
       
       const todayNewCustomers = todayCustomers.length;
       const todayReferrals = todayCustomers.filter(c => c.referredById).length;

       // Top Staff logic
       const topStaffData = activeOrders
         .filter(o => o.status === 'paid' && o.creatorName)
         .reduce((acc: any, o) => {
             acc[o.creatorName!] = acc[o.creatorName!] || { name: o.creatorName, rev: 0 };
             acc[o.creatorName!].rev += o.totalAmount || 0;
             return acc;
         }, {});
         
       const sortedTopStaff = Object.values(topStaffData)
         .sort((a: any, b: any) => b.rev - a.rev)
         .slice(0, 5) as { name: string, rev: number }[];

       // Treatment Warnings
       const treatmentWarningsCount = currentTreatments.filter(t => t.status === 'active' && (t.remainingSessions || 0) <= 2).length;

       // Previous stats calculation
       const prevOrders = activeOrders.filter(o => {
         const orderDate = parseSafeDate(o.createdAt);
         return orderDate && !isNaN(orderDate.getTime()) && orderDate >= prevStart && orderDate <= prevEnd;
       });
       const prevOrdersCount = prevOrders.length;
       const prevRevenue = prevOrders.filter(o => o.status === 'paid').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
       const prevProfit = prevRevenue * 0.6;

       const prevCustomersList = currentCustomers.filter(c => {
         const cDate = parseSafeDate(c.createdAt);
         return cDate && !isNaN(cDate.getTime()) && cDate >= prevStart && cDate <= prevEnd;
       });
       const prevNewCustomers = prevCustomersList.length;
       const prevReferrals = prevCustomersList.filter(c => c.referredById).length;

       const prevBookingsCount = currentBookings.filter(b => {
          const bDate = parseSafeDate(b.bookingDate);
          return bDate >= prevStart && bDate <= prevEnd;
       }).length;

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
         topStaff: sortedTopStaff,
         recentActivities: currentActivities.slice(0, 5),
         treatmentWarningsCount,
         allOrders: activeOrders, // Only use active orders for table
         todayBookings: sortedTodayB,
         todayOrdersCount,
         todayRevenue,
         todayProfit,
         todayNewCustomers,
         todayReferrals,
         totalUnpaidDebt,
         unpaidCustomersCount: unpaidCustomersSet.size,
         prevRevenue,
         prevOrdersCount,
         prevProfit,
         prevNewCustomers,
         prevBookingsCount,
         prevReferrals
       });
    };

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      isProductsLoaded = true;
      computeStats();
    }, (error) => {
      isProductsLoaded = true;
      handleFirestoreError(error, OperationType.LIST, 'products');
      computeStats();
    });

    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
       currentBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
       isBookingsLoaded = true;
       computeStats();
    }, (error) => {
       isBookingsLoaded = true;
       handleFirestoreError(error, OperationType.LIST, 'bookings');
       computeStats();
    });

    const unsubscribeOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      currentOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      isOrdersLoaded = true;
      computeStats();
    }, (error) => {
      isOrdersLoaded = true;
      handleFirestoreError(error, OperationType.LIST, 'orders');
      computeStats();
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      currentCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      isCustomersLoaded = true;
      computeStats();
    }, (error) => {
      isCustomersLoaded = true;
      handleFirestoreError(error, OperationType.LIST, 'customers');
      computeStats();
    });

    const unsubscribeActivities = onSnapshot(query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc')), (snapshot) => {
      currentActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      isActivitiesLoaded = true;
      computeStats();
    }, (error) => {
      isActivitiesLoaded = true;
      // Không ném lỗi popup nếu thiếu activity_logs để tránh làm phiền user
      console.warn("Failed to load activity_logs", error);
      computeStats();
    });

    const unsubscribeTreatments = onSnapshot(collection(db, 'customer_treatment_courses'), (snapshot) => {
      currentTreatments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      isTreatmentsLoaded = true;
      computeStats();
    }, (error) => {
      isTreatmentsLoaded = true;
      console.warn("Failed to load treatments", error);
      computeStats();
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'system_configs', 'global'), (docSnap) => {
      currentSettings = docSnap.exists() ? docSnap.data() : null;
      isSettingsLoaded = true;
      computeStats();
    }, (error) => {
      isSettingsLoaded = true;
      console.warn("Failed to load system_configs", error);
      computeStats();
    });

    return () => {
      unsubscribeProducts();
      unsubscribeBookings();
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeActivities();
      unsubscribeTreatments();
      unsubscribeSettings();
    };
  }, [dateRange]);

  return data;
}
