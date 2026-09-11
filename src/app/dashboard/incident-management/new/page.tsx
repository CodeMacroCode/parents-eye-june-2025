"use client";

import React, { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { incidentService } from "@/services/api/incidentService";
import { api } from "@/services/apiService";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useBranchDropdown, useSchoolDropdown } from "@/hooks/useDropdown";

const CATEGORIES = ["Incident", "Near Miss", "Hazard & Risk"];
const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const REPORTED_BY_OPTIONS = ["RSO", "Business Manager", "AOM"];
const STAKEHOLDERS_OPTIONS = [
  "Regional Safety Officer", "Business Manager", "Academic Operation Manager"
];
const SUB_CATEGORIES = [
  "Fire", "Infrastructure", "Transport", "Behavioural", "Classroom",
  "Play Area", "Laboratory", "Electrical", "Unattended Children",
  "CCTV", "BGV", "Health & Hygiene", "Bullying", "Theft", "Other:"
];
const STATUS_OPTIONS = ["Open", "Closed"];
// Static regions removed in favor of dynamic Branch Groups
const REGIONS = [
  "Mumbai", "Pune", "Gudgaon", "Bangalore", "Nagpur", "Hyderabad", "Vadodara", "Other"
];
const ESCALATION_OPTIONS = ["Yes", "No"];

export default function NewIncidentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { decodedToken: user } = useAuthStore();
  const userRole = user?.role?.toLowerCase();

  // Fetch Branch Groups
  const { data: branchGroups } = useQuery({
    queryKey: ["branchGroups"],
    queryFn: () => api.get<any[]>("/branchGroup"),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const incidentSchema = React.useMemo(() => z.object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    region: (userRole === "parent" || userRole === "branchgroup" || userRole === "branch") ? z.string().optional() : z.string().min(1, "Region is required"),
    otherRegion: z.string().optional(),
    category: z.string().min(1, "Category is required"),
    severity: z.string().min(1, "Severity is required"),
    reportedBy: z.string().min(1, "Reported by is required"),
    subCategory: z.string().min(1, "Sub-category is required"),
    otherSubCategory: z.string().optional(),
    stakeholders: z.string().min(1, "Stakeholder is required"),
    briefDescription: z.string().min(10, "Description must be at least 10 characters"),
    immediateActionTaken: z.string().min(1, "Immediate action is required"),
    pendingAction: z.string().optional(),
    closureDate: z.string().optional(),
    status: z.string().min(1, "Status is required"),
    escalationStatus: z.string().min(1, "Escalation status is required"),
    escalatedTo: z.string().optional(),
    remarks: z.string().optional(),
    schoolId: z.string().optional(),
    branchId: (userRole === "parent" || userRole === "branch") ? z.string().optional() : z.string().min(1, "Safety Head (School) is required"),
    branchName: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.region === "Other" && (!data.otherRegion || data.otherRegion.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the region",
        path: ["otherRegion"],
      });
    }
    if (data.subCategory === "Other:" && (!data.otherSubCategory || data.otherSubCategory.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the sub-category",
        path: ["otherSubCategory"],
      });
    }
    if (data.escalationStatus === "Yes" && (!data.escalatedTo || data.escalatedTo.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify who it was escalated to",
        path: ["escalatedTo"],
      });
    }
  }), [userRole]);

  const form = useForm<z.infer<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      email: "",
      region: "",
      otherRegion: "",
      category: "Incident",
      severity: "Low",
      reportedBy: "",
      subCategory: "",
      otherSubCategory: "",
      stakeholders: "",
      briefDescription: "",
      immediateActionTaken: "",
      pendingAction: "",
      closureDate: "",
      status: "Open",
      escalationStatus: "No",
      escalatedTo: "",
      remarks: "",
      schoolId: user?.schoolId || "",
      branchId: user?.branchId || "",
    },
  });

  const selectedSchoolId = form.watch("schoolId") || user?.schoolId;

  // Fetch schools dropdown
  const { data: schools = [], isLoading: isLoadingSchools } = useSchoolDropdown(true);

  const schoolOptions = React.useMemo(() => {
    if (!schools || !Array.isArray(schools)) return [];
    return schools.map((s: any) => ({
      label: s.schoolName || s.name || "Unnamed School",
      value: s._id,
    }));
  }, [schools]);

  // Trigger Branch/Safety Head API using schoolId from user token if available, or skip schoolId filter if superAdmin without schoolId
  const { data: apiBranches } = useBranchDropdown(
    selectedSchoolId || undefined,
    userRole ? ["branchgroup", "superadmin", "school"].includes(userRole) : false,
    userRole === "branchgroup" || !selectedSchoolId
  );

  const branchGroupOptions = React.useMemo(() => {
    if (!branchGroups) return [];
    const options = branchGroups.map((bg) => ({
      label: bg.branchGroupName,
      value: bg.branchGroupName,
      branches: bg.AssignedBranch || [],
      schoolId: bg.schoolId?._id || bg.schoolId, // The top-level ID
    }));
    // Add "Other" option
    options.push({ label: "Other", value: "Other", branches: [], schoolId: "" });
    return options;
  }, [branchGroups]);

  // For branchGroup: auto-set region from their own branch group so Safety Head dropdown works
  useEffect(() => {
    if (userRole === "branchgroup" && branchGroups && branchGroups.length > 0) {
      // Try to find group where user's branchId is a member, or matches the group's own ID
      const ownGroup = branchGroups.find((bg: any) =>
        (bg._id === user?.branchId) ||
        bg.AssignedBranch?.some((b: any) => b._id === user?.branchId)
      ) || branchGroups[0]; // Fallback to first group if no specific match

      if (ownGroup) {
        form.setValue("region", ownGroup.branchGroupName);
      }
    }
  }, [userRole, branchGroups, form, user?.branchId]);

  const selectedRegion = form.watch("region");
  const safetyHeadOptions = React.useMemo(() => {
    if (schoolOptions.length > 0) {
      return schoolOptions;
    }
    const formatBranchLabel = (b: any) => {
      const name = b.branchName || b.name;
      return b.fas ? `${name} (FAS: ${b.fas})` : name;
    };

    const isDirectBranchRole = userRole && ["branchgroup", "superadmin", "school"].includes(userRole);
    if (isDirectBranchRole && apiBranches) {
      if (selectedRegion && selectedRegion !== "Other") {
        const region = branchGroupOptions.find(o => o.value === selectedRegion);
        if (region && region.branches) {
          const regionBranchIds = region.branches.map((b: any) => b._id);
          return apiBranches
            .filter((b: any) => regionBranchIds.includes(b._id))
            .map((b: any) => ({
              label: formatBranchLabel(b),
              value: b._id,
              safetyHeadName: b.safetyHeadName,
            }));
        }
      }
      return apiBranches.map((b: any) => ({
        label: formatBranchLabel(b),
        value: b._id,
        safetyHeadName: b.safetyHeadName,
      }));
    }
    const region = branchGroupOptions.find(o => o.value === selectedRegion);
    if (!region || !region.branches) return [];
    return region.branches.map((b: any) => ({
      label: formatBranchLabel(b),
      value: b._id,
      safetyHeadName: b.safetyHeadName, // We can store this if needed
    }));
  }, [schoolOptions, selectedRegion, branchGroupOptions, userRole, apiBranches]);

  const mutation = useMutation({
    mutationFn: (data: any) => incidentService.addIncident(data),
    onSuccess: () => {
      toast.success("Incident reported successfully");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      router.push("/dashboard/incident-management");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to report incident");
    },
  });

  const onSubmit = (values: z.infer<typeof incidentSchema>) => {
    const payload = { ...values };

    // Handle "Other:" sub-category
    if (payload.subCategory === "Other:") {
      payload.subCategory = payload.otherSubCategory;
    }
    // Handle "Other" region
    if (payload.region === "Other") {
      payload.region = payload.otherRegion;
    }
    delete payload.otherSubCategory;
    delete payload.otherRegion;

    // Handle Stakeholders (single to array for API compatibility)
    if (payload.stakeholders) {
      payload.stakeholders = [payload.stakeholders as any];
    }

    mutation.mutate(payload);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="hover:bg-gray-100 rounded-full">
          <Link href="/dashboard/incident-management">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#0c235c]">
            Report New Incident
          </h1>
          <p className="text-sm text-muted-foreground">
            Fill in the details to report a safety concern or incident.
          </p>
        </div>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-none shadow-md overflow-hidden">
            <CardContent className="p-6 space-y-8">
              {/* Basic Info Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Reporter Information</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="reporter@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {userRole && ["superadmin", "school"].includes(userRole) && (
                    <>
                      <FormField
                        control={form.control}
                        name="region"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Region</FormLabel>
                            <Combobox
                              items={branchGroupOptions}
                              value={field.value}
                              onValueChange={(val) => {
                                field.onChange(val);
                                // Reset branchId when region changes
                                form.setValue("branchId", "");
                                form.setValue("branchName" as any, "");

                                // Optional: update schoolId (top level) if we have it
                                const region = branchGroupOptions.find(o => o.value === val);
                                if (region && region.schoolId) {
                                  form.setValue("schoolId", region.schoolId);
                                }
                              }}
                              placeholder="Select region"
                              width="w-full"
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("region") === "Other" && (
                        <FormField
                          control={form.control}
                          name="otherRegion"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Specify Other Region</FormLabel>
                              <FormControl>
                                <Input placeholder="Type region name..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="reportedBy"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Reported By</FormLabel>
                        <Combobox
                          items={REPORTED_BY_OPTIONS.map(r => ({ label: r, value: r }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select reporter type"
                          width="w-full"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {userRole && ["superadmin", "school", "branchgroup"].includes(userRole) && (
                    <FormField
                      control={form.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Safety Head (School)</FormLabel>
                          <Combobox
                            items={safetyHeadOptions}
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              // Also set branchName and schoolId for the payload
                              const selected = safetyHeadOptions.find(o => o.value === val);
                              if (selected) {
                                form.setValue("branchName" as any, selected.label);
                                form.setValue("schoolId" as any, selected.value);
                              }
                            }}
                            placeholder={isLoadingSchools ? "Loading schools..." : "Select school"}
                            width="w-full"
                            disabled={isLoadingSchools && safetyHeadOptions.length === 0}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Incident Details Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="h-2 w-2 rounded-full bg-amber-600" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Incident Details</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Category</FormLabel>
                        <Combobox
                          items={CATEGORIES.map(c => ({ label: c, value: c }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select category"
                          width="w-full"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Severity Level</FormLabel>
                        <Combobox
                          items={SEVERITY_OPTIONS.map(s => ({ label: s, value: s }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select severity level"
                          width="w-full"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subCategory"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Sub-Category</FormLabel>
                        <Combobox
                          items={SUB_CATEGORIES.map(s => ({ label: s, value: s }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select sub-category"
                          width="w-full"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("subCategory") === "Other:" && (
                    <FormField
                      control={form.control}
                      name="otherSubCategory"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Specify Other Sub-Category</FormLabel>
                          <FormControl>
                            <Input placeholder="Type sub-category..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="stakeholders"
                    render={({ field }) => (
                      <FormItem className="flex flex-col md:col-span-2">
                        <FormLabel>Stakeholders</FormLabel>
                        <Combobox
                          items={STAKEHOLDERS_OPTIONS.map(s => ({ label: s, value: s }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select primary stakeholder"
                          width="w-full"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="briefDescription"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Brief Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide a brief summary of the incident..."
                            className="min-h-[120px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="immediateActionTaken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Immediate Action Taken</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What actions were taken immediately?"
                            className="min-h-[100px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pendingAction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pending Action (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What actions are still pending?"
                            className="min-h-[100px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Status & Timeline Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="h-2 w-2 rounded-full bg-green-600" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Status & Escalation</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="closureDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Target Closure Date (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Initial Status</FormLabel>
                        <FormControl>
                          <Combobox
                            items={STATUS_OPTIONS.map(s => ({ label: s, value: s }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select status"
                            width="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="escalationStatus"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Escalation Status</FormLabel>
                        <FormControl>
                          <Combobox
                            items={ESCALATION_OPTIONS.map(e => ({ label: e, value: e }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Is escalation required?"
                            width="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("escalationStatus") === "Yes" && (
                    <FormField
                      control={form.control}
                      name="escalatedTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escalated To</FormLabel>
                          <FormControl>
                            <Input placeholder="Name or Department" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any final notes or remarks..."
                          className="min-h-[80px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Admin IDs (derived from user context)
              {userRole === "superadmin" && (
                <div className="space-y-6 pt-4 border-t">
                  <div className="flex items-center gap-2 pb-2">
                    <div className="h-2 w-2 rounded-full bg-purple-600" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">SuperAdmin Configuration</h3>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="schoolId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>School ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Admin/School ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch ID</FormLabel>
                          <FormControl>
                            <Input placeholder="User/Branch ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )} */}

              <div className="pt-6 flex justify-end gap-3 border-t">
                <Button variant="outline" type="button" asChild className="px-8 cursor-pointer">
                  <Link href="/dashboard/incident-management">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="px-10 bg-[#0c235c] hover:bg-[#0c235c]/90 text-white font-semibold cursor-pointer"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Submit Incident"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
