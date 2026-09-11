"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { incidentService } from "@/services/api/incidentService";
import { api } from "@/services/apiService";
import { useCustomTable } from "@/components/ui/customTable(serverSidePagination)";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Plus, Download, FileSpreadsheet, FileText } from "lucide-react";
import { PaginationState } from "@tanstack/react-table";
import { getIncidentColumns } from "@/components/columns/columns";
import ResponseLoader from "@/components/ResponseLoader";
import Link from "next/link";
import { DynamicEditDialog, FieldConfig } from "@/components/ui/EditModal";
import { toast } from "sonner";
import { Incident } from "@/interface/modal";
import { useAuthStore } from "@/store/authStore";
import { useBranchDropdown, useSchoolDropdown } from "@/hooks/useDropdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExport } from "@/hooks/useExport";

export default function IncidentPage() {
  const queryClient = useQueryClient();
  const { exportToPDF, exportToExcel } = useExport();
  const { decodedToken: user } = useAuthStore();
  const userRole = user?.role?.toLowerCase();
  const canReport = ["parent", "branch", "superadmin", "branchgroup", "school"].includes(userRole || "");
  const canEdit = ["branch", "superadmin", "branchgroup", "school"].includes(userRole || "");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedEditRegion, setSelectedEditRegion] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["incidents", pagination.pageIndex, pagination.pageSize, selectedStatus, selectedRegion],
    queryFn: () => incidentService.getIncidents({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      status: selectedStatus === "all" ? undefined : selectedStatus,
      region: selectedRegion === "all" ? undefined : selectedRegion,
    }),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const exportColumns = [
    { key: "sn", header: "S.No." },
    { key: "region", header: "Region" },
    { key: "branchName", header: "User Name" },
    { key: "category", header: "Category" },
    { key: "subCategory", header: "Sub Category" },
    { key: "severity", header: "Severity" },
    { key: "status", header: "Status" },
    { key: "actions", header: "Actions" },
    { key: "date", header: "Date" },
    { key: "briefDescription", header: "Brief Description" },
    { key: "immediateActionTaken", header: "Immediate Action Taken" },
    { key: "pendingAction", header: "Pending Action" },
    { key: "remarks", header: "Remarks" },
  ];

  const handleExportAll = async (type: "pdf" | "excel") => {
    try {
      setIsExporting(true);
      toast.info(`Preparing ${type.toUpperCase()} export...`);

      const res = await incidentService.getIncidents({
        page: 1,
        limit: "all",
        status: selectedStatus === "all" ? undefined : selectedStatus,
        region: selectedRegion === "all" ? undefined : selectedRegion,
      });

      let allRecords = res?.data || [];
      if (!allRecords.length && data?.data?.length) {
        allRecords = data.data;
      }

      if (!allRecords.length) {
        toast.warning("No incident records found to export");
        return;
      }

      const formattedExportData = allRecords.map((item: any, idx: number) => ({
        sn: idx + 1,
        region: item.region || "N/A",
        branchName: item.branchName || "N/A",
        category: item.category || "N/A",
        subCategory: item.subCategory || "N/A",
        severity: item.severity || "Low",
        status: item.status || "N/A",
        actions: item.status === "Open" ? "Edit / Update Status" : "No action needed",
        date: item.date
          ? new Date(item.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            hour12: true,
          })
          : "N/A",
        briefDescription: item.briefDescription || "N/A",
        immediateActionTaken: item.immediateActionTaken || "N/A",
        pendingAction: item.pendingAction || "N/A",
        remarks: item.remarks || "N/A",
      }));

      const config = {
        title: "Incident Management Report",
        companyName: "Lighthouse",
        metadata: {
          Total: `${allRecords.length} records`,
          Region: selectedRegion === "all" ? "All Regions" : selectedRegion,
          Status: selectedStatus === "all" ? "All Statuses" : selectedStatus,
        },
      };

      if (type === "pdf") {
        exportToPDF(formattedExportData, exportColumns, config);
      } else {
        exportToExcel(formattedExportData, exportColumns, config);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Failed to export incident data");
    } finally {
      setIsExporting(false);
    }
  };

  const { data: branchGroups } = useQuery({
    queryKey: ["branchGroups"],
    queryFn: () => api.get<any[]>("/branchGroup"),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const { data: schools = [] } = useSchoolDropdown(true);

  const isBranchGroup = userRole === "branchgroup";

  const schoolOptions = useMemo(() => {
    if (!schools || !Array.isArray(schools)) return [];
    return schools.map((s: any) => ({
      label: s.schoolName || s.name || "School",
      value: s._id,
    }));
  }, [schools]);

  // Directly trigger Branch/Safety Head API for branchgroup role
  const { data: apiBranches } = useBranchDropdown(
    undefined,
    isBranchGroup,
    true
  );

  const branchGroupOptions = useMemo(() => {
    const list: { label: string; value: string; branches?: any[] }[] = branchGroups
      ? branchGroups.map((bg) => ({
          label: bg.branchGroupName,
          value: bg.branchGroupName,
          branches: bg.AssignedBranch || [],
        }))
      : [];

    if (selectedIncident?.region && !list.some((o) => o.value === selectedIncident.region)) {
      list.unshift({
        label: selectedIncident.region,
        value: selectedIncident.region,
        branches: [],
      });
    }

    return list;
  }, [branchGroups, selectedIncident?.region]);

  const safetyHeadOptions = useMemo(() => {
    let opts: { label: string; value: string }[] = [];
    if (schoolOptions.length > 0) {
      opts = [...schoolOptions];
    } else if (isBranchGroup && apiBranches) {
      opts = apiBranches.map((b: any) => ({
        label: b.branchName || b.name,
        value: b._id,
      }));
    } else {
      const region = branchGroupOptions.find((o) => o.value === selectedEditRegion);
      if (region && region.branches) {
        opts = region.branches.map((b: any) => ({
          label: b.branchName,
          value: b._id,
        }));
      }
    }

    // Ensure currently selected incident's branch/school is always a valid option
    const currentName = selectedIncident?.branchName || selectedIncident?.schoolName;
    const currentId = selectedIncident?.branchId || selectedIncident?.schoolId;

    if (currentName || currentId) {
      const exists = opts.some(
        (o) =>
          (currentId && o.value === currentId) ||
          (currentName && o.label.toLowerCase() === currentName.toLowerCase())
      );
      if (!exists) {
        opts.unshift({
          label: currentName || currentId || "School",
          value: currentId || currentName || "school",
        });
      }
    }

    return opts;
  }, [schoolOptions, selectedEditRegion, branchGroupOptions, isBranchGroup, apiBranches, selectedIncident]);

  const editData = useMemo(() => {
    if (!selectedIncident) return null;

    let resolvedBranchId = selectedIncident.branchId || selectedIncident.schoolId || "";
    const matchByLabel = safetyHeadOptions.find(
      (o) =>
        (selectedIncident.branchName && o.label.toLowerCase() === selectedIncident.branchName.toLowerCase()) ||
        (selectedIncident.schoolName && o.label.toLowerCase() === selectedIncident.schoolName.toLowerCase())
    );
    if (matchByLabel) {
      resolvedBranchId = matchByLabel.value;
    } else if (
      !safetyHeadOptions.some((o) => o.value === resolvedBranchId) &&
      (selectedIncident.branchName || selectedIncident.schoolName)
    ) {
      resolvedBranchId = selectedIncident.branchName || selectedIncident.schoolName || "";
    }

    return {
      ...selectedIncident,
      status: selectedIncident.status || "Open",
      region: selectedIncident.region || "",
      branchId: resolvedBranchId,
      remarks: selectedIncident.remarks || "",
      pendingAction: selectedIncident.pendingAction || "",
    };
  }, [selectedIncident, safetyHeadOptions]);

  const handleEdit = (incident: Incident) => {
    setSelectedIncident(incident);
    setSelectedEditRegion(incident.region || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateStatus = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsStatusDialogOpen(true);
  };

  const columns = useMemo(() => {
    const baseColumns = getIncidentColumns(
      canEdit ? handleEdit : undefined,
      canEdit ? handleUpdateStatus : undefined
    );

    // Remove Action column for parents
    if (userRole === "parent") {
      return baseColumns.filter(col => col.id !== "actions");
    }

    return baseColumns;
  }, [canEdit, userRole]);

  const handlePaginationChange = useCallback((updater: any) => {
    setPagination(prev => {
      const newValues = typeof updater === "function" ? updater(prev) : updater;
      if (prev.pageIndex === newValues.pageIndex && prev.pageSize === newValues.pageSize) {
        return prev;
      }
      return newValues;
    });
  }, []);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => incidentService.updateIncident(selectedIncident?._id as string, payload),
    onSuccess: () => {
      toast.success("Incident updated successfully");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setIsEditDialogOpen(false);
      setSelectedIncident(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update incident");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (payload: any) => incidentService.updateIncidentStatus(selectedIncident?._id as string, payload),
    onSuccess: () => {
      toast.success("Incident status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setIsStatusDialogOpen(false);
      setSelectedIncident(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update incident status");
    }
  });

  const handleUpdateSave = (formData: any) => {
    // Extract names from options to ensure they are sent to the API
    const selectedSchool = safetyHeadOptions.find(o => o.value === formData.branchId);

    const payload = {
      status: formData.status,
      remarks: formData.remarks,
      pendingAction: formData.pendingAction,
      region: formData.region,
      branchId: formData.branchId,
      branchName: selectedSchool?.label || selectedIncident?.branchName,
    };
    updateMutation.mutate(payload);
  };

  const handleUpdateStatusSave = (formData: any) => {
    const payload = {
      status: formData.status,
      remarks: formData.remarks,
      escalationStatus: formData.escalationStatus,
      escalatedTo: formData.escalatedTo,
    };
    updateStatusMutation.mutate(payload);
  };

  const handleFieldChange = (key: string, value: any) => {
    if (key === "region") {
      setSelectedEditRegion(value);
    }
  };

  const editFields: FieldConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Open", "Closed"],
      required: true,
    },
    {
      key: "region",
      label: "Region",
      type: "select",
      options: branchGroupOptions,
      required: !isBranchGroup,
      hidden: isBranchGroup,
    },
    {
      key: "branchId",
      label: "Safety Head (School)",
      type: "select",
      options: safetyHeadOptions,
      required: true,
      placeholder: "Select school",
      disabled: safetyHeadOptions.length === 0,
      gridCols: 1,
    },
    {
      key: "pendingAction",
      label: "Pending Action",
      type: "textarea",
      placeholder: "Specify any remaining actions...",
      gridCols: 1,
    },
    {
      key: "remarks",
      label: "Remarks",
      type: "textarea",
      placeholder: "Enter resolution remarks...",
      gridCols: 1,
    }
  ];

  const statusUpdateFields: FieldConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["Open", "In-Progress", "Resolved", "Closed"],
      required: true,
    },
    {
      key: "escalationStatus",
      label: "Escalation Status",
      type: "select",
      options: ["Yes", "No"],
      required: true,
    },
    {
      key: "escalatedTo",
      label: "Escalated To",
      type: "select",
      options: ["Operations HO", "Regional Head", "Safety Committee", "Other"],
      placeholder: "Select who it was escalated to",
      required: false,
      gridCols: 1,
    },
    {
      key: "remarks",
      label: "Remarks",
      type: "textarea",
      placeholder: "Enter resolution remarks...",
      required: true,
      gridCols: 1,
    }
  ];

  const { tableElement } = useCustomTable({
    data: data?.data || [],
    columns,
    pagination,
    totalCount: data?.total || 0,
    loading: isLoading,
    onPaginationChange: handlePaginationChange,
    pageSizeOptions: [10, 20, 30, 50, 100, 'All'],
    showSerialNumber: true,
    enableSorting: false,
    maxHeight: "calc(100vh - 300px)",
    enableColumnWrapping: true,
    defaultTextWrap: "wrap",
  });

  return (
    <div className="h-full flex flex-col space-y-4 p-4 bg-gray-50/50 overflow-hidden min-h-[calc(100vh-64px)]">
      <ResponseLoader isLoading={isLoading || isExporting || updateMutation.isPending || updateStatusMutation.isPending} />

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0c235c]">Incident Management</h1>
          <p className="text-muted-foreground text-sm">View and manage reported incidents</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedRegion}
            onValueChange={(value) => {
              setSelectedRegion(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-[160px] bg-white h-9">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {branchGroupOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedStatus}
            onValueChange={(value) => {
              setSelectedStatus(value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-[160px] bg-white h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In-Progress">In-Progress</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-white cursor-pointer h-9">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportAll("excel")} className="cursor-pointer gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportAll("pdf")} className="cursor-pointer gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 bg-white cursor-pointer h-9">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          {canReport && (
            <Link href="/dashboard/incident-management/new">
              <Button size="sm" className="gap-2 hover:bg-primary/90 font-medium cursor-pointer h-9 shadow-sm">
                Report Incident
              </Button>
            </Link>
          )}
        </div>
      </div>
      {tableElement}

      <DynamicEditDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        data={editData}
        fields={editFields}
        onSave={handleUpdateSave}
        onFieldChange={handleFieldChange}
        title="Edit Incident"
        description="Modify incident details, region, and assignments."
      />

      <DynamicEditDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        data={editData}
        fields={statusUpdateFields}
        onSave={handleUpdateStatusSave}
        title="Update Incident Status"
        description="Update the current status and escalation details for this incident."
      />
    </div>
  );
}