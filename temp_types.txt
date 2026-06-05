import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export async function createStaffAccount(email: string, password: string) {
  const { deleteApp } = await import('firebase/app');
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const secondaryApp = initializeApp(app.options, 'SecondaryApp' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondaryAuth.signOut();
  await deleteApp(secondaryApp);
  return user;
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
