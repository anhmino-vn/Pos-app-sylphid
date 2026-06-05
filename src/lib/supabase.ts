/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Parse the URL and Anon Key from Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase Environment Variables. Application might not work properly.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const db = supabase;
export const storage = supabase.storage;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export async function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const errInfo: SupabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.id,
      email: user?.email,
    },
    operationType,
    path
  };
  
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function createStaffAccount(email: string, password: string) {
  // Using regular signUp. Note: In Supabase, if email confirmations are disabled, this might log the admin out.
  // The proper way in production is using an Edge Function with the service_role key.
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

// Types for the app
export interface Product {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  listPrice: number;
  salePrice: number;
  stock: number;
  description: string;
  images: string[];
  category: string;
  status: 'active' | 'out_of_stock' | 'discontinued';
  createdAt?: any;
  updatedAt?: any;
}

export interface Order {
  id?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: {
    id: string;
    type: 'product' | 'service';
    name: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    image?: string;
    note?: string;
  }[];
  subtotal?: number;
  totalAmount: number;
  referredById?: string;
  referredByName?: string;
  commissionEligible?: boolean;
  commissionPercent?: number;
  commissionAmount?: number;
  commissionStatus?: 'unpaid' | 'paid' | 'cancelled';
  commissionPaidAt?: any;
  discount: number;
  shippingFee: number;
  paymentMethod?: 'cash' | 'transfer' | 'card' | 'debt' | string;
  amountGiven?: number;
  changeGiven?: number;
  status: 'pending' | 'unpaid' | 'paid' | 'cancelled';
  note?: string;
  createdAt?: any;
  createdBy?: string;
  creatorName?: string;
  deletedAt?: any;
  deletedBy?: string;
}

export interface Department {
  id?: string;
  name: string;
  description: string;
  managerId?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface Role {
  id?: string;
  name: string;
  description: string;
  isSystem?: boolean; // System roles cannot be deleted
  permissions: UserPermissions; // using the existing permission structure
  createdAt?: any;
  updatedAt?: any;
}

export interface UserPermissions {
  products: { view: boolean; add: boolean; edit: boolean; delete: boolean };
  orders: { view: boolean; add: boolean; edit: boolean; delete: boolean };
  stock: { view: boolean; import: boolean; export: boolean };
  customers: { view: boolean; edit: boolean };
  reports: { view: boolean };
  services?: { view: boolean; add: boolean; edit: boolean; delete: boolean };
  documents?: { view: boolean; add: boolean; edit: boolean; delete: boolean; print: boolean };
  staff?: { view: boolean; add: boolean; edit: boolean };
  settings?: { view: boolean; edit: boolean };
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  
  // HRM Fields
  employeeCode?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  idCard?: string;
  joinDate?: string;
  position?: string;
  departmentId?: string; // Links to Department
  roleId?: string; // Links to Role (overrides 'role')
  workStatus?: 'working' | 'probation' | 'resigned' | 'on_leave';
  notes?: string;
  
  role: 'admin' | 'staff'; // Legacy/Fallback
  shopName: string;
  status?: 'active' | 'locked';
  permissions?: UserPermissions; // Custom override per user (if differing from Role)
  createdAt?: any;
  updatedAt?: any;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gender?: string;
  birthDate?: string;
  note?: string;
  status?: 'active' | 'inactive';
  totalSpend: number;
  orderCount: number;
  lastPurchaseDate?: any;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  inChargeStaff?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomerTransaction {
  id?: string;
  customerId: string;
  orderId: string;
  totalAmount: number;
  status: string;
  orderDate: any;
  itemsOverview: string;
  createdBy: string;
}

export interface Category {
  id?: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface ServiceCategory {
  id?: string;
  name: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  action: string;
  details: string;
  module: string;
  createdAt?: any;
}

export interface InventoryLog {
  id?: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  referenceId?: string; // ID của phiếu nhập, phiếu xuất hoặc đơn hàng
  createdAt?: any;
  createdBy: string;
}

export interface Service {
  id?: string;
  name: string;
  code: string;
  categoryId: string;
  categoryName: string;
  price: number;
  promoPrice?: number;
  duration: number; // minutes
  description: string;
  images: string[];
  status: 'active' | 'hidden';
  internalNotes?: string;
  tags: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Booking {
  id?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  staffId?: string;
  staffName?: string;
  roomId?: string;
  roomName?: string;
  bookingDate: any; 
  bookingTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  totalAmount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface GuideCategory {
  id?: string;
  name: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Guide {
  id?: string;
  title: string;
  code: string;
  categoryId: string;
  categoryName: string;
  description: string;
  content: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  thumbnailUrl?: string;
  createdBy: string;
  creatorName: string;
  status: 'active' | 'hidden';
  tags: string[];
  views: number;
  downloads: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StockImportItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  importPrice: number;
  total: number;
}

export interface StockImport {
  id?: string;
  code: string;
  supplierId: string;
  supplierName: string;
  items: StockImportItem[];
  totalAmount: number;
  notes: string;
  status: 'completed' | 'cancelled';
  createdBy: string;
  creatorName: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StockExportItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  exportPrice?: number;
}

export interface StockExport {
  id?: string;
  code: string;
  reason: 'order' | 'internal' | 'damage' | 'other';
  orderId?: string;
  items: StockExportItem[];
  notes: string;
  status: 'completed' | 'cancelled';
  createdBy: string;
  creatorName: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Staff {
  id?: string;
  name: string;
  role: string;
  phone?: string;
  status: 'active' | 'inactive';
  services: string[]; 
}

export const handleFirestoreError = handleSupabaseError;
