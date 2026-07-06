/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Resource, Project, Allocation } from '../types';
import { FileSpreadsheet } from 'lucide-react';

interface ReportsTabProps {
  resources?: Resource[];
  projects?: Project[];
  allocations?: Allocation[];
}

export const ReportsTab: React.FC<ReportsTabProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-xl border border-gray-100 shadow-sm" id="reports-coming-soon">
      <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-4">
        <FileSpreadsheet className="w-8 h-8 animate-pulse" />
      </div>
      <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Breakdown Reports</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        Advanced spreadsheet exporting and aggregated analytics reports are currently in development.
      </p>
      <div className="mt-6 px-4 py-1.5 bg-emerald-50 text-emerald-750 text-xs font-bold uppercase tracking-wider rounded-full">
        Coming Soon
      </div>
    </div>
  );
};

