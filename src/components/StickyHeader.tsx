"use client";
import Link from "next/link";

export default function StickyHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200 w-full">
      <div className="flex items-center justify-between px-4 sm:px-8 py-2 gap-2">
        {/* Logo + 标题 */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2">
            <img src="/pacmc.jpg" alt="PACMC Logo" className="h-9 w-9 rounded-full object-cover" />
            <span className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap truncate">PACMC</span>
          </Link>
          <span className="hidden sm:inline-block text-base sm:text-lg font-semibold text-gray-700 ml-2 truncate">Financial Records</span>
        </div>
        {/* 操作按钮区 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/" className="hidden sm:flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Home
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            title="Refresh"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 20v-5h-.581M5 19A9 9 0 0 1 19 5" />
            </svg>
            Refresh
          </button>
          <Link href="/admin/users" className="hidden sm:flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 0 1 0 7.75M8 3.13a4 4 0 0 0 0 7.75" />
            </svg>
            Manage Users
          </Link>
          <button
            className="hidden sm:flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
            title="Set Cash"
            onClick={() => window.location.href='/'}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Set Cash
          </button>
        </div>
      </div>
    </header>
  );
} 