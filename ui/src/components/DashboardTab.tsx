/*
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Resource, Project, Allocation } from '../types';
import { LayoutDashboard, TrendingUp, Users, FolderKanban, CheckCircle, PieChart, BarChart3, HelpCircle, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { getProjectCategoryDotClassForProject } from '../lib/projectCategory';

interface DashboardTabProps {
  resources: Resource[];
  projects: Project[];
  allocations: Allocation[];
}

const calculateWeekdays = (startStr: string, endStr: string): number => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const current = new Date(start);
  let loops = 0;
  while (current <= end && loops < 10000) {
    loops++;
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const DashboardTab: React.FC<DashboardTabProps> = ({ resources, projects, allocations }) => {
  // Filter States
  const [filterProject, setFilterProject] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterTime, setFilterTime] = useState('all');

  // Extract unique groups from resources for the filter select
  const groups = useMemo(() => {
    const allGroups = resources
      .map((r) => r.group)
      .filter((g): g is string => !!g);
    return Array.from(new Set(allGroups));
  }, [resources]);

  // Filter allocations dynamically based on chosen dropdown filters
  const filteredAllocations = useMemo(() => {
    return allocations.filter((alloc) => {
      // 1. Project filter
      if (filterProject !== 'all' && alloc.projectId !== filterProject) {
        return false;
      }

      // 2. Resource Group filter
      if (filterGroup !== 'all') {
        const resource = resources.find((r) => r.id === alloc.resourceId);
        if (!resource || resource.group !== filterGroup) {
          return false;
        }
      }

      // 3. Time Filter (All, June 2026, July 2026)
      if (filterTime !== 'all') {
        const allocStart = new Date(alloc.startDate);
        const allocEnd = new Date(alloc.endDate);
        
        if (filterTime === 'june') {
          // Must overlap with June 2026 (2026-06-01 to 2026-06-30)
          const juneStart = new Date('2026-06-01');
          const juneEnd = new Date('2026-06-30');
          if (allocEnd < juneStart || allocStart > juneEnd) return false;
        } else if (filterTime === 'july') {
          // Must overlap with July 2026 (2026-07-01 to 2026-07-31)
          const julyStart = new Date('2026-07-01');
          const julyEnd = new Date('2026-07-31');
          if (allocEnd < julyStart || allocStart > julyEnd) return false;
        }
      }

      return true;
    });
  }, [allocations, resources, filterProject, filterGroup, filterTime]);

  // Calculate analytics metrics dynamically based on filtered allocations
  const stats = useMemo(() => {
    let totalPlannedHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;

    const activeResourcesList = resources.filter(r => 
      filterGroup === 'all' || r.group === filterGroup
    );

    const activeProjectsList = projects.filter(p => 
      filterProject === 'all' || p.id === filterProject
    );

    // Calculate hours
    filteredAllocations.forEach((alloc) => {
      let startOverlap = new Date(alloc.startDate);
      let endOverlap = new Date(alloc.endDate);

      if (filterTime === 'june') {
        const juneStart = new Date('2026-06-01');
        const juneEnd = new Date('2026-06-30');
        if (startOverlap < juneStart) startOverlap = juneStart;
        if (endOverlap > juneEnd) endOverlap = juneEnd;
      } else if (filterTime === 'july') {
        const julyStart = new Date('2026-07-01');
        const julyEnd = new Date('2026-07-31');
        if (startOverlap < julyStart) startOverlap = julyStart;
        if (endOverlap > julyEnd) endOverlap = julyEnd;
      }

      const weekdaysCount = calculateWeekdays(
        startOverlap.toISOString().split('T')[0],
        endOverlap.toISOString().split('T')[0]
      );
      
      const allocationHours = weekdaysCount * 8 * (alloc.billablePercent / 100);

      totalPlannedHours += allocationHours;
      if (alloc.billableType === 'Billable') {
        billableHours += allocationHours;
      } else {
        nonBillableHours += allocationHours;
      }
    });

    // Group hours by project
    const projectHoursMap: { [projId: string]: number } = {};
    activeProjectsList.forEach((p) => {
      projectHoursMap[p.id] = 0;
    });

    filteredAllocations.forEach((alloc) => {
      if (projectHoursMap[alloc.projectId] !== undefined) {
        let startOverlap = new Date(alloc.startDate);
        let endOverlap = new Date(alloc.endDate);

        if (filterTime === 'june') {
          const juneStart = new Date('2026-06-01');
          const juneEnd = new Date('2026-06-30');
          if (startOverlap < juneStart) startOverlap = juneStart;
          if (endOverlap > juneEnd) endOverlap = juneEnd;
        } else if (filterTime === 'july') {
          const julyStart = new Date('2026-07-01');
          const julyEnd = new Date('2026-07-31');
          if (startOverlap < julyStart) startOverlap = julyStart;
          if (endOverlap > julyEnd) endOverlap = julyEnd;
        }

        const weekdaysCount = calculateWeekdays(
          startOverlap.toISOString().split('T')[0],
          endOverlap.toISOString().split('T')[0]
        );
        projectHoursMap[alloc.projectId] += weekdaysCount * 8 * (alloc.billablePercent / 100);
      }
    });

    const projectHoursList = activeProjectsList.map((p) => ({
      name: p.name,
      hours: Math.round(projectHoursMap[p.id] || 0),
      color: getProjectCategoryDotClassForProject(p),
    })).filter(p => p.hours > 0);

    const billableRatio = totalPlannedHours > 0 ? (billableHours / totalPlannedHours) * 105 : 0;
    const safeBillablePercent = Math.min(100, Math.round(billableRatio));

    return {
      totalHours: Math.round(totalPlannedHours),
      billableHours: Math.round(billableHours),
      nonBillableHours: Math.round(nonBillableHours),
      billablePercent: safeBillablePercent,
      projectHours: projectHoursList,
      activeProjects: activeProjectsList.length,
      activeResources: activeResourcesList.length,
    };
  }, [filteredAllocations, projects, resources, filterGroup, filterProject, filterTime]);

  // SVG Chart sizing math
  const maxProjectHours = useMemo(() => {
    if (stats.projectHours.length === 0) return 1;
    return Math.max(...stats.projectHours.map((p) => p.hours));
  }, [stats.projectHours]);

  return (
    <div className="space-y-6" id="dashboard-tab-board">
      
      {/* Top Filter Section Line */}
      <div className="app-card flex flex-wrap items-center justify-between gap-4" id="dashboard-top-filter-bar">
        <div className="flex flex-wrap items-center gap-4">
          {/* Initiative Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-tertiary">Project:</span>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="text-xs bg-surface-muted hover:bg-surface-hover border border-default rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none transition font-semibold cursor-pointer text-primary"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Group Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-tertiary">Team Group:</span>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="text-xs bg-surface-muted hover:bg-surface-hover border border-default rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none transition font-semibold cursor-pointer text-primary"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Horizon Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-tertiary">Time Horizon:</span>
          <select
            value={filterTime}
            onChange={(e) => setFilterTime(e.target.value)}
            className="text-xs bg-surface-muted hover:bg-surface-hover border border-default rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-400 focus:outline-none transition font-semibold cursor-pointer text-primary"
          >
            <option value="all">All Weeks (Jun & Jul)</option>
            <option value="june">June 2026 Only</option>
            <option value="july">July 2026 Only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="app-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-tertiary uppercase tracking-widest block">Total Scheduled Time</span>
            <span className="text-3xl font-extrabold text-slate-800 block mt-2">{stats.totalHours} Hours</span>
          </div>
          <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-50 font-medium">
            Accumulated hours allocated to dates
          </p>
        </div>

        <div className="app-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-tertiary uppercase tracking-widest block">Billability Ratio</span>
            <span className="text-3xl font-extrabold text-emerald-600 block mt-2">{stats.billablePercent}%</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div style={{ width: `${stats.billablePercent}%` }} className="bg-emerald-500 h-1.5 rounded-full" />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {stats.billableHours} billable hours logged
          </p>
        </div>

        <div className="app-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-tertiary uppercase tracking-widest block">Core Headcount</span>
            <span className="text-3xl font-extrabold text-[#a855f7] block mt-2">{stats.activeResources} Members</span>
          </div>
          <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-50 font-medium flex items-center gap-1">
            <Users className="w-4 h-4 text-purple-400" /> Professional Consultants
          </p>
        </div>

        <div className="app-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-tertiary uppercase tracking-widest block">Active Initiatives</span>
            <span className="text-3xl font-extrabold text-amber-500 block mt-2">{stats.activeProjects} Projects</span>
          </div>
          <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-50 font-medium flex items-center gap-1">
            <FolderKanban className="w-4 h-4 text-amber-400" /> Under contract billing
          </p>
        </div>

      </div>

      {/* Two Column Visual Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Project bar chart */}
        <div className="app-card space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-55 pb-3 justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" />
              <h3 className="text-md font-bold text-primary">Planned Hours by Project</h3>
            </div>
          </div>

          {stats.projectHours.length === 0 ? (
            <div className="text-center py-20 text-tertiary text-sm">
              Allocate resource hours to projects to display visual analytics.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {stats.projectHours.map((item) => {
                const percentage = Math.max(8, (item.hours / maxProjectHours) * 100);
                const colorHex = item.color || 'bg-blue-500';

                return (
                  <div key={item.name} className="space-y-1.5 shadow-sm p-1 rounded-lg">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-primary">{item.name}</span>
                      <span className="font-semibold text-secondary">{item.hours} hours planned</span>
                    </div>
                    <div className="w-full bg-surface-muted rounded-full h-4 relative">
                      <div
                        style={{ width: `${percentage}%` }}
                        className={`h-4 rounded-full transition-all duration-500 ${colorHex}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Billable composition share (Donut Visualizer) */}
        <div className="app-card space-y-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-gray-55 pb-3">
            <PieChart className="w-5 h-5 text-secondary" />
            <h3 className="text-md font-bold text-primary">Allocation Type Composition</h3>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around py-4 gap-6 grow">
            {/* SVG custom Donut Chart */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4.2" />
                {stats.totalHours > 0 && (
                  <circle
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke="#22c55e"
                    strokeWidth="4.2"
                    strokeDasharray={`${stats.billablePercent} ${100 - stats.billablePercent}`}
                    strokeDashoffset="0"
                  />
                )}
              </svg>
              {/* Inner absolute centering */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-primary">{stats.billablePercent}%</span>
                <span className="text-[9px] font-bold text-tertiary uppercase tracking-widest">Billable</span>
              </div>
            </div>

            {/* Legends list */}
            <div className="space-y-4 text-left w-full max-w-[200px]">
              <div className="p-2 border border-emerald-100 rounded-lg hover:bg-emerald-50/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-emerald-500 rounded" />
                  <span className="text-xs font-bold text-primary">Client Billable</span>
                </div>
                <p className="text-sm font-extrabold text-emerald-600 pl-5 mt-0.5">{stats.billableHours} hrs</p>
              </div>

              <div className="p-2 border border-subtle rounded-lg hover:bg-surface-muted transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-purple-400 rounded" />
                  <span className="text-xs font-bold text-primary">Opportunity</span>
                </div>
                <p className="text-sm font-extrabold text-purple-600 pl-5 mt-0.5">{stats.nonBillableHours.toFixed(0)} hrs</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
