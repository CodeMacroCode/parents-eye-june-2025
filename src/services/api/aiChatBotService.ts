import api from "@/lib/axios";
import { reportService } from "@/services/api/reportService";
import { deviceApiService } from "@/services/api/deviceApiService";
import { routeService } from "@/services/api/routeService";
import { geofenceService } from "@/services/api/geofenceSerevice";
import { subscriptionExpiryService } from "@/services/api/subscriptionExpiry";
import { formatDateToYYYYMMDD } from "@/util/formatDate";

export interface ChatField {
  name: string;
  type?: string;
  label?: string;
  placeholder?: string;
}

export interface ChatQuestion {
  id: number;
  question: string;
  intent?: string;
  function: string;
  fields?: ChatField[];
}

export interface ChatResultItem {
  [key: string]: any;
}

export interface ChatbotExecutionResult {
  title: string;
  summary?: string;
  count?: number;
  type: "table" | "cards" | "key-value" | "empty" | "error";
  data?: ChatResultItem[];
  allData?: ChatResultItem[];
  columns?: { key: string; label: string }[];
  badges?: { label: string; value: string | number; color?: string }[];
  raw?: any;
}

// 26 Hardcoded Questions as specified
export const HARDCODED_QUESTIONS: ChatQuestion[] = [
  {
    id: 101,
    question: "Show all vehicles",
    intent: "devices",
    function: "get_all_devices",
  },
  {
    id: 102,
    question: "Distance report of all vehicles",
    intent: "distance_report",
    function: "get_all_vehicles_distance_report",
  },
  {
    id: 122085011,
    question: "Show specific vehicle Today distance ",
    intent: "specific_vehicle_distance_report",
    function: "get_specific_distance_report",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 3119,
    question: "Specific device km report ",
    intent: "devices",
    function: "get_superadmin_single_vehicle_km_report",
    fields: [
      {
        name: "vehicle_input",
        type: "text",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "Example: MH31FC7874",
      },
    ],
  },
  {
    id: 122086015,
    question: "Show specific vehicle geofences",
    intent: "specific_vehicle_geofences",
    function: "get_specific_vehicle_geofences",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 1720,
    question: "Show geofence reports",
    intent: "geofencereports",
    function: "get_all_geofence_reports",
  },
  {
    id: 1220282009,
    question: "Show specific stopped vehicle",
    intent: "specific_stopped_vehicle",
    function: "get_specific_stopped_vehicle",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 1220822010,
    question: "Show specific vehicle status report",
    intent: "specific_vehicle_status_report",
    function: "get_specific_status_report",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 120208012,
    question: "Show specific vehicle trip report",
    intent: "specific_vehicle_trip_report",
    function: "get_specific_trip_report",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 122208013,
    question: "Show specific vehicle idle report",
    intent: "specific_vehicle_idle_report",
    function: "get_specific_idle_report",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 122080134,
    question: "Show specific vehicle travel summary",
    intent: "specific_vehicle_travel_summary",
    function: "get_specific_travel_summary",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
    ],
  },
  {
    id: 122080135,
    question: "Show vehicle travel summary by date range",
    intent: "vehicle_travel_summary_date_range",
    function: "get_travel_summary_by_date_range",
    fields: [
      {
        name: "vehicle_input",
        label: "Enter Vehicle Name or Unique ID",
        placeholder: "MH05GA1153",
      },
      {
        name: "from_date",
        label: "Enter Start Date",
        placeholder: "4 July 2026",
      },
      {
        name: "to_date",
        label: "Enter End Date",
        placeholder: "9 July 2026",
      },
    ],
  },
];

// In-memory cached devices for fast vehicle resolution
let cachedDevices: any[] | null = null;
let lastCacheTime = 0;

export const getCachedDevices = async (): Promise<any[]> => {
  const now = Date.now();
  if (cachedDevices && now - lastCacheTime < 60000) {
    return cachedDevices;
  }
  try {
    const res = await deviceApiService.getDevices({ page: 1, limit: "all" });
    const list = Array.isArray(res?.devices) ? res.devices : (res as any)?.data || [];
    if (list.length > 0) {
      cachedDevices = list;
      lastCacheTime = now;
      return list;
    }
    throw new Error("Empty list with limit: all");
  } catch {
    try {
      const res = await deviceApiService.getDevices({ page: 1, limit: 10000 });
      const list = Array.isArray(res?.devices) ? res.devices : (res as any)?.data || [];
      cachedDevices = list;
      lastCacheTime = now;
      return list;
    } catch {
      return cachedDevices || [];
    }
  }
};

/**
 * Resolves a user's vehicle input (name, number, imei, or uniqueId) to device and numeric uniqueId
 */
export const resolveVehicle = async (
  input?: string
): Promise<{ uniqueId: number; device: any | null }> => {
  if (!input) return { uniqueId: 0, device: null };
  const trimmed = input.trim();
  const cleanInput = trimmed.toLowerCase();

  const devices = await getCachedDevices();

  // 1. Direct match by uniqueId, name, plate, or imei
  const matched = devices.find((d) => {
    const uId = String(d.uniqueId || "").toLowerCase();
    const name = String(d.deviceName || d.name || "").toLowerCase();
    const plate = String(d.vehicleNo || d.plateNumber || "").toLowerCase();
    const imei = String(d.imei || "").toLowerCase();

    return (
      uId === cleanInput ||
      name === cleanInput ||
      plate === cleanInput ||
      imei === cleanInput ||
      name.includes(cleanInput) ||
      cleanInput.includes(name && name.length > 3 ? name : "___no_match___")
    );
  });

  if (matched && matched.uniqueId) {
    return { uniqueId: Number(matched.uniqueId), device: matched };
  }

  // 2. If input is purely numeric, treat directly as uniqueId
  const parsedNum = Number(cleanInput.replace(/\D/g, ""));
  if (parsedNum && !isNaN(parsedNum)) {
    return { uniqueId: parsedNum, device: matched || null };
  }

  return { uniqueId: 0, device: null };
};

/**
 * Normalizes any free-form date input (e.g., "08-02-2026", "4 July 2026", "2026-07-04") to "YYYY-MM-DD"
 */
export const parseInputDate = (dateStr?: string): string => {
  if (!dateStr || !dateStr.trim()) {
    return formatDateToYYYYMMDD(new Date()) || "";
  }

  const trimmed = dateStr.trim();

  // Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Check YYYY-MM-DD
  const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, "0");
    const day = yyyymmdd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Natural language date (e.g., "4 July 2026")
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return formatDateToYYYYMMDD(parsed) || "";
  }

  return formatDateToYYYYMMDD(new Date()) || "";
};

/**
 * Dispatches chatbot functions and calls the appropriate report/master APIs
 */
export const executeChatbotFunction = async (
  funcName: string,
  fieldValues: Record<string, string> = {}
): Promise<ChatbotExecutionResult> => {
  const todayStr = formatDateToYYYYMMDD(new Date()) || "";

  try {
    switch (funcName) {
      // 1. Show all vehicles
      case "get_all_devices": {
        const devices = await getCachedDevices();
        if (!devices || devices.length === 0) {
          return {
            title: "All Vehicles",
            type: "empty",
            summary: "No vehicles found in the system.",
            count: 0,
          };
        }

        const allVehicleData = devices.map((d) => ({
          name: d.deviceName || d.name || "Unnamed Vehicle",
          uniqueId: d.uniqueId || "--",
          sim: d.sim || d.phone || d.simNumber || d.simNo || "--",
          imei: d.imei || "--",
          status: d.status || "offline",
          speed: `${d.speed ?? 0} km/h`,
          branch: d.branchId?.branchName || d.branchName || "--",
        }));

        return {
          title: "All Vehicles",
          type: "table",
          count: devices.length,
          summary: `Found ${devices.length} registered vehicles.`,
          columns: [
            { key: "name", label: "Vehicle" },
            { key: "uniqueId", label: "Unique ID" },
            { key: "sim", label: "SIM Number" },
            { key: "status", label: "Status" },
            { key: "speed", label: "Speed" },
            { key: "branch", label: "Branch" },
          ],
          data: allVehicleData.slice(0, 50),
          allData: allVehicleData,
        };
      }

      // Distance report of all vehicles
      case "get_all_vehicles_distance_report": {
        const devices = await getCachedDevices();
        if (!devices || devices.length === 0) {
          return {
            title: "Distance Report (All Vehicles)",
            type: "empty",
            summary: "No vehicles found in the system.",
            count: 0,
          };
        }

        const uniqueIds = devices
          .map((d) => Number(d.uniqueId))
          .filter((id) => !isNaN(id) && id > 0);

        let rows: any[] = [];
        try {
          const res = await reportService.getDistanceReport({
            uniqueIds,
            page: 1,
            limit: "all",
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          const rawData = res?.data ?? res ?? [];
          rows = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : []);
        } catch (err) {
          console.error("Failed to fetch distance report for all vehicles:", err);
        }

        // Create lookup map for distance records by uniqueId and vehicle name
        const distanceMap = new Map<string, any>();
        if (Array.isArray(rows)) {
          rows.forEach((r: any) => {
            if (r.uniqueId != null) {
              distanceMap.set(String(r.uniqueId), r);
            }
            if (r.name) {
              distanceMap.set(String(r.name).toLowerCase().trim(), r);
            }
          });
        }

        // Map every vehicle with its distance and metadata
        const allDistanceData = devices.map((d) => {
          const dist =
            distanceMap.get(String(d.uniqueId)) ||
            distanceMap.get(String(d.deviceName || "").toLowerCase().trim()) ||
            distanceMap.get(String(d.name || "").toLowerCase().trim());

          const rawKm = dist?.totalKm ?? dist?.distance ?? 0;
          const numKm = typeof rawKm === "number" ? rawKm : parseFloat(String(rawKm)) || 0;

          return {
            name: d.deviceName || d.name || "Unnamed Vehicle",
            uniqueId: d.uniqueId || "--",
            sim: d.sim || d.phone || d.simNumber || d.simNo || "--",
            totalKm: `${numKm.toFixed(2)} km`,
            _numKm: numKm,
            status: d.status || "offline",
            speed: `${d.speed ?? 0} km/h`,
            branch: d.branchId?.branchName || d.branchName || "--",
          };
        });

        // Sort vehicles by distance traveled descending
        allDistanceData.sort((a, b) => b._numKm - a._numKm);

        // Remove temporary sorting helper
        const cleanedData = allDistanceData.map(({ _numKm, ...rest }) => rest);

        const totalFleetKm = allDistanceData.reduce((acc, r) => acc + r._numKm, 0);
        const movingCount = allDistanceData.filter((r) => r._numKm > 0).length;

        return {
          title: `Distance Report - All Vehicles (${todayStr})`,
          type: "table",
          count: cleanedData.length,
          summary: `Found ${cleanedData.length} vehicles. Fleet distance today: ${totalFleetKm.toFixed(2)} km across ${movingCount} active vehicles.`,
          columns: [
            { key: "name", label: "Vehicle" },
            { key: "uniqueId", label: "Unique ID" },
            { key: "sim", label: "SIM Number" },
            { key: "totalKm", label: "Today Distance" },
            { key: "status", label: "Status" },
            { key: "speed", label: "Speed" },
            { key: "branch", label: "Branch" },
          ],
          data: cleanedData.slice(0, 50),
          allData: cleanedData,
        };
      }

      // 2. Show specific vehicle
      case "get_superadmin_vehicle_details": {
        const input = fieldValues.vehicle_input || "";
        const { uniqueId, device } = await resolveVehicle(input);

        if (!uniqueId && !device) {
          return {
            title: "Vehicle Details",
            type: "empty",
            summary: `Could not find any vehicle matching "${input}". Please check the vehicle name or unique ID.`,
          };
        }

        const d = device || {};
        return {
          title: `Vehicle Details: ${d.deviceName || d.name || uniqueId}`,
          type: "cards",
          summary: `Showing details for vehicle ${d.deviceName || d.name || uniqueId}.`,
          badges: [
            { label: "Status", value: d.status || "offline", color: d.status === "running" ? "green" : "amber" },
            { label: "Speed", value: `${d.speed ?? 0} km/h` },
            { label: "Unique ID", value: uniqueId },
          ],
          data: [
            {
              "Vehicle Name": d.deviceName || d.name || "--",
              "Unique ID": uniqueId,
              "SIM Number": d.sim || d.phone || d.simNumber || d.simNo || "--",
              "IMEI": d.imei || "--",
              "Plate Number": d.vehicleNo || d.plateNumber || "--",
              "Status": d.status || "--",
              "Ignition": d.ignition ? "ON" : "OFF",
              "Speed": `${d.speed ?? 0} km/h`,
              "Branch": d.branchId?.branchName || d.branchName || "--",
              "School": d.schoolId?.schoolName || d.schoolName || "--",
              "Last Updated": d.lastUpdate || d.updatedAt ? new Date(d.lastUpdate || d.updatedAt).toLocaleString() : "--",
            },
          ],
        };
      }

      // 3. Show Admin (Schools)
      case "find_school_superadmin": {
        const res = await api.get("/school");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.schools || [];
        if (!list.length) {
          return {
            title: "Admin / Schools",
            type: "empty",
            summary: "No school admins found.",
          };
        }

        const data = list.map((s: any) => ({
          name: s.schoolName || s.name || "--",
          contactPerson: s.contactPerson || s.adminName || s.name || "--",
          email: s.email || "--",
          phone: s.mobileNo || s.phone || s.contactNumber || "--",
          address: s.address || "--",
        }));

        return {
          title: "School Admins",
          type: "table",
          count: list.length,
          summary: `Found ${list.length} school administrative accounts.`,
          columns: [
            { key: "name", label: "School Name" },
            { key: "contactPerson", label: "Admin" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
          ],
          data,
        };
      }

      // 4. Show Users (Branches)
      case "find_branch_superadmin": {
        const res = await api.get("/branch");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.branches || [];
        if (!list.length) {
          return {
            title: "Branch Users",
            type: "empty",
            summary: "No branch users found.",
          };
        }

        const data = list.map((b: any) => ({
          branchName: b.branchName || b.name || "--",
          contactPerson: b.contactPerson || b.userName || "--",
          email: b.email || "--",
          phone: b.mobileNo || b.phone || "--",
          school: b.schoolId?.schoolName || b.schoolName || "--",
        }));

        return {
          title: "Branch Users",
          type: "table",
          count: list.length,
          summary: `Found ${list.length} branch user profiles.`,
          columns: [
            { key: "branchName", label: "Branch Name" },
            { key: "contactPerson", label: "Contact Person" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "school", label: "School" },
          ],
          data,
        };
      }

      // 5. Show Groups
      case "get_all_branch_groups_profile": {
        const res = await api.get("/branchGroup");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.branchGroups || [];
        if (!list.length) {
          return {
            title: "Branch Groups",
            type: "empty",
            summary: "No branch groups found.",
          };
        }

        const data = list.map((g: any) => ({
          groupName: g.branchGroupName || g.name || "--",
          branchesCount: Array.isArray(g.branches) ? g.branches.length : g.branchCount || "--",
          description: g.description || "--",
          createdAt: g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "--",
        }));

        return {
          title: "Branch Groups",
          type: "table",
          count: list.length,
          summary: `Found ${list.length} branch groups.`,
          columns: [
            { key: "groupName", label: "Group Name" },
            { key: "branchesCount", label: "Branches Count" },
            { key: "description", label: "Description" },
          ],
          data,
        };
      }

      // 6. Show Specific User (Branch)
      case "find_specific_branch_superadmin": {
        const branchInput = (fieldValues.branch_name || "").toLowerCase().trim();
        const res = await api.get("/branch");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.branches || [];

        const matched = list.filter((b: any) => {
          const name = String(b.branchName || b.name || "").toLowerCase();
          const id = String(b._id || "").toLowerCase();
          return name.includes(branchInput) || id.includes(branchInput);
        });

        if (!matched.length) {
          return {
            title: "Specific User / Branch",
            type: "empty",
            summary: `No branch found matching "${fieldValues.branch_name}".`,
          };
        }

        return {
          title: `Branch Details: ${matched[0].branchName || fieldValues.branch_name}`,
          type: "cards",
          summary: `Found ${matched.length} branch record(s).`,
          data: matched.map((b: any) => ({
            "Branch Name": b.branchName || b.name || "--",
            "Contact Person": b.contactPerson || "--",
            "Email": b.email || "--",
            "Mobile": b.mobileNo || b.phone || "--",
            "School": b.schoolId?.schoolName || b.schoolName || "--",
            "Address": b.address || "--",
          })),
        };
      }

      // 7. Show Specific Admin (School)
      case "find_specific_school_superadmin": {
        const schoolInput = (fieldValues.school_name || "").toLowerCase().trim();
        const res = await api.get("/school");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.schools || [];

        const matched = list.filter((s: any) => {
          const name = String(s.schoolName || s.name || "").toLowerCase();
          const id = String(s._id || "").toLowerCase();
          return name.includes(schoolInput) || id.includes(schoolInput);
        });

        if (!matched.length) {
          return {
            title: "Specific School Admin",
            type: "empty",
            summary: `No school found matching "${fieldValues.school_name}".`,
          };
        }

        return {
          title: `School Admin: ${matched[0].schoolName || fieldValues.school_name}`,
          type: "cards",
          summary: `Found ${matched.length} school record(s).`,
          data: matched.map((s: any) => ({
            "School Name": s.schoolName || s.name || "--",
            "Admin Name": s.contactPerson || s.adminName || "--",
            "Email": s.email || "--",
            "Phone": s.mobileNo || s.phone || "--",
            "Address": s.address || "--",
          })),
        };
      }

      // 8. Show Specific Group
      case "get_specific_branch_group_profile": {
        const groupInput = (fieldValues.branchgroup_input || "").toLowerCase().trim();
        const res = await api.get("/branchGroup");
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.branchGroups || [];

        const matched = list.filter((g: any) => {
          const name = String(g.branchGroupName || g.name || "").toLowerCase();
          return name.includes(groupInput);
        });

        if (!matched.length) {
          return {
            title: "Specific Branch Group",
            type: "empty",
            summary: `No group found matching "${fieldValues.branchgroup_input}".`,
          };
        }

        return {
          title: `Branch Group: ${matched[0].branchGroupName || fieldValues.branchgroup_input}`,
          type: "cards",
          summary: `Showing information for ${matched[0].branchGroupName || fieldValues.branchgroup_input}.`,
          data: matched.map((g: any) => ({
            "Group Name": g.branchGroupName || g.name || "--",
            "Branches Count": Array.isArray(g.branches) ? g.branches.length : g.branchCount || "--",
            "Description": g.description || "--",
          })),
        };
      }

      // 9. Show specific vehicle Today distance
      case "get_specific_distance_report": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Today's Distance Report",
            type: "empty",
            summary: `Could not identify vehicle from "${fieldValues.vehicle_input}". Please verify the vehicle name or ID.`,
          };
        }

        const res = await reportService.getDistanceReport({
          uniqueIds: [uniqueId],
          page: 1,
          limit: 10,
          period: "Today",
          from: todayStr,
          to: todayStr,
        });

        const rows = res?.data ?? res ?? [];
        const firstRow = Array.isArray(rows) ? rows[0] : rows;
        const totalKm = firstRow?.totalKm ?? firstRow?.distance ?? 0;

        return {
          title: `Today's Distance: ${device?.deviceName || device?.name || uniqueId}`,
          type: "cards",
          summary: `Vehicle ${device?.deviceName || uniqueId} covered ${totalKm} km today (${todayStr}).`,
          badges: [
            { label: "Distance Today", value: `${totalKm} KM`, color: "blue" },
            { label: "Status", value: device?.status || "Active", color: "green" },
          ],
          data: [
            {
              "Vehicle Name": device?.deviceName || device?.name || firstRow?.name || "--",
              "Unique ID": uniqueId,
              "Date": todayStr,
              "Total KM": `${totalKm} km`,
              "Start Odometer": firstRow?.startOdometer || "--",
              "End Odometer": firstRow?.endOdometer || "--",
            },
          ],
        };
      }

      // 10. Specific device km report
      case "get_superadmin_single_vehicle_km_report": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Vehicle KM Report",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        const res = await reportService.getDistanceReport({
          uniqueIds: [uniqueId],
          page: 1,
          limit: 20,
          period: "Today",
          from: todayStr,
          to: todayStr,
        });

        const rows = res?.data ?? res ?? [];
        const row = Array.isArray(rows) ? rows[0] : rows;
        const km = row?.totalKm ?? row?.distance ?? 0;

        return {
          title: `KM Report: ${device?.deviceName || device?.name || uniqueId}`,
          type: "cards",
          summary: `KM statistics for vehicle ${device?.deviceName || uniqueId}.`,
          badges: [
            { label: "Today Distance", value: `${km} KM`, color: "blue" },
            { label: "Unique ID", value: uniqueId },
          ],
          data: [
            {
              "Vehicle Name": device?.deviceName || device?.name || "--",
              "Unique ID": uniqueId,
              "Total KM Traveled": `${km} KM`,
              "Plate Number": device?.vehicleNo || "--",
              "Branch": device?.branchId?.branchName || device?.branchName || "--",
            },
          ],
        };
      }

      // 11. Show vehicle KM report for a specific date
      case "get_superadmin_vehicle_distance_by_date": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        const parsedDate = parseInputDate(fieldValues.report_date);

        if (!uniqueId) {
          return {
            title: "KM Report by Date",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        const res = await reportService.getDistanceReport({
          uniqueIds: [uniqueId],
          page: 1,
          limit: 10,
          period: "Custom",
          from: parsedDate,
          to: parsedDate,
        });

        const rows = res?.data ?? res ?? [];
        const row = Array.isArray(rows) ? rows[0] : rows;
        const totalKm = row?.totalKm ?? row?.distance ?? 0;

        return {
          title: `KM Report for ${parsedDate}: ${device?.deviceName || uniqueId}`,
          type: "cards",
          summary: `Distance recorded on ${parsedDate} is ${totalKm} KM.`,
          badges: [
            { label: "Date", value: parsedDate },
            { label: "Distance", value: `${totalKm} KM`, color: "blue" },
          ],
          data: [
            {
              "Vehicle": device?.deviceName || device?.name || uniqueId,
              "Date": parsedDate,
              "Total KM": `${totalKm} km`,
              "Unique ID": uniqueId,
            },
          ],
        };
      }

      // 12. Show specific vehicle last position
      case "get_specific_vehicle_last_position": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!device && !uniqueId) {
          return {
            title: "Vehicle Last Position",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" was not found.`,
          };
        }

        const lat = device?.latitude ?? device?.position?.latitude ?? device?.lat;
        const lng = device?.longitude ?? device?.position?.longitude ?? device?.lng;
        const speed = device?.speed ?? 0;
        const status = device?.status ?? "unknown";
        const lastUpdate = device?.lastUpdate || device?.updatedAt;

        return {
          title: `Last Position: ${device?.deviceName || device?.name || uniqueId}`,
          type: "cards",
          summary: `Current known coordinates and status for ${device?.deviceName || uniqueId}.`,
          badges: [
            { label: "Status", value: status, color: status === "running" ? "green" : "amber" },
            { label: "Speed", value: `${speed} km/h` },
          ],
          data: [
            {
              "Vehicle": device?.deviceName || device?.name || uniqueId,
              "Unique ID": uniqueId,
              "SIM Number": device?.sim || device?.phone || device?.simNumber || device?.simNo || "--",
              "Coordinates": lat && lng ? `${lat}, ${lng}` : "Location unavailable",
              "Latitude": lat || "--",
              "Longitude": lng || "--",
              "Speed": `${speed} km/h`,
              "Ignition": device?.ignition ? "ON" : "OFF",
              "Last Ping": lastUpdate ? new Date(lastUpdate).toLocaleString() : "Recent",
              "Branch": device?.branchId?.branchName || device?.branchName || "--",
            },
          ],
        };
      }

      // 13. Show specific vehicle geofences
      case "get_specific_vehicle_geofences": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Vehicle Geofences",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" was not found.`,
          };
        }

        let geofences: any[] = [];
        try {
          const res = await geofenceService.getGeofenceByUniqueId({ uniqueId });
          geofences = Array.isArray(res) ? res : (res as any)?.data || [];
        } catch {
          const allG = await geofenceService.getGeofence({ page: 1, limit: 50 });
          geofences = Array.isArray(allG?.data) ? allG.data : [];
        }

        if (!geofences.length) {
          return {
            title: `Geofences: ${device?.deviceName || uniqueId}`,
            type: "empty",
            summary: `No geofences currently assigned or detected for vehicle ${device?.deviceName || uniqueId}.`,
          };
        }

        return {
          title: `Geofences: ${device?.deviceName || uniqueId}`,
          type: "table",
          count: geofences.length,
          summary: `Found ${geofences.length} geofence(s).`,
          columns: [
            { key: "name", label: "Geofence Name" },
            { key: "type", label: "Type" },
            { key: "radius", label: "Radius / Area" },
          ],
          data: geofences.map((g: any) => ({
            name: g.name || g.geofenceName || "--",
            type: g.type || g.shape || "Circle",
            radius: g.radius ? `${g.radius}m` : "--",
          })),
        };
      }

      // 14. Show geofence reports
      case "get_all_geofence_reports": {
        let rows: any[] = [];
        try {
          const res = await reportService.getGeofenceAlertsReport({
            page: 1,
            limit: "all",
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          rows = res?.data ?? res ?? [];
        } catch {
          const alt = await api.get("/report/geofenceevent?limit=all");
          rows = alt?.data?.data ?? alt?.data ?? [];
        }

        if (!rows.length) {
          return {
            title: "Geofence Reports",
            type: "empty",
            summary: "No geofence breach events recorded for today.",
          };
        }

        const allEvents = rows.map((r: any) => ({
          vehicle: r.deviceName || r.name || r.uniqueId || "--",
          geofence: r.geofenceName || r.geofence || "--",
          event: r.event || r.status || "IN / OUT",
          time: r.timestamp || r.time ? new Date(r.timestamp || r.time).toLocaleString() : "--",
        }));

        return {
          title: "Geofence Events Report",
          type: "table",
          count: rows.length,
          summary: `Recorded ${rows.length} geofence transition event(s) today.`,
          columns: [
            { key: "vehicle", label: "Vehicle" },
            { key: "geofence", label: "Geofence" },
            { key: "event", label: "Event" },
            { key: "time", label: "Timestamp" },
          ],
          data: allEvents.slice(0, 50),
          allData: allEvents,
        };
      }

      // 15. Show specific active vehicle
      case "get_specific_active_vehicle": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!device && !uniqueId) {
          return {
            title: "Active Vehicle Status",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        const isRunning = device?.status === "running" || (device?.speed ?? 0) > 0;
        return {
          title: `Active Status: ${device?.deviceName || device?.name || uniqueId}`,
          type: "cards",
          summary: isRunning
            ? `Vehicle is actively RUNNING at ${device?.speed || 0} km/h.`
            : `Vehicle is currently ${device?.status?.toUpperCase() || "STOPPED"}.`,
          badges: [
            {
              label: "Status",
              value: device?.status || (isRunning ? "running" : "stopped"),
              color: isRunning ? "green" : "amber",
            },
            { label: "Current Speed", value: `${device?.speed ?? 0} km/h` },
          ],
          data: [
            {
              "Vehicle Name": device?.deviceName || device?.name || uniqueId,
              "SIM Number": device?.sim || device?.phone || device?.simNumber || device?.simNo || "--",
              "Is Active / Running": isRunning ? "Yes" : "No",
              "Current Status": device?.status || "--",
              "Speed": `${device?.speed ?? 0} km/h`,
              "Ignition": device?.ignition ? "ON" : "OFF",
              "Last Communication": device?.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : "--",
            },
          ],
        };
      }

      // 16. Show specific stopped vehicle
      case "get_specific_stopped_vehicle": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Stopped Vehicle Details",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let stopRecords: any[] = [];
        try {
          const res = await reportService.getStopReport({
            uniqueId,
            page: 1,
            limit: "all",
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          stopRecords = res?.data ?? res ?? [];
        } catch {
          // Fallback to device stop state
        }

        const isStopped = device?.status === "stopped";
        const allStopData = stopRecords.length > 0
          ? stopRecords.map((s: any, idx: number) => ({
              "Stop #": idx + 1,
              "Start Time": s.startTime ? new Date(s.startTime).toLocaleTimeString() : "--",
              "End Time": s.endTime ? new Date(s.endTime).toLocaleTimeString() : "--",
              "Duration": s.duration || s.totalDuration || "--",
              "Location": s.address || s.location || "--",
            }))
          : [
              {
                "Vehicle": device?.deviceName || uniqueId,
                "SIM Number": device?.sim || device?.phone || device?.simNumber || device?.simNo || "--",
                "Current Status": device?.status || "stopped",
                "Ignition": device?.ignition ? "ON" : "OFF",
                "Last Stopped Location": device?.address || "--",
              },
            ];

        return {
          title: `Stop Report: ${device?.deviceName || uniqueId}`,
          type: "cards",
          summary: isStopped
            ? `Vehicle ${device?.deviceName || uniqueId} is currently STOPPED.`
            : `Vehicle ${device?.deviceName || uniqueId} has recorded ${stopRecords.length} stops today.`,
          badges: [
            { label: "Current State", value: device?.status || "stopped", color: isStopped ? "red" : "blue" },
            { label: "Stops Today", value: stopRecords.length },
          ],
          data: allStopData.slice(0, 5),
          allData: allStopData,
        };
      }

      // 17. Show specific vehicle status report
      case "get_specific_status_report": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Vehicle Status Report",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let statusData: any[] = [];
        try {
          const res = await reportService.getStatusReport({
            uniqueId,
            page: 1,
            limit: "all",
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          statusData = res?.data ?? res ?? [];
        } catch {
          // Fallback
        }

        const allStatusRows = statusData.length > 0
          ? statusData.map((st: any) => ({
              status: st.status || "--",
              startTime: st.startTime ? new Date(st.startTime).toLocaleTimeString() : "--",
              endTime: st.endTime ? new Date(st.endTime).toLocaleTimeString() : "--",
              duration: st.duration || "--",
            }))
          : [
              {
                status: device?.status || "online",
                startTime: "Live",
                endTime: "Now",
                duration: "--",
              },
            ];

        return {
          title: `Status Report: ${device?.deviceName || uniqueId}`,
          type: "table",
          count: statusData.length,
          summary: `Showing status timeline records for today.`,
          badges: [
            { label: "Live Status", value: device?.status || "online", color: "green" },
            { label: "Events Recorded", value: statusData.length },
          ],
          columns: [
            { key: "status", label: "Status" },
            { key: "startTime", label: "Start Time" },
            { key: "endTime", label: "End Time" },
            { key: "duration", label: "Duration" },
          ],
          data: allStatusRows.slice(0, 50),
          allData: allStatusRows,
        };
      }

      // 18. Show specific vehicle trip report
      case "get_specific_trip_report": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Trip Report",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let trips: any[] = [];
        try {
          const res = await reportService.getTripReport({
            uniqueId,
            period: "Today",
            from: todayStr,
            to: todayStr,
            limit: "all",
          });
          trips = res?.data ?? res ?? [];
        } catch {
          // Fallback
        }

        if (!trips.length) {
          return {
            title: `Trip Report: ${device?.deviceName || uniqueId}`,
            type: "empty",
            summary: `No completed trips recorded today for vehicle ${device?.deviceName || uniqueId}.`,
          };
        }

        const allTripRows = trips.map((t: any) => ({
          start: t.startTime ? new Date(t.startTime).toLocaleTimeString() : "--",
          end: t.endTime ? new Date(t.endTime).toLocaleTimeString() : "--",
          distance: `${t.distance ?? 0} km`,
          duration: t.duration || "--",
          maxSpeed: `${t.maxSpeed ?? 0} km/h`,
        }));

        return {
          title: `Trip Summary: ${device?.deviceName || uniqueId}`,
          type: "table",
          count: trips.length,
          summary: `Found ${trips.length} trip(s) today.`,
          columns: [
            { key: "start", label: "Start Time" },
            { key: "end", label: "End Time" },
            { key: "distance", label: "Distance" },
            { key: "duration", label: "Duration" },
            { key: "maxSpeed", label: "Max Speed" },
          ],
          data: allTripRows.slice(0, 50),
          allData: allTripRows,
        };
      }

      // 19. Show specific vehicle idle report
      case "get_specific_idle_report": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Idle Report",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let idleRows: any[] = [];
        try {
          const res = await reportService.getIdleReport({
            uniqueId,
            page: 1,
            limit: "all",
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          idleRows = res?.data ?? res ?? [];
        } catch {
          // Fallback
        }

        const allIdleData = idleRows.length > 0
          ? idleRows.map((r: any) => ({
              startTime: r.startTime ? new Date(r.startTime).toLocaleTimeString() : "--",
              endTime: r.endTime ? new Date(r.endTime).toLocaleTimeString() : "--",
              duration: r.duration || "--",
              location: r.address || r.location || "--",
            }))
          : [
              {
                "Vehicle": device?.deviceName || uniqueId,
                "Status": "Normal / Not idling",
                "Ignition": device?.ignition ? "ON" : "OFF",
              },
            ];

        return {
          title: `Idle Report: ${device?.deviceName || uniqueId}`,
          type: idleRows.length > 0 ? "table" : "cards",
          count: idleRows.length,
          summary: idleRows.length > 0
            ? `Vehicle experienced ${idleRows.length} idle periods today.`
            : `No idle periods logged today for ${device?.deviceName || uniqueId}.`,
          badges: [
            { label: "Idle Count", value: idleRows.length },
            { label: "Current Status", value: device?.status || "--" },
          ],
          columns: [
            { key: "startTime", label: "Started" },
            { key: "endTime", label: "Ended" },
            { key: "duration", label: "Duration" },
            { key: "location", label: "Location" },
          ],
          data: allIdleData.slice(0, 50),
          allData: allIdleData,
        };
      }

      // 20. Show specific vehicle travel summary
      case "get_specific_travel_summary": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        if (!uniqueId) {
          return {
            title: "Travel Summary",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let summaryData: any = null;
        try {
          const res = await reportService.getTravelSummaryReport({
            uniqueIds: [uniqueId],
            page: 1,
            limit: 10,
            period: "Today",
            from: todayStr,
            to: todayStr,
          });
          const rows = res?.data ?? res ?? [];
          summaryData = Array.isArray(rows) ? rows[0] : rows;
        } catch {
          // Fallback
        }

        return {
          title: `Travel Summary: ${device?.deviceName || uniqueId}`,
          type: "cards",
          summary: `Summary of operation today (${todayStr}).`,
          badges: [
            { label: "Distance", value: `${summaryData?.distance ?? 0} KM`, color: "blue" },
            { label: "Running Time", value: summaryData?.running || "--", color: "green" },
            { label: "Max Speed", value: `${summaryData?.maxSpeed ?? 0} km/h` },
          ],
          data: [
            {
              "Vehicle Name": device?.deviceName || device?.name || uniqueId,
              "Total Distance": `${summaryData?.distance ?? 0} km`,
              "Running Duration": summaryData?.running || "--",
              "Idle Duration": summaryData?.idle || "--",
              "Stopped Duration": summaryData?.stopped || "--",
              "Max Speed": `${summaryData?.maxSpeed ?? 0} km/h`,
              "Average Speed": `${summaryData?.avgSpeed ?? 0} km/h`,
              "Overspeed Count": summaryData?.overspeed || 0,
            },
          ],
        };
      }

      // 21. Show vehicle travel summary by date range
      case "get_travel_summary_by_date_range": {
        const { uniqueId, device } = await resolveVehicle(fieldValues.vehicle_input);
        const fromDate = parseInputDate(fieldValues.from_date);
        const toDate = parseInputDate(fieldValues.to_date);

        if (!uniqueId) {
          return {
            title: "Travel Summary by Range",
            type: "empty",
            summary: `Vehicle "${fieldValues.vehicle_input}" not found.`,
          };
        }

        let rangeSummary: any = null;
        try {
          const res = await reportService.getTravelSummaryReport({
            uniqueIds: [uniqueId],
            page: 1,
            limit: 10,
            period: "Custom",
            from: fromDate,
            to: toDate,
          });
          const rows = res?.data ?? res ?? [];
          rangeSummary = Array.isArray(rows) ? rows[0] : rows;
        } catch {
          // Fallback
        }

        return {
          title: `Travel Range (${fromDate} to ${toDate})`,
          type: "cards",
          summary: `Performance summary between ${fromDate} and ${toDate}.`,
          badges: [
            { label: "Distance", value: `${rangeSummary?.distance ?? 0} KM`, color: "blue" },
            { label: "Max Speed", value: `${rangeSummary?.maxSpeed ?? 0} km/h` },
          ],
          data: [
            {
              "Vehicle": device?.deviceName || device?.name || uniqueId,
              "Date Range": `${fromDate} - ${toDate}`,
              "Total Distance": `${rangeSummary?.distance ?? 0} km`,
              "Running Time": rangeSummary?.running || "--",
              "Idle Time": rangeSummary?.idle || "--",
              "Stopped Time": rangeSummary?.stopped || "--",
              "Max Speed": `${rangeSummary?.maxSpeed ?? 0} km/h`,
              "Avg Speed": `${rangeSummary?.avgSpeed ?? 0} km/h`,
            },
          ],
        };
      }

      // 22. Show routes
      case "get_superadmin_route_profile": {
        let routes: any[] = [];
        try {
          const res = await routeService.getRoutes({ page: 1, limit: "all" });
          routes = Array.isArray(res?.data) ? res.data : (res as any)?.routes || [];
        } catch {
          const res = await routeService.getRoutes({ page: 1, limit: 10000 });
          routes = Array.isArray(res?.data) ? res.data : (res as any)?.routes || [];
        }

        if (!routes.length) {
          return {
            title: "Fleet Routes",
            type: "empty",
            summary: "No routes currently configured.",
          };
        }

        const allRoutes = routes.map((r: any) => ({
          name: r.routeName || r.name || "--",
          start: r.startPoint?.name || r.startLocation || "--",
          end: r.endPoint?.name || r.endLocation || "--",
          distance: r.distance ? `${r.distance} km` : "--",
        }));

        return {
          title: "Fleet Routes",
          type: "table",
          count: routes.length,
          summary: `Found ${routes.length} configured routes.`,
          columns: [
            { key: "name", label: "Route Name" },
            { key: "start", label: "Start Location" },
            { key: "end", label: "End Location" },
            { key: "distance", label: "Distance" },
          ],
          data: allRoutes.slice(0, 50),
          allData: allRoutes,
        };
      }

      // 23. Show subscriptions
      case "get_all_subscriptions": {
        let subs: any[] = [];
        try {
          const res = await subscriptionExpiryService.getSubscriptionExpiry();
          subs = Array.isArray(res?.data) ? res.data : [];
        } catch {
          const alt = await api.get("/branch/subscription/expired");
          subs = Array.isArray(alt.data?.data) ? alt.data.data : [];
        }

        if (!subs.length) {
          return {
            title: "Active Subscriptions",
            type: "cards",
            summary: "All branches and devices currently have active subscriptions. No expired accounts found.",
            badges: [{ label: "Status", value: "All Active", color: "green" }],
            data: [
              {
                "Subscription Status": "All accounts in good standing",
                "Expired Count": 0,
                "Next Steps": "No renewals currently overdue.",
              },
            ],
          };
        }

        return {
          title: "Subscription Status",
          type: "table",
          count: subs.length,
          summary: `Detected ${subs.length} branch subscription(s) requiring attention.`,
          badges: [{ label: "Expired Accounts", value: subs.length, color: "red" }],
          columns: [
            { key: "branch", label: "Branch" },
            { key: "school", label: "School" },
            { key: "expiry", label: "Expiration Date" },
          ],
          data: subs.map((s: any) => ({
            branch: s.branchName || s.name || "--",
            school: s.schoolId?.schoolName || s.schoolName || "--",
            expiry: s.expirationDate ? new Date(s.expirationDate).toLocaleDateString() : "--",
          })),
        };
      }

      // 24. Show subscription history
      case "get_all_subscription_history": {
        let hist: any[] = [];
        try {
          const res = await api.get("/subscription/history");
          hist = Array.isArray(res.data) ? res.data : (res.data as any)?.history || [];
        } catch {
          // Fallback to expired subscriptions list as historical data
          const subRes = await subscriptionExpiryService.getSubscriptionExpiry().catch(() => null);
          hist = Array.isArray(subRes?.data) ? subRes.data : [];
        }

        if (!hist.length) {
          return {
            title: "Subscription History",
            type: "empty",
            summary: "No historical subscription logs available.",
          };
        }

        return {
          title: "Subscription History",
          type: "table",
          count: hist.length,
          summary: `Showing ${hist.length} subscription log entries.`,
          columns: [
            { key: "branch", label: "Branch" },
            { key: "date", label: "Date" },
            { key: "status", label: "Status" },
          ],
          data: hist.map((h: any) => ({
            branch: h.branchName || h.name || "--",
            date: h.createdAt || h.expirationDate ? new Date(h.createdAt || h.expirationDate).toLocaleDateString() : "--",
            status: h.status || "Expired / Renewed",
          })),
        };
      }

      // 25. Show tickets
      case "get_all_tickets": {
        const res = await api.get("/get-tickets?page=1&limit=20");
        const tickets = Array.isArray(res.data?.tickets)
          ? res.data.tickets
          : Array.isArray(res.data)
          ? res.data
          : [];

        if (!tickets.length) {
          return {
            title: "Support Tickets",
            type: "empty",
            summary: "No support tickets found.",
          };
        }

        return {
          title: "Support Tickets",
          type: "table",
          count: tickets.length,
          summary: `Found ${tickets.length} recent support ticket(s).`,
          columns: [
            { key: "id", label: "Ticket ID" },
            { key: "status", label: "Status" },
            { key: "desc", label: "Description" },
            { key: "role", label: "Role" },
          ],
          data: tickets.map((t: any) => ({
            id: t.ticket_id || t._id?.slice(-6) || "--",
            status: t.status || "Open",
            desc: t.description || "--",
            role: t.role || "--",
          })),
        };
      }

      // 26. Show user sessions
      case "get_all_sessions": {
        return {
          title: "Active User Sessions",
          type: "cards",
          summary: "Current session and authentication status.",
          badges: [{ label: "Session", value: "Active", color: "green" }],
          data: [
            {
              "Authentication": "Logged In",
              "Status": "Online",
              "Client": typeof window !== "undefined" ? window.navigator.userAgent.slice(0, 40) + "..." : "Browser",
              "Timestamp": new Date().toLocaleString(),
            },
          ],
        };
      }

      default:
        return {
          title: "Query Response",
          type: "empty",
          summary: `No handler implemented for function: ${funcName}`,
        };
    }
  } catch (error: any) {
    console.error(`Error executing chatbot function ${funcName}:`, error);
    return {
      title: "Query Error",
      type: "error",
      summary: error?.response?.data?.message || error?.message || "Failed to retrieve data from server.",
    };
  }
};
