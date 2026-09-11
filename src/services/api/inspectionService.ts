import axios from "axios";
import Cookies from "js-cookie";

const MAINTENANCE_API_BASE =
  process.env.NEXT_PUBLIC_MAINTENANCE_API_URL;

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem("crdnsMaintToken") ||
    localStorage.getItem("crdnsMaintToken") ||
    Cookies.get("token") ||
    localStorage.getItem("token") ||
    null
  );
};

const inspectionAxios = axios.create({
  baseURL: MAINTENANCE_API_BASE,
});

inspectionAxios.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface InspectionChecklistItem {
  status: "Pass" | "Fail" | "Unknown";
  description?: string;
  image?: string | null;
}

export interface InspectionRecord {
  id: string;
  vehicleId?: string;
  vehicleName: string;
  originalDate: string;
  date: string;
  driverName: string;
  supervisor: string;
  startLocation: string;
  endLocation: string;
  status: string;
  inspectionPass: number;
  inspectionFail: number;
  category: string;
  items: Record<string, InspectionChecklistItem>;
}

export interface VehicleOption {
  id: string;
  name: string;
}

export interface SupervisorOption {
  value: string;
  label: string;
}

const formatItem = (item: any): InspectionChecklistItem => {
  if (!item) return { status: "Unknown", description: "No Issue in this part" };
  const isPass = item.status === true || item.status === "pass" || item.status === "Pass";
  return {
    status: isPass ? "Pass" : "Fail",
    description: item.description || (isPass ? "No Issue in this part" : "Issue reported"),
    image: item.Image || item.image || null,
  };
};

export const inspectionService = {
  // 1. Get all vehicle inspections
  getAllVehicleInspections: async (): Promise<InspectionRecord[]> => {
    try {
      const response = await inspectionAxios.get<{ data?: any[] }>(
        "/api/inspection/get-all-inspection"
      );
      const rawData = response.data?.data || [];

      return rawData.map((inspection: any) => {
        const items: Record<string, InspectionChecklistItem> = {
          engineOil: formatItem(inspection.engineOil),
          acCollent: formatItem(inspection.acCollent),
          sparkPlug: formatItem(inspection.sparkPlug),
          airFilter: formatItem(inspection.airFilter),
          breakFluid: formatItem(inspection.breakFluid),
          transmissionFluid: formatItem(inspection.transmissionFluid),
          powerStairingFluid: formatItem(inspection.powerStairingFluid),
          windShieldWasherFluid: formatItem(inspection.windShieldWasherFluid),
          tyrePressure: formatItem(inspection.tyrePressure),
          tyreAlignment: formatItem(inspection.tyreAlignment),
          batteryCharge: formatItem(inspection.batteryCharge),
          wiperBlades: formatItem(inspection.wiperBlades),
          suspensionAndStairing: formatItem(inspection.suspensionAndStairing),
          underbody: formatItem(inspection.underbody),
          exaustSystem: formatItem(inspection.exaustSystem),
          warningLights: formatItem(inspection.warningLights),
          headLights: formatItem(inspection.headLights),
          indicator: formatItem(inspection.indicator),
        };

        const values = Object.values(items);
        const passCount = values.filter((item) => item.status === "Pass").length;
        const failCount = values.filter((item) => item.status === "Fail").length;

        const formattedDate = inspection.createdAt
          ? new Date(inspection.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A";

        return {
          id: inspection._id,
          vehicleId: inspection.vehicleId?._id || inspection.vehicleId,
          vehicleName:
            inspection.vehicleId?.vehicleNumber ||
            inspection.vehicleId?.VehicleNumber ||
            inspection.vehicleNumber ||
            inspection.VehicleNumber ||
            inspection.vehicleName ||
            inspection.vehicleDetails?.vehicleNumber ||
            inspection.vehicleId?.registrationNumber ||
            (typeof inspection.vehicleId === "string" && inspection.vehicleId ? inspection.vehicleId : "Vehicle"),
          originalDate: inspection.createdAt,
          date: formattedDate,
          driverName: inspection.DriverId?.name || inspection.driverName || "Unknown",
          supervisor: inspection.DriverId?.supervisor || inspection.supervisor || "Unknown",
          startLocation: inspection.tripId?.startLocation || "N/A",
          endLocation: inspection.tripId?.endLocation || "N/A",
          status: inspection.tripId?.status || inspection.status || "completed",
          inspectionPass: passCount,
          inspectionFail: failCount,
          category: inspection.vehicleDetails?.category || "Standard",
          items,
        };
      });
    } catch (error) {
      console.error("Error fetching vehicle inspections:", error);
      throw error;
    }
  },

  // 2. Post a new inspection
  postVehicleInspection: async (
    vehicleId: string,
    formData: FormData
  ): Promise<any> => {
    const response = await inspectionAxios.post(
      `/api/inspection/add-inspection?vehicleId=${encodeURIComponent(vehicleId)}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // 3. Patch / Update inspection
  patchVehicleInspection: async (
    id: string,
    formData: FormData
  ): Promise<any> => {
    const response = await inspectionAxios.patch(
      `/api/inspection/edit-inspection/${id}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // 4. Delete inspection
  deleteVehicleInspection: async (id: string): Promise<any> => {
    const response = await inspectionAxios.delete(
      `/api/inspection/delete-inspection/${id}`
    );
    return response.data;
  },

  // 5. Get fail inspection image
  getFailInspectionImage: async (imageName: string): Promise<any> => {
    const response = await inspectionAxios.get(
      `/api/inspection/inspection-image/${encodeURIComponent(imageName)}`
    );
    return response.data;
  },

  // 6. Get all vehicles via /api/vehicle/get-all
  getAllVehicles: async (): Promise<VehicleOption[]> => {
    try {
      const response = await inspectionAxios.get("/api/vehicle/get-all");
      const raw = response.data;
      const list = Array.isArray(raw)
        ? raw
        : raw?.devices || raw?.vehicles || raw?.data || [];

      return list.map((v: any) => ({
        id: v._id || v.id,
        name: v.name || v.vehicleNumber || v.vehicleName || "Unknown",
      }));
    } catch (error) {
      console.warn("Failed to fetch vehicles from /api/vehicle/get-all:", error);
      return [];
    }
  },

  getVehicleMaster: async function (): Promise<VehicleOption[]> {
    return inspectionService.getAllVehicles();
  },

  // 7. Get supervisors
  getSupervisors: async (): Promise<SupervisorOption[]> => {
    try {
      const response = await inspectionAxios.get<{ users?: any[]; data?: any[] }>(
        "/api/user/get"
      );
      const users = Array.isArray(response.data)
        ? response.data
        : response.data?.users || response.data?.data || [];
      return users.map((u: any) => ({
        value: u.username || u.name || u._id,
        label: u.username || u.name || "Unnamed Supervisor",
      }));
    } catch (error) {
      console.warn("Failed to fetch supervisors:", error);
      return [];
    }
  },
};
