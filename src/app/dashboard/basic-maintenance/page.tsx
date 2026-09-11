"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCustomTable,
  ColumnDef,
  PaginationState,
} from "@/components/ui/customTable(serverSidePagination)";
import {
  Wrench,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCcw,
  FileSpreadsheet,
  FileText,
  Car,
  Trash2,
  Edit2,
  Eye,
  Camera,
  MapPin,
  User,
  ShieldCheck,
  ChevronRight,
  Printer,
  Search,
  Calendar,
} from "lucide-react";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import ResponseLoader from "@/components/ResponseLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useExport } from "@/hooks/useExport";
import {
  inspectionService,
  InspectionRecord,
  VehicleOption,
  SupervisorOption,
} from "@/services/api/inspectionService";

export interface ChecklistItemState {
  id: number;
  section: string;
  name: string;
  label: string;
  status: "pass" | "fail" | "";
  failureDescription: string;
  failureImage: File | string | null;
  existingImage: string | null;
}

const INITIAL_CHECKLIST_CONFIG: Omit<ChecklistItemState, "failureDescription" | "failureImage" | "existingImage">[] = [
  // Engine Section
  { id: 1, section: "Engine", name: "engineOil", label: "Engine Oil", status: "" },
  { id: 2, section: "Engine", name: "sparkPlug", label: "Spark Plug", status: "" },

  // Fluids Section
  { id: 3, section: "Fluids", name: "acCollent", label: "AC Coolant", status: "" },
  { id: 4, section: "Fluids", name: "breakFluid", label: "Brake Fluid", status: "" },
  { id: 5, section: "Fluids", name: "transmissionFluid", label: "Transmission Fluid", status: "" },
  { id: 6, section: "Fluids", name: "powerStairingFluid", label: "Power Steering Fluid", status: "" },
  { id: 7, section: "Fluids", name: "windShieldWasherFluid", label: "Windshield Washer Fluid", status: "" },

  // Tyres Section
  { id: 8, section: "Tyres", name: "tyrePressure", label: "Tyre Pressure", status: "" },
  { id: 9, section: "Tyres", name: "tyreAlignment", label: "Tyre Alignment", status: "" },

  // Electrical Section
  { id: 10, section: "Electrical", name: "batteryCharge", label: "Battery Charge", status: "" },
  { id: 11, section: "Electrical", name: "wiperBlades", label: "Wiper Blades", status: "" },
  { id: 12, section: "Electrical", name: "warningLights", label: "Warning Lights", status: "" },
  { id: 13, section: "Electrical", name: "headLights", label: "Head Lights", status: "" },
  { id: 14, section: "Electrical", name: "indicator", label: "Indicators", status: "" },

  // Suspension Section
  { id: 15, section: "Suspension", name: "suspensionAndStairing", label: "Suspension & Steering", status: "" },

  // Underbody Section
  { id: 16, section: "Underbody", name: "underbody", label: "Underbody", status: "" },

  // Exhaust Section
  { id: 17, section: "Exhaust", name: "exaustSystem", label: "Exhaust System", status: "" },
  { id: 18, section: "Exhaust", name: "airFilter", label: "Air Filter System", status: "" },
];

export default function BasicMaintenancePage() {
  const queryClient = useQueryClient();
  const { exportToPDF, exportToExcel } = useExport();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("all");
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Table pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Selected item state
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState<string | null>(null);
  const [modalImageTitle, setModalImageTitle] = useState("");

  // Form state
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItemState[]>([]);

  // 1. Fetch inspections
  const {
    data: inspections = [],
    isLoading: isLoadingInspections,
    refetch,
  } = useQuery<InspectionRecord[]>({
    queryKey: ["vehicleInspections"],
    queryFn: async () => {
      try {
        return await inspectionService.getAllVehicleInspections();
      } catch (error) {
        console.error("Error fetching vehicle inspections:", error);
        return [];
      }
    },
    staleTime: 30000,
    retry: 1,
  });

  // 2. Fetch vehicle options
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ["vehicleGetAllOptions"],
    queryFn: async () => {
      try {
        return await inspectionService.getAllVehicles();
      } catch (err) {
        console.error("Error fetching vehicles:", err);
        return [];
      }
    },
    staleTime: 60000,
  });

  // 3. Fetch supervisor options
  const { data: supervisors = [] } = useQuery<SupervisorOption[]>({
    queryKey: ["supervisorOptions"],
    queryFn: async () => {
      try {
        return await inspectionService.getSupervisors();
      } catch (err) {
        console.error("Error fetching supervisors:", err);
        return [];
      }
    },
    staleTime: 60000,
  });

  // 4. Mutations
  const postMutation = useMutation({
    mutationFn: ({ vehicleId, formData }: { vehicleId: string; formData: FormData }) =>
      inspectionService.postVehicleInspection(vehicleId, formData),
    onSuccess: () => {
      toast.success("Inspection created successfully");
      queryClient.invalidateQueries({ queryKey: ["vehicleInspections"] });
      setIsFormModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create inspection");
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      inspectionService.patchVehicleInspection(id, formData),
    onSuccess: () => {
      toast.success("Inspection updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vehicleInspections"] });
      setIsFormModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update inspection");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inspectionService.deleteVehicleInspection(id),
    onSuccess: () => {
      toast.success("Inspection deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vehicleInspections"] });
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete inspection");
    },
  });

  // Filtering
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      // Supervisor filter
      if (selectedSupervisor !== "all" && item.supervisor !== selectedSupervisor) {
        return false;
      }

      // Date range filter
      if (dateRange.start) {
        const itemDate = new Date(item.originalDate || item.date);
        if (itemDate < dateRange.start) return false;
      }
      if (dateRange.end) {
        const itemDate = new Date(item.originalDate || item.date);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.vehicleName.toLowerCase().includes(q) ||
          item.driverName.toLowerCase().includes(q) ||
          item.supervisor.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [inspections, selectedSupervisor, dateRange, searchQuery]);

  // Paginated data slice
  const paginatedData = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredInspections.slice(start, start + pagination.pageSize);
  }, [filteredInspections, pagination.pageIndex, pagination.pageSize]);

  const handlePaginationChange = useCallback((updater: any) => {
    setPagination((prev: PaginationState) => {
      const newValues = typeof updater === "function" ? updater(prev) : updater;
      if (prev.pageIndex === newValues.pageIndex && prev.pageSize === newValues.pageSize) {
        return prev;
      }
      return newValues;
    });
  }, []);

  // Handle open add modal
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setSelectedInspection(null);
    setSelectedVehicleId(vehicles[0]?.id || "");
    const initialItems: ChecklistItemState[] = INITIAL_CHECKLIST_CONFIG.map((cfg) => ({
      ...cfg,
      status: "",
      failureDescription: "",
      failureImage: null,
      existingImage: null,
    }));
    setChecklistItems(initialItems);
    setIsFormModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditModal = (inspection: InspectionRecord) => {
    setIsEditMode(true);
    setSelectedInspection(inspection);
    setSelectedVehicleId(inspection.vehicleId || inspection.vehicleName);

    const items: ChecklistItemState[] = INITIAL_CHECKLIST_CONFIG.map((cfg) => {
      const existing = inspection.items?.[cfg.name];
      const isFail = existing?.status?.toLowerCase() === "fail";
      const isPass = existing?.status?.toLowerCase() === "pass";
      return {
        ...cfg,
        status: isFail ? "fail" : isPass ? "pass" : "",
        failureDescription: existing?.description || "",
        failureImage: existing?.image || null,
        existingImage: existing?.image || null,
      };
    });

    setChecklistItems(items);
    setIsFormModalOpen(true);
  };

  // Handle open view modal
  const handleOpenViewModal = (inspection: InspectionRecord) => {
    setSelectedInspection(inspection);
    setIsViewModalOpen(true);
  };

  // Handle view failed image
  const handleViewImage = async (imageName: string, itemName: string) => {
    if (!imageName) return;
    setModalImageTitle(itemName);

    if (imageName.startsWith("data:") || imageName.startsWith("http")) {
      setModalImageSrc(imageName);
      setIsImageModalOpen(true);
      return;
    }

    try {
      const res = await inspectionService.getFailInspectionImage(imageName);
      const { base64Data, contentType } = res?.image || res || {};
      if (base64Data && contentType) {
        setModalImageSrc(`data:${contentType};base64,${base64Data}`);
      } else {
        setModalImageSrc(imageName);
      }
      setIsImageModalOpen(true);
    } catch {
      toast.error("Unable to load inspection image from server.");
    }
  };

  const handleItemStatusChange = (id: number, status: "pass" | "fail" | "") => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleItemDescriptionChange = (id: number, desc: string) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, failureDescription: desc } : item))
    );
  };

  const handleItemImageChange = (id: number, file: File | null) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, failureImage: file } : item))
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      toast.error("Please select a vehicle.");
      return;
    }

    const unselected = checklistItems.filter((i) => !i.status);
    if (unselected.length > 0) {
      toast.error(`Please select Pass or Fail for all components (${unselected.length} remaining).`);
      return;
    }

    const formData = new FormData();
    checklistItems.forEach((item) => {
      const isPass = item.status === "pass";
      const desc = item.failureDescription || (isPass ? "No Issue in this part" : "Issue reported");
      formData.append(item.name, JSON.stringify({ status: isPass, description: desc }));

      if (item.failureImage instanceof File) {
        formData.append(`${item.name}Img`, item.failureImage);
      } else if (item.failureImage === null && item.existingImage) {
        formData.append(`${item.name}ImgRemove`, "true");
      }
    });

    if (isEditMode && selectedInspection?.id) {
      patchMutation.mutate({ id: selectedInspection.id, formData });
    } else {
      postMutation.mutate({ vehicleId: selectedVehicleId, formData });
    }
  };

  // Export handlers
  const exportColumns = [
    { key: "sn", header: "S.No." },
    { key: "date", header: "Date" },
    { key: "vehicleName", header: "Vehicle Number" },
    { key: "driverName", header: "Driver Name" },
    { key: "pass", header: "Passed Items" },
    { key: "fail", header: "Failed Items" },
  ];

  const handleExport = (type: "pdf" | "excel") => {
    if (filteredInspections.length === 0) {
      toast.warning("No records to export.");
      return;
    }

    const formatted = filteredInspections.map((item, idx) => ({
      sn: idx + 1,
      date: item.date,
      vehicleName: item.vehicleName,
      driverName: item.driverName,
      pass: `${item.inspectionPass}`,
      fail: `${item.inspectionFail}`,
    }));

    const config = {
      title: "Vehicle Basic Maintenance & Inspection Log",
      companyName: "Parents Eye Fleet Management",
      metadata: {
        "Total Records": `${filteredInspections.length}`,
        "Export Date": new Date().toLocaleDateString(),
      },
    };

    if (type === "pdf") {
      exportToPDF(formatted, exportColumns, config);
    } else {
      exportToExcel(formatted, exportColumns, config);
    }
  };

  // Group checklist items by section for the modal
  const groupedChecklist = useMemo(() => {
    const groups: Record<string, ChecklistItemState[]> = {};
    checklistItems.forEach((item) => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return groups;
  }, [checklistItems]);

  // Table Columns definition for useCustomTable
  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        accessorKey: "date",
        header: "Date & Time",
        meta: { wrapConfig: { minWidth: "160px", wrap: "nowrap" } },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-medium text-gray-900 text-xs">
            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>{row.original.date}</span>
          </div>
        ),
      },
      {
        accessorKey: "vehicleName",
        header: "Vehicle Number",
        meta: { wrapConfig: { minWidth: "160px", wrap: "nowrap" } },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-700 shrink-0">
              <Car className="h-4 w-4" />
            </div>
            <span className="font-semibold text-gray-900 text-xs">{row.original.vehicleName}</span>
          </div>
        ),
      },
      {
        accessorKey: "driverName",
        header: "Driver Name",
        meta: { wrapConfig: { minWidth: "150px", wrap: "nowrap" } },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-medium text-gray-900 text-xs">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span>{row.original.driverName}</span>
          </div>
        ),
      },
      {
        id: "inspectionResult",
        header: "Inspection Result",
        meta: { wrapConfig: { minWidth: "160px", wrap: "nowrap" } },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {row.original.inspectionPass} Pass
            </span>
            {row.original.inspectionFail > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <XCircle className="h-3 w-3 text-rose-600" />
                {row.original.inspectionFail} Fail
              </span>
            ) : (
              <span className="text-xs text-gray-400">0 Fail</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { wrapConfig: { minWidth: "140px", wrap: "nowrap" } },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenViewModal(row.original)}
              className="h-8 px-2.5 text-xs gap-1.5 text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200 cursor-pointer"
              title="View Inspection Analysis & Photos"
            >
              <Eye className="h-3.5 w-3.5" />
              Details
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenEditModal(row.original)}
              className="h-8 w-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
              title="Edit Inspection"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDeletingId(row.original.id);
                setIsDeleteDialogOpen(true);
              }}
              className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
              title="Delete Inspection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  // Standard project table via useCustomTable hook
  const { tableElement } = useCustomTable({
    data: paginatedData,
    columns,
    pagination,
    totalCount: filteredInspections.length,
    loading: isLoadingInspections,
    onPaginationChange: handlePaginationChange,
    pageSizeOptions: [10, 20, 30, 50, 100],
    showSerialNumber: true,
    enableSorting: false,
    maxHeight: "calc(100vh - 280px)",
    enableColumnWrapping: true,
    defaultTextWrap: "wrap",
  });

  return (
    <div className="h-full flex flex-col space-y-4 p-4 bg-gray-50/50 overflow-hidden min-h-[calc(100vh-64px)]">
      <ResponseLoader
        isLoading={
          isLoadingInspections ||
          postMutation.isPending ||
          patchMutation.isPending ||
          deleteMutation.isPending
        }
      />

      {/* Top Filter Controls Card matching existing app UI */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar using project's Input component with left icon */}
        <div className="flex-1 w-full lg:max-w-md">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            placeholder="Search by vehicle, driver, supervisor, route..."
            icon={<Search className="h-4 w-4 text-gray-400" />}
            iconPosition="left"
            className="h-10 bg-white border-gray-200 text-xs rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Filter */}
          <div className="w-[200px] sm:w-[240px]">
            <DateRangeFilter
              onDateRangeChange={(start, end) => {
                setDateRange({ start, end });
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              title="Search by Date"
            />
          </div>

          {/* Supervisor Filter */}
          <Select
            value={selectedSupervisor}
            onValueChange={(val) => {
              setSelectedSupervisor(val);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-[160px] bg-white h-10 text-xs border-gray-200 rounded-lg">
              <SelectValue placeholder="All Supervisors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Supervisors</SelectItem>
              {supervisors.map((sup) => (
                <SelectItem key={sup.value} value={sup.value}>
                  {sup.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action Buttons: Export, Refresh, Add Inspection */}
          <div className="flex items-center gap-1.5 ml-auto lg:ml-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 bg-white cursor-pointer h-10 text-xs rounded-lg border-gray-200">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer gap-2 text-xs">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-4 w-4 text-rose-600" />
                  Export to PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer gap-2 text-xs">
                  <Printer className="h-4 w-4 text-blue-600" />
                  Print Page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 bg-white cursor-pointer h-10 text-xs rounded-lg border-gray-200"
              title="Refresh inspections"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              onClick={handleOpenAddModal}
              className="gap-1.5 hover:bg-primary/90 font-medium cursor-pointer h-10 text-xs rounded-lg shadow-xs"
            >
              Add Inspection
            </Button>
          </div>
        </div>
      </div>

      {/* Standard Table Layout */}
      <div className="flex-1 min-h-0">
        {tableElement}
      </div>

      {/* Add / Edit Inspection Modal */}
      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0c235c] flex items-center gap-2">
              <Wrench className="h-5 w-5 text-yellow-600" />
              {isEditMode ? `Edit Vehicle Inspection #${selectedInspection?.id}` : "New Inspection Checklist"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEditMode
                ? "Update failure status, descriptions, or replacement images for the selected vehicle inspection."
                : "Select vehicle and mark pass/fail status for all component inspection points."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* Vehicle Selection */}
            <div className="bg-gray-50/80 p-3.5 rounded-lg border border-gray-200">
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Select Vehicle <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
                disabled={isEditMode}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm bg-white">
                  <SelectValue placeholder="Choose vehicle number..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Vehicle assignment cannot be modified for an existing inspection log.
                </p>
              )}
            </div>

            {/* Checklist Sections */}
            <div className="space-y-4">
              {Object.entries(groupedChecklist).map(([sectionName, items]) => (
                <div
                  key={sectionName}
                  className="border border-gray-200 rounded-lg p-3 bg-white shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h3 className="font-bold text-sm text-[#0c235c] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      {sectionName} Section
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">
                      {items.length} items
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <div key={item.id} className="py-2.5 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-gray-800">
                            {item.label}
                          </span>

                          <RadioGroup
                            value={item.status}
                            onValueChange={(val: "pass" | "fail") => handleItemStatusChange(item.id, val)}
                            className="flex items-center gap-4"
                          >
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem
                                value="pass"
                                id={`pass-${item.id}`}
                                className="text-emerald-600 border-emerald-500 focus-visible:ring-emerald-400"
                              />
                              <Label
                                htmlFor={`pass-${item.id}`}
                                className="text-xs font-medium cursor-pointer text-emerald-700"
                              >
                                Pass
                              </Label>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem
                                value="fail"
                                id={`fail-${item.id}`}
                                className="text-rose-600 border-rose-500 focus-visible:ring-rose-400"
                              />
                              <Label
                                htmlFor={`fail-${item.id}`}
                                className="text-xs font-medium cursor-pointer text-rose-700"
                              >
                                Fail
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {item.status === "fail" && (
                          <div className="p-2.5 rounded bg-rose-50/50 border border-rose-100 space-y-2 text-xs">
                            <div>
                              <Label className="font-semibold text-rose-900 block mb-1">
                                Failure Description:
                              </Label>
                              <Textarea
                                rows={2}
                                value={item.failureDescription}
                                onChange={(e) =>
                                  handleItemDescriptionChange(item.id, e.target.value)
                                }
                                placeholder="Describe the fault or issue observed..."
                                className="w-full bg-white rounded border-rose-200 text-xs focus-visible:ring-rose-400 min-h-[60px]"
                              />
                            </div>

                            <div>
                              <label className="font-semibold text-rose-900 block mb-1">
                                Upload Photo / Proof:
                              </label>
                              <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50">
                                  <Camera className="h-3.5 w-3.5 text-gray-500" />
                                  <span>Choose image</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleItemImageChange(item.id, file);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                {item.failureImage && (
                                  <span className="text-xs text-emerald-700 font-medium truncate max-w-[200px]">
                                    {item.failureImage instanceof File
                                      ? item.failureImage.name
                                      : "Image attached"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={postMutation.isPending || patchMutation.isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-semibold cursor-pointer shadow-xs"
              >
                {postMutation.isPending || patchMutation.isPending
                  ? "Submitting..."
                  : isEditMode
                  ? "Update Inspection"
                  : "Submit Checklist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details / Inspection Analysis Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0c235c] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Inspection Analysis - {selectedInspection?.vehicleName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Inspection checklist breakdown, passed components, and failure defect audit logs.
            </DialogDescription>
          </DialogHeader>

          {selectedInspection && (
            <div className="space-y-4 py-2">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-700">
                    {selectedInspection.inspectionPass}
                  </div>
                  <div className="text-xs font-semibold text-emerald-800">
                    Components Passed
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">
                    {((selectedInspection.inspectionPass / 18) * 100).toFixed(0)}% of checklist
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-2xl font-bold text-rose-700">
                    {selectedInspection.inspectionFail}
                  </div>
                  <div className="text-xs font-semibold text-rose-800">
                    Components Failed
                  </div>
                  <div className="text-[11px] text-rose-600 mt-0.5">
                    {((selectedInspection.inspectionFail / 18) * 100).toFixed(0)}% issues detected
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-2xl font-bold text-gray-900">18</div>
                  <div className="text-xs font-semibold text-gray-700">
                    Total Checklist Points
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Vehicle: {selectedInspection.vehicleName}
                  </div>
                </div>
              </div>

              {/* Vehicle & Driver Info Banner */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Vehicle Number</span>
                  <span className="font-semibold text-gray-900">
                    {selectedInspection.vehicleName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Driver Name</span>
                  <span className="font-semibold text-gray-900">
                    {selectedInspection.driverName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Inspection Date</span>
                  <span className="font-semibold text-gray-900">
                    {selectedInspection.date}
                  </span>
                </div>
              </div>

              {/* Failed Items Table if any */}
              {selectedInspection.inspectionFail > 0 && (
                <div className="border border-rose-200 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-rose-900">
                      Failed Components Required Attention ({selectedInspection.inspectionFail})
                    </h4>
                  </div>
                  <div className="p-3 space-y-2">
                    {Object.entries(selectedInspection.items || {})
                      .filter(([_, val]) => val.status === "Fail")
                      .map(([key, val]) => (
                        <div
                          key={key}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-rose-50/40 border border-rose-100 text-xs"
                        >
                          <div>
                            <span className="font-bold text-gray-900 capitalize">
                              {key.replace(/([A-Z])/g, " $1")}
                            </span>
                            <p className="text-gray-600 mt-0.5">{val.description}</p>
                          </div>

                          {val.image && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleViewImage(val.image as string, key)
                              }
                              className="gap-1.5 h-7 px-2 text-xs border-rose-300 text-rose-800 hover:bg-rose-100"
                            >
                              <Camera className="h-3 w-3" />
                              View Photo
                            </Button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Passed Items Overview */}
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                    Passed Items in Good Condition ({selectedInspection.inspectionPass})
                  </h4>
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(selectedInspection.items || {})
                    .filter(([_, val]) => val.status === "Pass")
                    .map(([key]) => (
                      <div
                        key={key}
                        className="p-2 rounded bg-emerald-50/40 border border-emerald-100 text-emerald-900 font-medium flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="capitalize truncate">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-gray-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsViewModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof / Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2 capitalize">
              <Camera className="h-4 w-4 text-rose-600" />
              Inspection Photo - {modalImageTitle.replace(/([A-Z])/g, " $1")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 flex justify-center items-center min-h-[200px]">
            {modalImageSrc ? (
              <img
                src={modalImageSrc}
                alt="Inspection proof"
                className="max-h-[350px] w-auto rounded-lg object-contain border border-gray-200"
              />
            ) : (
              <p className="text-xs text-gray-400">No image preview available</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImageModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Delete Inspection Record?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this inspection? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingId) deleteMutation.mutate(deletingId);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
