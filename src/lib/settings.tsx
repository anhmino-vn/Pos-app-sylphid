import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface SystemSettings {
  business: {
    name: string;
    logo: string;
    hotline: string;
    email: string;
    website: string;
    address: string;
    taxId: string;
  };
  invoice: {
    paperSize: 'A4' | '80mm' | '58mm';
    showLogo: boolean;
    footerText: string;
    returnPolicy: string;
  };
  payment: {
    allowCash: boolean;
    allowTransfer: boolean;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    defaultTransferContent: string;
  };
  inventory: {
    lowStockThreshold: number;
    autoDeductOnPaid: boolean;
    autoRestockOnCancel: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    primaryColor: string;
  };
}

export const defaultSettings: SystemSettings = {
  business: {
    name: 'SYLPHID',
    logo: '',
    hotline: '0889.719.222',
    email: 'contact@sylphidvietnam.com',
    website: 'sylphidvietnam.com',
    address: '127 Louis II, KĐT Louis, Đại Mỗ, Hà Nội',
    taxId: ''
  },
  invoice: {
    paperSize: 'A4',
    showLogo: true,
    footerText: 'Cảm ơn quý khách đã mua hàng!',
    returnPolicy: 'Đổi trả miễn phí trong 7 ngày'
  },
  payment: {
    allowCash: true,
    allowTransfer: true,
    bankName: 'VIB - Ngân hàng Quốc Tế',
    bankAccountName: 'Le Ngoc Khanh',
    bankAccountNumber: '943771531',
    defaultTransferContent: 'Thanh toan don hang'
  },
  inventory: {
    lowStockThreshold: 10,
    autoDeductOnPaid: true,
    autoRestockOnCancel: true
  },
  ui: {
    theme: 'light',
    primaryColor: 'blue'
  }
};

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({ settings: defaultSettings, loading: true });

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_configs', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Deep merge to ensure no missing keys
        setSettings(prev => ({
           business: { ...prev.business, ...data.business },
           invoice: { ...prev.invoice, ...data.invoice },
           payment: { ...prev.payment, ...data.payment },
           inventory: { ...prev.inventory, ...data.inventory },
           ui: { ...prev.ui, ...data.ui },
        }));
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching settings:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}
