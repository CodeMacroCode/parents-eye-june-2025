import axios from "axios";
import Cookies from "js-cookie";
import { IncidentResponse } from "@/interface/modal";

const incidentApiBase =
  (process.env.NEXT_PUBLIC_API_BASE_URL)+`/api`;

const incidentAxios = axios.create({
  baseURL: incidentApiBase,
  headers: {
    "Content-Type": "application/json",
  },
});

incidentAxios.interceptors.request.use(
  (config) => {
    const token =
      Cookies.get("token") ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const incidentService = {
  getIncidents: async (params: {
    page: number;
    limit: number | string;
    status?: string;
    region?: string;
  }): Promise<IncidentResponse> => {
    const response = await incidentAxios.get<IncidentResponse>("/get-incidents", {
      params,
    });
    return response.data;
  },

  addIncident: async (data: any): Promise<any> => {
    const response = await incidentAxios.post<any>("/add-incident", data);
    return response.data;
  },

  updateIncident: async (id: string, data: any): Promise<any> => {
    const response = await incidentAxios.put<any>(`/update-incident/${id}`, data);
    return response.data;
  },

  updateIncidentStatus: async (id: string, data: any): Promise<any> => {
    const response = await incidentAxios.put<any>(
      `/update-incident-status/${id}`,
      data
    );
    return response.data;
  },
};
