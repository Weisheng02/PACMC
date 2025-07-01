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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h1 className="text-2xl font-bold">Pending Records</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium border border-gray-300 flex items-center gap-1 w-full sm:w-auto"
            type="button"
          >
            ← Back to Home
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            className="input input-bordered w-full sm:w-48"
            placeholder="Search description/amount/ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="input input-bordered w-full sm:w-32"
            placeholder="Created by"
            value={filterCreatedBy}
            onChange={(e) => setFilterCreatedBy(e.target.value)}
          />
          <select
            className="input input-bordered w-full sm:w-32"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
          <div className="hidden sm:flex gap-2">
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
        </div>
        {/* 桌面端表格 */}
        <div className="overflow-x-auto bg-white rounded shadow border hidden md:block">
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
        {/* 移动端卡片列表（支持多选和批量操作，卡片更紧凑） */}
        <div className="flex flex-col gap-2 md:hidden">
          {/* 批量操作栏 */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => e.target.checked ? selectAll() : clearAll()} />
              <span className="ml-2 text-sm">Select All</span>
            </div>
            <button
              onClick={() => approveRecords(Array.from(selected))}
              disabled={selected.size === 0 || approving}
              className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              type="button"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Bulk Approve
            </button>
          </div>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">No pending records</div>
          ) : (
            filtered.map((r) => (
              <div key={r.key} className={`bg-white rounded shadow border p-2 flex flex-col gap-1 ${selected.has(r.key) ? 'ring-2 ring-green-400' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggleSelect(r.key)} />
                    <span className="font-bold text-sm">{r.key}</span>
                  </div>
                  <span className="text-green-700 font-semibold text-sm">RM{r.amount}</span>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="bg-gray-100 rounded px-1 py-0.5">{r.type}</span>
                  <span className="bg-gray-100 rounded px-1 py-0.5">{r.status}</span>
                </div>
                <div className="text-xs text-gray-700">{r.description}</div>
                <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                  <span>Created: {r.date}</span>
                  <span>By: {r.createdBy}</span>
                  {r.remark && <span>Remark: {r.remark}</span>}
                </div>
                <button
                  type="button"
                  className="w-full px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50 mt-1"
                  disabled={approving}
                  onClick={() => approveRecords([r.key])}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />Approve
                </button>
              </div>
            ))
          )}
        </div>
        {/* 桌面端底部批量操作 */}
        <div className="hidden md:flex items-center justify-between mt-4">
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