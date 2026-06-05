import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { ConfirmModal } from "../components/ConfirmModal";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  db,
  Service,
  ServiceCategory,
  handleFirestoreError,
  OperationType,
  storage,
} from "../lib/firebase";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Clock,
  Tag,
  Eye,
  EyeOff,
  List,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { formatCurrency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../App";

export function Services() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Category Form State
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    type: "service" | "category" | null;
    isBulk?: boolean;
  }>({ isOpen: false, id: "", type: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Service Form State
  const [formData, setFormData] = useState<Partial<Service>>({
    name: "",
    code: "",
    categoryId: "",
    categoryName: "",
    price: 0,
    promoPrice: 0,
    duration: 60,
    description: "",
    status: "active",
    images: [],
    tags: [],
    internalNotes: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const canAdd =
    profile?.role === "admin" || profile?.permissions?.products?.add;
  const canEdit =
    profile?.role === "admin" || profile?.permissions?.products?.edit;
  const canDelete =
    profile?.role === "admin" || profile?.permissions?.products?.delete;

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setFormData((prev) => ({
            ...prev,
            images: [...(prev.images || []), compressedDataUrl],
          }));
          setUploading(false);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setUploading(false);
    }
  };

  useEffect(() => {
    const qServices = query(
      collection(db, "services"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeServices = onSnapshot(
      qServices,
      (snapshot) => {
        setServices(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Service,
          ),
        );
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "services");
      },
    );

    const qCats = query(
      collection(db, "serviceCategories"),
      orderBy("name", "asc"),
    );
    const unsubscribeCats = onSnapshot(
      qCats,
      (snapshot) => {
        setCategories(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as ServiceCategory,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "serviceCategories");
      },
    );

    return () => {
      unsubscribeServices();
      unsubscribeCats();
    };
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) return;
    setCategoryLoading(true);
    try {
      if (editingCategoryId) {
        await updateDoc(doc(db, "serviceCategories", editingCategoryId), {
          name: categoryName,
          description: categoryDesc,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "serviceCategories"), {
          name: categoryName,
          description: categoryDesc,
          createdAt: serverTimestamp(),
        });
      }
      setCategoryName("");
      setCategoryDesc("");
      setEditingCategoryId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "serviceCategories");
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: "category" });
  };

  const executeDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, "serviceCategories", id));
      toast.success("Đã xóa danh mục thành công!");
    } catch {
      toast.error("Lỗi khi xóa!");
    }
  };

  const generateCode = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.categoryName
      ? formData.categoryName.slice(0, 3).toUpperCase()
      : "SRV";
    setFormData((prev) => ({ ...prev, code: `${prefix}-${random}` }));
  };

  const addImage = () => {
    if (!imageUrl) return;
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), imageUrl],
    }));
    setImageUrl("");
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags?.includes(tagInput.trim())) {
        setFormData((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), tagInput.trim()],
        }));
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd && !editingId) return;
    setLoading(true);
    try {
      const selectedCat = categories.find((c) => c.id === formData.categoryId);
      const data = {
        ...formData,
        categoryName: selectedCat?.name || "",
      };

      if (editingId) {
        await updateDoc(doc(db, "services", editingId), {
          ...data,
          updatedAt: serverTimestamp(),
        });

        // Sync bookings
        const bSnap = await getDocs(
          query(
            collection(db, "bookings"),
            where("serviceId", "==", editingId),
          ),
        );
        for (const docSnap of bSnap.docs) {
          await updateDoc(doc(db, "bookings", docSnap.id), {
            serviceName: formData.name,
          });
        }

        // Sync orders
        const oSnap = await getDocs(query(collection(db, "orders")));
        for (const o of oSnap.docs) {
          const oData = o.data();
          if (oData.items && oData.items.length > 0) {
            let updated = false;
            const newItems = oData.items.map((it: any) => {
              if (it.id === editingId && it.type === "service") {
                updated = true;
                return { ...it, name: formData.name };
              }
              return it;
            });
            if (updated) {
              await updateDoc(doc(db, "orders", o.id), { items: newItems });
            }
          }
        }
      } else {
        await addDoc(collection(db, "services"), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "services");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      categoryId: "",
      categoryName: "",
      price: 0,
      promoPrice: 0,
      duration: 60,
      description: "",
      status: "active",
      images: [],
      tags: [],
      internalNotes: "",
    });
    setEditingId(null);
  };

  const handleEdit = (srv: Service) => {
    setFormData({ ...srv });
    setEditingId(srv.id!);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: "service" });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ isOpen: true, id: "", type: "service", isBulk: true });
  };

  const executeDeleteService = async (id: string) => {
    if (deleteConfirm.isBulk) {
      if (selectedIds.length === 0) return;
      try {
        let deleted = 0;
        let deactivated = 0;

        const orderSnap = await getDocs(query(collection(db, "orders")));
        const orders = orderSnap.docs.map((d) => d.data());

        const bookingsSnap = await getDocs(query(collection(db, "bookings")));
        const bookings = bookingsSnap.docs.map((d) => d.data());

        for (const selectedId of selectedIds) {
          let hasTransaction = bookings.some((b) => b.serviceId === selectedId);

          if (!hasTransaction) {
            for (const o of orders) {
              if (
                o.items &&
                o.items.some(
                  (i: any) => i.id === selectedId && i.type === "service",
                )
              ) {
                hasTransaction = true;
                break;
              }
            }
          }

          if (hasTransaction) {
            await updateDoc(doc(db, "services", selectedId), {
              status: "inactive",
              updatedAt: serverTimestamp(),
            });
            deactivated++;
          } else {
            await deleteDoc(doc(db, "services", selectedId));
            deleted++;
          }
        }
        toast.success(`Đã xóa ${deleted} và ẩn ${deactivated} dịch vụ`);
        setSelectedIds([]);
      } catch (error) {
        toast.error("Lỗi khi xóa nhiều!");
      }
      return;
    }

    try {
      const bookingsSnap = await getDocs(
        query(collection(db, "bookings"), where("serviceId", "==", id)),
      );
      let hasTransaction = !bookingsSnap.empty;

      if (!hasTransaction) {
        const orderSnap = await getDocs(query(collection(db, "orders")));
        for (const o of orderSnap.docs) {
          const oData = o.data();
          if (
            oData.items &&
            oData.items.some((i: any) => i.id === id && i.type === "service")
          ) {
            hasTransaction = true;
            break;
          }
        }
      }

      if (hasTransaction) {
        await updateDoc(doc(db, "services", id), {
          status: "inactive",
          updatedAt: serverTimestamp(),
        });
        toast.success(
          "Dịch vụ đã có lịch hẹn/hóa đơn. Đã chuyển trạng thái sang ngưng hoạt động.",
        );
      } else {
        await deleteDoc(doc(db, "services", id));
        toast.success("Đã xóa thành công!");
      }
    } catch (error) {
      toast.error("Lỗi khi xóa dịch vụ!");
    }
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      filterCategory === "all" || s.categoryId === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-50 md:bg-transparent pb-4 pt-4 -mt-4 -mx-4 px-4 md:static md:pb-0 md:pt-0 md:mt-0 md:mx-0 md:px-0 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase italic flex items-center gap-2 md:gap-3">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
              Quản lý Dịch vụ
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">
              Spa, Wellness, Massage và các gói liệu trình cao cấp.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3">
            {selectedIds.length > 0 && canEdit && (
              <button
                onClick={handleBulkDelete}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm active:scale-95"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap text-center">
                  Xóa {selectedIds.length} <br className="md:hidden" />
                  mục
                </span>
              </button>
            )}
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-white text-slate-900 border border-slate-200 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <List className="w-4 h-4 md:w-5 md:h-5" />
              <span className="whitespace-nowrap text-center">
                Danh <br className="md:hidden" />
                mục
              </span>
            </button>
            {canAdd && (
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="whitespace-nowrap text-center">
                  Thêm <br className="md:hidden" />
                  dịch vụ
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm items-center">
          <div className="flex gap-3 w-full lg:w-auto items-center">
            <label className="flex items-center gap-3 pl-2 pr-1 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={
                  filteredServices.length > 0 &&
                  selectedIds.length === filteredServices.length
                }
                onChange={(e) => {
                  if (e.target.checked)
                    setSelectedIds(filteredServices.map((s) => s.id!));
                  else setSelectedIds([]);
                }}
                className="w-5 h-5 md:w-5 md:h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest sm:hidden lg:inline text-nowrap">
                Tất cả
              </span>
            </label>
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm dịch vụ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 md:pl-12 pr-10 md:pr-4 py-2.5 md:py-3.5 bg-slate-50 border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-medium text-xs md:text-sm"
              />
              <button
                onClick={() => setShowMobileFilter(!showMobileFilter)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg lg:hidden text-slate-500 hover:text-blue-600"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div
            className={cn(
              "gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide lg:flex w-full lg:w-auto",
              showMobileFilter
                ? "flex flex-wrap border-t border-slate-100 pt-3"
                : "hidden lg:flex",
            )}
          >
            <button
              onClick={() => setFilterCategory("all")}
              className={cn(
                "whitespace-nowrap px-4 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all",
                filterCategory === "all"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-100 text-slate-500",
              )}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id!)}
                className={cn(
                  "whitespace-nowrap px-4 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all",
                  filterCategory === cat.id
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-100 text-slate-500",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-3 md:px-6 py-4 md:py-6 w-8 md:w-12">
                  <input
                    type="checkbox"
                    checked={
                      filteredServices.length > 0 &&
                      selectedIds.length === filteredServices.length
                    }
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedIds(filteredServices.map((s) => s.id!));
                      else setSelectedIds([]);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-2 md:px-4 py-4 md:py-6">Dịch vụ</th>
                <th className="px-2 md:px-8 py-4 md:py-6 text-right">
                  Chi phí
                </th>
                <th className="px-2 md:px-8 py-4 md:py-6 text-center whitespace-nowrap">
                  Thời lượng
                </th>
                <th className="px-2 md:px-8 py-4 md:py-6">Trạng thái</th>
                <th className="px-2 md:px-8 py-4 md:py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 table-row-group">
              {loading ? (
                <tr className="table-row">
                  <td colSpan={6} className="py-24 text-center table-cell">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 opacity-20" />
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr className="table-row">
                  <td
                    colSpan={6}
                    className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest text-xs table-cell"
                  >
                    Không tìm thấy dịch vụ yêu cầu
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-slate-50/50 transition-all group table-row cursor-pointer flex flex-col md:table-row pt-3 pb-2 md:py-0 px-2 md:px-0 relative"
                    onClick={() => {}}
                  >
                    <td
                      className="px-2 md:px-6 py-2 md:py-5 w-auto md:w-12 align-middle block md:table-cell absolute md:static top-5 right-2 md:top-auto md:right-auto z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(service.id!)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedIds((prev) => [...prev, service.id!]);
                          else
                            setSelectedIds((prev) =>
                              prev.filter((id) => id !== service.id!),
                            );
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm md:shadow-none"
                      />
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-5 align-middle block md:table-cell">
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-lg md:rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 overflow-hidden shrink-0 shadow-sm">
                          {service.images?.[0] ? (
                            <img
                              src={service.images[0]}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <Sparkles className="w-5 h-5 md:w-7 md:h-7" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pr-14 md:pr-0">
                          <p className="font-black text-slate-900 line-clamp-2 uppercase tracking-tight text-xs md:text-sm leading-tight">
                            {service.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] md:text-[10px] text-blue-600 font-bold uppercase tracking-widest bg-blue-50 px-2 py-0.5 flex items-center rounded text-nowrap mt-1">
                              {service.categoryName}
                            </span>
                            <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 flex items-center rounded text-nowrap mt-1 py-0.5">
                              {service.code}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-1 md:py-5 text-left md:text-right align-middle block md:table-cell mt-1 md:mt-0 ml-[60px] md:ml-0">
                      <div className="flex justify-between items-center md:block">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest md:hidden">
                          Chi phí
                        </div>
                        <div>
                          {service.promoPrice && service.promoPrice > 0 ? (
                            <>
                              <p className="font-black text-rose-600 text-sm md:text-base whitespace-nowrap">
                                {formatCurrency(service.promoPrice)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap line-through">
                                {formatCurrency(service.price)}
                              </p>
                            </>
                          ) : (
                            <p className="font-black text-blue-600 text-sm md:text-base whitespace-nowrap">
                              {formatCurrency(service.price)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-1 md:py-5 text-left md:text-center align-middle block md:table-cell ml-[60px] md:ml-0">
                      <div className="flex justify-between items-center md:block mt-1 md:mt-0">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest md:hidden">
                          Thời lượng
                        </div>
                        <span className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 bg-slate-50 text-slate-600 whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          {service.duration} Phút
                        </span>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-1 md:py-5 align-middle block md:table-cell ml-[60px] md:ml-0 mb-3 md:mb-0">
                      <div className="flex justify-between items-center md:block mt-1 md:mt-0">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest md:hidden">
                          Trạng thái
                        </div>
                        <span
                          className={cn(
                            "px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap inline-block",
                            service.status === "active"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {service.status === "active" ? "Hoạt động" : "Tạm ẩn"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 md:px-8 py-2 md:py-5 text-right align-middle flex md:table-cell border-t md:border-transparent mt-2 md:mt-0 border-slate-50 justify-end">
                      <div className="flex items-center justify-end gap-1.5 md:gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all md:translate-x-2 md:group-hover:translate-x-0">
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(service);
                            }}
                            className="p-2 md:p-2.5 bg-white shadow-sm border border-slate-100 rounded-lg md:rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(service.id!);
                            }}
                            className="p-2 md:p-2.5 bg-white shadow-sm border border-slate-100 rounded-lg md:rounded-xl text-slate-500 hover:text-rose-600 hover:border-rose-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Modal */}
      {createPortal(
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full h-[100dvh] md:h-auto md:max-h-[90vh] max-w-[800px] bg-white md:rounded-[32px] lg:rounded-[44px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
            >
              <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-50 flex items-center justify-between shrink-0 mt-2 md:mt-0">
                <div className="flex items-center gap-3 sm:gap-5">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-[20px] bg-blue-50 flex items-center justify-center text-blue-600">
                    <Sparkles className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                      {editingId ? "Cập nhật dịch vụ" : "Dịch vụ mới"}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 sm:p-3 hover:bg-slate-50 rounded-xl sm:rounded-2xl transition-colors"
                >
                  <X className="w-5 h-5 sm:w-7 sm:h-7 text-slate-400" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col h-full overflow-hidden"
              >
                <div className="overflow-y-auto custom-scrollbar flex-1 p-5 sm:p-8 space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Tên dịch vụ *
                        </label>
                        <input
                          required
                          type="text"
                          value={formData.name || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="Tên..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-slate-900 text-sm transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between px-1">
                            Mã DV{" "}
                            <button
                              type="button"
                              onClick={generateCode}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </label>
                          <input
                            required
                            type="text"
                            value={formData.code || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, code: e.target.value })
                            }
                            placeholder="SRV-001"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-black text-slate-900 text-sm transition-all uppercase tracking-wider"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Phút
                          </label>
                          <input
                            required
                            type="number"
                            value={formData.duration || 0}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                duration: Number(e.target.value),
                              })
                            }
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-black text-slate-900 text-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Giá bán
                          </label>
                          <input
                            required
                            type="number"
                            value={formData.price || 0}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: Number(e.target.value),
                              })
                            }
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-black text-slate-900 text-sm transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Giá KM
                          </label>
                          <input
                            type="number"
                            value={formData.promoPrice || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                promoPrice: Number(e.target.value),
                              })
                            }
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none font-black text-rose-600 text-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Nhóm danh mục
                        </label>
                        <select
                          required
                          value={formData.categoryId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              categoryId: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-slate-900 text-sm appearance-none transition-all"
                        >
                          <option value="">Chọn danh mục...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Trạng thái
                        </label>
                        <div className="p-1 bg-slate-50 rounded-[14px] flex gap-1 border border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, status: "active" })
                            }
                            className={cn(
                              "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all",
                              formData.status === "active"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-400 hover:text-slate-600",
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" /> Mở
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, status: "hidden" })
                            }
                            className={cn(
                              "flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all",
                              formData.status === "hidden"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-400 hover:text-slate-600",
                            )}
                          >
                            <EyeOff className="w-3.5 h-3.5" /> Ẩn
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Hình ảnh
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {formData.images?.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden bg-slate-50 group border border-slate-100"
                            >
                              <img
                                src={url}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    images: prev.images?.filter(
                                      (_, i) => i !== idx,
                                    ),
                                  }))
                                }
                                className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm shadow-sm rounded-lg flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-rose-50 hover:text-rose-600 text-slate-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {(formData.images?.length || 0) < 5 && (
                            <label className="aspect-video rounded-xl md:rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer group">
                              {uploading ? (
                                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                              ) : (
                                <>
                                  <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 uppercase tracking-widest">Thêm ảnh</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={uploadImage}
                                className="hidden"
                                disabled={uploading}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          Tags (Enter để thêm)
                        </label>
                        <div className="p-3 bg-slate-50 rounded-xl md:rounded-2xl space-y-2 border border-slate-100">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={addTag}
                            placeholder="VD: wellness, hot stone..."
                            className="w-full bg-transparent border-none outline-none font-bold text-sm text-slate-900 placeholder:text-slate-400 px-1"
                          />
                          {formData.tags && formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {formData.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 flex items-center gap-1 shadow-sm"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="hover:text-rose-500 hover:bg-rose-50 rounded p-0.5 ml-0.5 transition-colors"
                                  >
                                    <X className="w-3 h-3 text-slate-400" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-50 bg-white flex shrink-0 mt-auto items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    Hủy thao tác
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl sm:rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingId ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {editingId ? "Cập nhật hệ thống" : "Kích hoạt dịch vụ"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[24px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900">
                    <List className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      Nhóm dịch vụ
                    </h2>
                  </div>
                </div>
                <button onClick={() => setIsCategoryModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                <form
                  onSubmit={handleAddCategory}
                  className="bg-slate-50 p-4 rounded-2xl space-y-3"
                >
                  <input
                    required
                    type="text"
                    placeholder="Tên nhóm..."
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-slate-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Mô tả..."
                    value={categoryDesc}
                    onChange={(e) => setCategoryDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-medium text-slate-900 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={categoryLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md"
                  >
                    {categoryLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : editingCategoryId ? (
                      "Cập nhật"
                    ) : (
                      "Thêm nhóm"
                    )}
                  </button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Danh sách hiện tại
                  </h3>
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between group hover:border-blue-100 transition-all"
                    >
                      <div>
                        <p className="font-black text-slate-900 uppercase italic text-xs tracking-tight">
                          {cat.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 line-clamp-1">
                          {cat.description || "Không có mô tả"}
                        </p>
                      </div>
                      <div className="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setCategoryName(cat.name);
                            setCategoryDesc(cat.description || "");
                            setEditingCategoryId(cat.id!);
                          }}
                          className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id!)}
                          className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={
          deleteConfirm.type === "service"
            ? "Xác nhận xóa dịch vụ"
            : "Xác nhận xóa danh mục"
        }
        message={
          deleteConfirm.type === "service"
            ? "Bạn có chắc chắn muốn xóa dịch vụ này? Nếu đã có giao dịch, dịch vụ sẽ được ẩn."
            : "Xóa danh mục này sẽ không ảnh hưởng đến dịch vụ hiện tại."
        }
        onConfirm={async () => {
          if (deleteConfirm.type === "service") {
            await executeDeleteService(deleteConfirm.id);
          } else if (deleteConfirm.type === "category") {
            await executeDeleteCategory(deleteConfirm.id);
          }
          setDeleteConfirm({ isOpen: false, id: "", type: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: "", type: null })}
      />
    </div>
  );
}
