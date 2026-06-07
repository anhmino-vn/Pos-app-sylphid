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
export interface Brand {
  id?: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface ProductCategory {
  id?: string;
  name: string;
  parentId?: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface Supplier {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  debtBalance?: number;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface PriceRule {
  id?: string;
  name: string;
  type: 'time_based' | 'customer_group' | 'branch' | 'program';
  valueType: 'percentage' | 'fixed' | 'override';
  value: number;
  startTime?: any;
  endTime?: any;
  conditions?: Record<string, any>;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface CommissionRule {
  id?: string;
  type: 'points' | 'product_commission' | 'service_commission' | 'referral' | 'discount_policy';
  name: string;
  description?: string;
  valueType: 'percentage' | 'fixed';
  value: number;
  isGlobal?: boolean;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id?: string;
  name: string;
  shortName?: string;
  categoryId?: string;
  brandId?: string;
  description?: string;
  seoDescription?: string;
  images?: string[];
  videoUrl?: string;
  baseUnit?: string;
  supplierId?: string;
  supplierName?: string;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  tags?: string[];
  note?: string;
  taxRate?: number;
  isCombo?: boolean;
  status: 'active' | 'inactive' | 'discontinued';
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  
  // Legacy fields for backward compatibility (temporarily)
  sku?: string;
  barcode?: string;
  listPrice?: number;
  salePrice?: number;
  stock?: number;
  category?: string;
}

export interface ProductVariant {
  id?: string;
  productId: string;
  sku: string;
  barcode?: string;
  qrCode?: string;
  name: string;
  attributes?: Record<string, string>;
  costPrice?: number;
  listPrice?: number;
  salePrice: number;
  stock: number;
  minStock?: number;
  maxStock?: number;
  imageUrl?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface InventoryTransaction {
  id?: string;
  variantId: string;
  type: 'in' | 'out' | 'adjust';
  quantity: number;
  balanceAfter?: number;
  referenceId?: string;
  referenceType?: string;
  note?: string;
  createdBy?: string;
  createdAt?: any;
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
  pointsEarned?: number;
  pointsUsed?: number;
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
  code?: string;
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
  tier: 'Member' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'bronze' | 'silver' | 'gold' | 'diamond'; // kept lowercases for backwards compatibility
  points?: number;
  usedPoints?: number;
  totalPoints?: number;
  inChargeStaff?: string;
  referredById?: string;
  customerSource?: string;
  customerGroup?: string;
  totalDebt?: number;
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
  categoryId?: string;
  price: number;
  promoPrice?: number;
  duration: number; // minutes
  description?: string;
  images?: string[];
  note?: string;
  tags?: string[];
  status: 'active' | 'inactive' | 'discontinued';
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  
  // Legacy fields
  categoryName?: string;
  internalNotes?: string;
}

export interface ServiceCombo {
  id?: string;
  name: string;
  code: string;
  price: number;
  promoPrice?: number;
  serviceIds?: string[];
  description?: string;
  images?: string[];
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TreatmentCourse {
  id?: string;
  name: string;
  code: string;
  description?: string;
  sessions: number;
  duration?: number;
  serviceIds?: string[];
  price: number;
  promoPrice?: number;
  note?: string;
  images?: string[];
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomerTreatmentCourse {
  id?: string;
  customerId: string;
  courseId: string;
  orderId?: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions?: number;
  startDate?: any;
  endDate?: any;
  status: 'active' | 'completed' | 'cancelled';
  note?: string;
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

export interface LoyaltySettings {
  id?: string;
  earnRate: number; // e.g. 100000 (meaning 100k VND = 1 point)
  earnPoints: number; // e.g. 1 (1 point)
  roundingMethod: 'down' | 'up' | 'decimal';
  redemptionRate: number; // e.g. 1 point = 1000 VND
  expirationMonths: number | null; // null means no expiration
  earnOnProducts: boolean;
  earnOnServices: boolean;
  categoryMultipliers: Record<string, number>; // e.g. { "NMN": 2, "Dịch vụ": 3 }
  tiers: {
    name: 'Member' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
    minSpend: number;
    discountPercent: number;
  }[];
  referralPointsEnabled: boolean;
  referralPointsReward: number; // fixed points per referral
  referralRevenuePercent: number; // or percent of revenue
  updatedAt?: any;
}

export interface LoyaltyLog {
  id?: string;
  customerId: string;
  customerName: string;
  points: number;
  type: 'earn' | 'redeem' | 'refund' | 'expire' | 'referral' | 'manual';
  orderId?: string;
  reason: string;
  createdAt?: any;
  createdBy?: string;
}

export interface DebtPayment {
  id?: string;
  code: string; // e.g. PT-0001
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer' | 'card';
  notes?: string;
  orderIds: string[]; // List of order IDs that were paid in this transaction
  createdBy: string;
  creatorName: string;
  createdAt?: any;
}

export const handleFirestoreError = handleSupabaseError;

// ─── APPOINTMENT MODULE ────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'pending'       // Chờ xác nhận
  | 'confirmed'     // Đã xác nhận
  | 'in_progress'   // Đang thực hiện
  | 'completed'     // Hoàn thành
  | 'no_show'       // Khách không đến
  | 'cancelled'     // Đã hủy
  | 'rescheduled';  // Dời lịch

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending:     'Chờ xác nhận',
  confirmed:   'Đã xác nhận',
  in_progress: 'Đang thực hiện',
  completed:   'Hoàn thành',
  no_show:     'Khách không đến',
  cancelled:   'Đã hủy',
  rescheduled: 'Dời lịch',
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, { bg: string; text: string; border: string }> = {
  pending:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  confirmed:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  in_progress: { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  completed:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  no_show:     { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  cancelled:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  rescheduled: { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200' },
};

export interface Appointment {
  id?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceId?: string;
  serviceName?: string;
  comboId?: string;
  comboName?: string;
  treatmentId?: string;
  treatmentName?: string;
  staffId?: string;
  staffName?: string;
  roomId?: string;
  roomName?: string;
  branchId?: string;
  branchName?: string;
  date: string;           // ISO date: 'YYYY-MM-DD'
  startTime: string;      // 'HH:mm'
  endTime: string;        // 'HH:mm'
  duration?: number;      // minutes
  note?: string;
  status: AppointmentStatus;
  cancelReason?: string;
  checkinAt?: string;
  checkinBy?: string;
  checkoutAt?: string;
  checkoutBy?: string;
  createdBy?: string;
  creatorName?: string;
  createdAt?: any;
  updatedAt?: any;
  deletedAt?: any;
}

export interface AppointmentLog {
  id?: string;
  appointmentId: string;
  action: 'created' | 'updated' | 'cancelled' | 'checkin' | 'checkout' | 'rescheduled' | 'confirmed' | 'completed' | 'no_show';
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedBy?: string;
  changedByName?: string;
  changedAt?: any;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface Staff {
  id?: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  position?: string;
  color?: string;       // hex color for calendar display
  avatarUrl?: string;
  serviceIds?: string[];// Services this staff can perform
  branchId?: string;
  branchName?: string;
  workingHours?: {      // Default working hours per weekday (0=Sun)
    [day: number]: { start: string; end: string; isOff?: boolean };
  };
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface Room {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;       // hex color for calendar display
  capacity?: number;
  floor?: string;
  branchId?: string;
  branchName?: string;
  serviceIds?: string[];// Services this room supports
  status: 'active' | 'inactive' | 'maintenance';
  createdAt?: any;
  updatedAt?: any;
}

// ─── HEALTH & TREATMENT MODULE ───────────────────────────────────────────────

export interface HealthRecord {
  id?: string;
  code?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  // Health metrics
  height?: number;      // cm
  weight?: number;      // kg
  bmi?: number;         // auto-calculated
  bloodPressure?: string; // e.g. "120/80"
  heartRate?: number;   // bpm
  bloodSugar?: number;  // mmol/L
  allergies?: string;
  // Medical history
  conditions?: string[]; // ['diabetes', 'heart', 'hypertension', 'gout', 'cancer', 'other']
  currentMedications?: string;
  treatmentHistory?: string;
  currentCondition?: string;
  // Files
  profileImages?: string[]; // Supabase Storage URLs
  attachments?: { name: string; url: string; type: string }[];
  // Meta
  inChargeStaff?: string;
  inChargeStaffName?: string;
  status?: 'active' | 'inactive' | 'draft';
  note?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TreatmentPlan {
  id?: string;
  code?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  serviceName?: string;
  totalSessions: number;
  completedSessions: number;
  remainingSessions?: number;
  price?: number;
  startDate?: string;
  endDate?: string;
  technicianId?: string;
  technicianName?: string;
  treatmentGoal?: string;
  note?: string;
  sessions?: TreatmentSession[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  healthRecordId?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TreatmentSession {
  sessionNumber: number;
  status: 'pending' | 'completed' | 'skipped';
  date?: string;
  note?: string;
  logId?: string;
}

export interface TherapyLog {
  id?: string;
  treatmentPlanId?: string;
  customerId?: string;
  customerName: string;
  sessionNumber?: number;
  date?: string;
  // Before treatment
  symptomsBefore?: string;
  vitalSignsBefore?: string;
  imagesBefore?: string[]; // Supabase Storage URLs
  // During treatment
  servicesPerformed?: string;
  duration?: number; // minutes
  notesDuring?: string;
  // After treatment
  results?: string;
  evaluation?: string;
  imagesAfter?: string[]; // Supabase Storage URLs
  // Signatures
  customerSignature?: string; // base64 canvas
  staffSignature?: string;    // base64 canvas
  technicianId?: string;
  technicianName?: string;
  status?: 'draft' | 'completed';
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface HealthEvaluation {
  id?: string;
  customerId?: string;
  customerName: string;
  treatmentPlanId?: string;
  treatmentPlanName?: string;
  // Before/After metrics
  weightBefore?: number;
  weightAfter?: number;
  bloodPressureBefore?: string;
  bloodPressureAfter?: string;
  bloodSugarBefore?: number;
  bloodSugarAfter?: number;
  // Images
  imagesBefore?: string[]; // Supabase Storage URLs
  imagesAfter?: string[];
  // Assessment
  improvementRate?: number; // percentage
  professionalAssessment?: string;
  customerRating?: number; // 1-5 stars
  customerFeedback?: string;
  // Meta
  evaluatedBy?: string;
  evaluatedAt?: any;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

