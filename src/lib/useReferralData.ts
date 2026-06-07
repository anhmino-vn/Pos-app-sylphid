import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, doc, getDoc } from '../lib/firebaseAdapter';
import { db, Customer, Order } from './supabase';

export interface ReferralSettings {
  commissionMethod: "PER_ORDER" | "TOTAL_REVENUE";
  commissionPercent: number;
}

export interface ReferrerData {
  customer: Customer;
  referredCustomers: Customer[];
  totalReferralRevenue: number;
  totalReferralOrders: number;
  totalCommission: number;
  paidCommission: number;
  unpaidCommission: number;
}

export function useReferralData(dateRange?: { startDate: Date | null, endDate: Date | null }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ReferralSettings>({
    commissionMethod: "PER_ORDER",
    commissionPercent: 5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let refs = 3;
    console.log("useReferralData init, waiting for 3 collections");
    
    const unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
      console.log("customers loaded", snap.docs.length);
      setCustomers(
        snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Customer)
          .filter(
            (c) =>
              !(c as any).deletedAt &&
              !(c as any).deleted_at &&
              c.status !== "inactive",
          ),
      );
      refs--;
      console.log("refs remaining (customers):", refs);
      if (refs <= 0) setLoading(false);
    }, (err) => {
      console.error("Error loading customers:", err);
      refs--;
      if (refs <= 0) setLoading(false);
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      console.log("orders loaded", snap.docs.length);
      setOrders(
        snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Order)
          .filter((o) => !o.deletedAt && o.status === "paid"),
      ); // Only paid orders count
      refs--;
      console.log("refs remaining (orders):", refs);
      if (refs <= 0) setLoading(false);
    }, (err) => {
      console.error("Error loading orders:", err);
      refs--;
      if (refs <= 0) setLoading(false);
    });

    const unsubSettings = onSnapshot(
      doc(db, "system_configs", "global"),
      (snap) => {
        console.log("settings loaded. exists?", snap.exists());
        if (snap.exists() && snap.data()?.referral) {
          setSettings(snap.data().referral);
        }
        refs--;
        console.log("refs remaining (settings):", refs);
        if (refs <= 0) setLoading(false);
      },
      (err) => {
        console.error("Error loading settings:", err);
        refs--;
        if (refs <= 0) setLoading(false);
      }
    );

    return () => {
      unsubCustomers();
      unsubOrders();
      unsubSettings();
    };
  }, []);

  const data = useMemo(() => {
    // Map to quickly find customers
    const customerMap = new Map<string, Customer>();
    customers.forEach((c) => customerMap.set(c.id!, c));

    // Calculate spend per customer
    const spendPerCustomer = new Map<string, number>();
    const ordersPerCustomer = new Map<string, number>();
    orders.forEach((o) => {
      if (dateRange?.startDate && dateRange?.endDate) {
         const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
         if (od < dateRange.startDate || od > dateRange.endDate) return;
      }
      if (!o.customerId) return;
      spendPerCustomer.set(
        o.customerId,
        (spendPerCustomer.get(o.customerId) || 0) + (o.totalAmount || 0),
      );
      ordersPerCustomer.set(
        o.customerId,
        (ordersPerCustomer.get(o.customerId) || 0) + 1,
      );
    });

    // We need to find who referred who
    const referrersMap = new Map<string, ReferrerData>();

    // Init map for everyone who referred someone
    customers.forEach((c) => {
      if (c.referredById && customerMap.has(c.referredById)) {
        if (!referrersMap.has(c.referredById)) {
          referrersMap.set(c.referredById, {
            customer: customerMap.get(c.referredById)!,
            referredCustomers: [],
            totalReferralRevenue: 0,
            totalReferralOrders: 0,
            totalCommission: 0,
            paidCommission: 0,
            unpaidCommission: 0,
          });
        }
        referrersMap.get(c.referredById)!.referredCustomers.push(c);
      }
    });

    // Calculate revenue and commission
    referrersMap.forEach((data, referrerId) => {
      let totalRev = 0;
      let totalOrders = 0;
      let totalComm = 0;
      let paidComm = 0;
      let unpaidComm = 0;

      // Find all orders from customers referred by this referrer, or explicitly marked
      let referredOrders = orders.filter((o) => 
        o.referredById === referrerId || 
        (o.customerId && data.referredCustomers.find(c => c.id === o.customerId))
      );
      
      if (dateRange?.startDate && dateRange?.endDate) {
         referredOrders = referredOrders.filter(o => {
            const od = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
            return od >= dateRange.startDate! && od <= dateRange.endDate!;
         });
      }
      
      referredOrders.forEach((o) => {
        totalRev += o.totalAmount || 0;
        totalOrders += 1;
        
        // Sum commission if it's eligible and computed on order
        if (o.commissionEligible !== false) {
           const commAmount = o.commissionAmount || 0;
           totalComm += commAmount;
           if (o.commissionStatus === 'paid') {
              paidComm += commAmount;
           } else {
              unpaidComm += commAmount;
           }
        }
      });

      data.totalReferralRevenue = totalRev;
      data.totalReferralOrders = totalOrders;
      
      // If the setting is TOTAL_REVENUE we might just recalculate on the spot for display,
      // but the prompt says they "Lưu cấu hình" and "Đồng bộ", implying values are on the orders.
      // But if Method = TOTAL_REVENUE, then total commission = totalRev * (percent/100).
      if (settings.commissionMethod === "TOTAL_REVENUE") {
         data.totalCommission = totalRev * (settings.commissionPercent / 100);
         data.paidCommission = paidComm;
         data.unpaidCommission = Math.max(0, data.totalCommission - paidComm);
      } else {
         data.totalCommission = totalComm;
         data.paidCommission = paidComm;
         data.unpaidCommission = unpaidComm;
      }
    });

    return {
      allCustomers: customers,
      allOrders: orders,
      customerMap,
      spendPerCustomer,
      ordersPerCustomer,
      referrersMap,
      settings,
    };
  }, [customers, orders, settings, dateRange]);

  return { ...data, loading };
}
