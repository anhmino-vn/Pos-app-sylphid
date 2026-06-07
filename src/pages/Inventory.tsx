import React from 'react';
import { useLocation } from 'react-router-dom';
import { StockPage } from './inventory/StockPage';
import { TransactionsMaster } from './inventory/TransactionsMaster';
import { SuppliersPage } from './inventory/SuppliersPage';

export function Inventory() {
  const location = useLocation();
  const path = location.pathname;

  const isTransactions = path.startsWith('/inventory/transactions');
  const isSuppliers = path.startsWith('/inventory/suppliers');

  return (
    <div className="flex flex-col h-full">
      {isTransactions && <TransactionsMaster />}
      {isSuppliers && <SuppliersPage />}
      {!isTransactions && !isSuppliers && <StockPage />}
    </div>
  );
}
