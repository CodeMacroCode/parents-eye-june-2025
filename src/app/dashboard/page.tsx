"use client";

import { MyPageTable } from "@/components/example/MyPageTable";

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to the Dashboard...</h1>
      <MyPageTable/>
    </div>
  );
}
