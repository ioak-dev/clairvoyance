/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  FolderKanban,
  Palmtree,
  Percent,
  Users,
} from 'lucide-react';
import type { BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { buildDashboardSnapshot } from '../lib/dashboardMetrics';
import {
  CURRENT_DATE_STRING,
  getDashboardPeriod,
  type DashboardPeriodMode,
} from '../lib/dateUtils';
import { CapacityAlerts } from './dashboard/CapacityAlerts';
import { CategoryBreakdown } from './dashboard/CategoryBreakdown';
import { DashboardPeriodBar } from './dashboard/DashboardPeriodBar';
import { KpiCard } from './dashboard/KpiCard';
import { PipelinePanel } from './dashboard/PipelinePanel';
import { TopProjectsChart } from './dashboard/TopProjectsChart';
import { UtilizationGauge } from './dashboard/UtilizationGauge';
import { WeeklyTrendChart } from './dashboard/WeeklyTrendChart';

export interface DashboardTabProps {
  resources: Resource[];
  projects: Project[];
  assignments: ScheduleAssignment[];
  requests: BookingRequest[];
  vacations: Vacation[];
  referenceDate?: string;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  resources,
  projects,
  assignments,
  requests,
  vacations,
  referenceDate = CURRENT_DATE_STRING,
}) => {
  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>('30d');
  const [customStart, setCustomStart] = useState('2026-06-01');
  const [customEnd, setCustomEnd] = useState(referenceDate);

  const period = useMemo(
    () => getDashboardPeriod(periodMode, referenceDate, customStart, customEnd),
    [periodMode, referenceDate, customStart, customEnd],
  );

  const snapshot = useMemo(
    () =>
      buildDashboardSnapshot(
        resources,
        projects,
        assignments,
        requests,
        vacations,
        period,
        referenceDate,
      ),
    [resources, projects, assignments, requests, vacations, period, referenceDate],
  );

  return (
    <div className="space-y-6" id="dashboard-tab-board">
      <DashboardPeriodBar
        mode={periodMode}
        customStart={customStart}
        customEnd={customEnd}
        periodLabel={snapshot.period.label}
        onModeChange={setPeriodMode}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Utilization"
          value={`${snapshot.utilizationPercent}%`}
          subtitle={
            snapshot.rawUtilizationPercent > 100
              ? `Actual load ${snapshot.rawUtilizationPercent}% of capacity`
              : `${snapshot.totalPlannedHours}h planned of ${snapshot.totalCapacityHours}h`
          }
          icon={Activity}
          accentClass="text-blue-500"
        />
        <KpiCard
          label="Planned Hours"
          value={`${snapshot.totalPlannedHours.toLocaleString()}h`}
          subtitle={`Across ${snapshot.activeProjects} projects`}
          icon={Clock}
          accentClass="text-violet-500"
        />
        <KpiCard
          label="Billable Ratio"
          value={`${snapshot.billableRatioPercent}%`}
          subtitle={`${snapshot.billableHours.toLocaleString()}h billable`}
          icon={Percent}
          accentClass="text-emerald-500"
        />
        <KpiCard
          label="Open Requests"
          value={String(snapshot.openRequestsTotal)}
          subtitle={`${snapshot.openRequestsUnassigned} unassigned slots`}
          icon={FolderKanban}
          accentClass="text-amber-500"
        />
        <KpiCard
          label="On Leave"
          value={String(snapshot.peopleOnLeave)}
          subtitle={`${snapshot.approvedLeaveDays} approved days · ${snapshot.pendingVacations} pending`}
          icon={Palmtree}
          accentClass="text-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UtilizationGauge
          percent={snapshot.utilizationPercent}
          rawPercent={snapshot.rawUtilizationPercent}
          plannedHours={snapshot.totalPlannedHours}
          capacityHours={snapshot.totalCapacityHours}
        />
        <CategoryBreakdown
          categories={snapshot.categoryHours}
          totalHours={snapshot.totalPlannedHours}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyTrendChart weeks={snapshot.weeklyTrend} />
        <PipelinePanel
          openRequestsTotal={snapshot.openRequestsTotal}
          openRequestsUnassigned={snapshot.openRequestsUnassigned}
          openRequests={snapshot.openRequests}
          approvedLeaveDays={snapshot.approvedLeaveDays}
          peopleOnLeave={snapshot.peopleOnLeave}
          pendingVacations={snapshot.pendingVacations}
        />
      </div>

      <TopProjectsChart projects={snapshot.topProjects} />

      <CapacityAlerts
        overAllocated={snapshot.overAllocated}
        underUtilized={snapshot.underUtilized}
      />

      <div className="app-card p-5 flex flex-wrap items-center justify-between gap-4 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-tertiary" />
          <span>
            <span className="font-semibold text-primary">{snapshot.activePeople}</span> active people
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FolderKanban className="w-3.5 h-3.5 text-tertiary" />
          <span>
            <span className="font-semibold text-primary">{snapshot.opportunityCount}</span> opportunities in portfolio
          </span>
        </div>
      </div>
    </div>
  );
};
