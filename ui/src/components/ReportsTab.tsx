/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Resource, Project, ScheduleAssignment } from '../types';
import { FileSpreadsheet } from 'lucide-react';

interface ReportsTabProps {
  resources?: Resource[];
  projects?: Project[];
  assignments?: ScheduleAssignment[];
}

export const ReportsTab: React.FC<ReportsTabProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center app-card" id="reports-coming-soon">
      <div className="p-4 tint-emerald rounded-full mb-4">
        <FileSpreadsheet className="w-8 h-8 animate-pulse" />
      </div>
      <h2 className="text-2xl font-extrabold text-primary tracking-tight">Breakdown Reports</h2>
      <p className="mt-2 text-sm text-secondary max-w-sm">
        Advanced spreadsheet exporting and aggregated analytics reports are currently in development.
      </p>
      <div className="mt-6 px-4 py-1.5 tint-emerald text-xs font-bold uppercase tracking-wider rounded-full">
        Coming Soon
      </div>
    </div>
  );
};

