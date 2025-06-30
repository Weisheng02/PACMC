"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/PermissionGate";
import { Download, CheckCircle, Search, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

// 假设有API /api/sheets/read 获取所有记录
async function fetchRecords() {
  const res = await fetch("/api/sheets/read");
  if (!res.ok) throw new Error("Failed to fetch records");
  return res.json();
}

export default function PendingRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCreatedBy, setFilterCreatedBy] = useState("");
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetchRecords()
      .then((data) => {
        setRecords(data.records || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // 只显示Pending
  const pendingRecords = records.filter((r) => r.status === "Pending");

  // 搜索/筛选
  const filtered = pendingRecords.filter((r) => {
    const matchSearch =
      !search ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.amount?.toString().includes(search) ||
      r.key?.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || r.type === filterType;
    const matchCreatedBy = !filterCreatedBy || r.createdBy?.toLowerCase().includes(filterCreatedBy.toLowerCase());
    return matchSearch && matchType && matchCreatedBy;
  });

  // 多选
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map((r) => r.key)));
  const clearAll = () => setSelected(new Set());

  // 单条/批量审核
  const approveRecords = async (keys: string[]) => {
    setApproving(true);
    try {
      setProgress({ done: 0, total: keys.length });
      await Promise.all(
        keys.map((key) =>
          fetch("/api/sheets/update-record-status", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, status: "Approved" }),
          })
        )
      );
      router.refresh();
      setSelected(new Set());
      // 重新拉取数据
      fetchRecords().then((data) => setRecords(data.records || []));
    } finally {
      setApproving(false);
      setProgress(null);
    }
  };

  // 导出Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PendingRecords");
    XLSX.writeFile(wb, "pending-records.xlsx");
  };

  return (
    <PermissionGate allowedRoles={['Admin', 'Super Admin']}>
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Pending Records</h1>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium border border-gray-300 flex items-center gap-1"
            type="button"
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="flex gap-2 mb-2">
          <input
            className="input input-bordered w-48"
            placeholder="Search description/amount/ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="input input-bordered w-32"
            placeholder="Created by"
            value={filterCreatedBy}
            onChange={(e) => setFilterCreatedBy(e.target.value)}
          />
          <select
            className="input input-bordered w-32"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
          <button
            onClick={selectAll}
            className="px-2 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 text-xs font-medium mr-1"
            type="button"
          >Select All</button>
          <button
            onClick={clearAll}
            className="px-2 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 text-xs font-medium"
            type="button"
          >Clear</button>
        </div>
        <div className="overflow-x-auto bg-white rounded shadow border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => e.target.checked ? selectAll() : clearAll()} /></th>
                <th className="p-2">ID</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Type</th>
                <th className="p-2">Description</th>
                <th className="p-2">Created Date</th>
                <th className="p-2">Created By</th>
                <th className="p-2">Remark</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8">No pending records</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.key} className={selected.has(r.key) ? "bg-blue-50" : ""}>
                    <td className="p-2"><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggleSelect(r.key)} /></td>
                    <td className="p-2">{r.key}</td>
                    <td className="p-2">RM{r.amount}</td>
                    <td className="p-2">{r.type}</td>
                    <td className="p-2">{r.description}</td>
                    <td className="p-2">{r.date}</td>
                    <td className="p-2">{r.createdBy}</td>
                    <td className="p-2">{r.remark}</td>
                    <td className="p-2">{r.status}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                        disabled={approving}
                        onClick={() => approveRecords([r.key])}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />Approve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={exportExcel}
            className="px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium flex items-center gap-1"
            type="button"
          >
            <Download className="w-4 h-4 mr-1" /> Export to Excel
          </button>
          <button
            onClick={() => approveRecords(Array.from(selected))}
            disabled={selected.size === 0 || approving}
            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
            type="button"
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
            Bulk Approve
          </button>
        </div>
        {progress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 min-w-[220px] flex flex-col items-center">
              <span className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Please wait...</span>
              <span className="text-xs text-gray-500 dark:text-slate-400">Processing approval, do not close or refresh the page.</span>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
} 