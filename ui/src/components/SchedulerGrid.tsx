/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Resource, Project, Allocation, Vacation, BookingRequest } from '../types';
import { Edit2, AlertCircle, Info, Calendar, Plus, User, X, Check, Award, Search, UserCheck } from 'lucide-react';

interface SchedulerGridProps {
  resources: Resource[];
  projects: Project[];
  allocations: Allocation[];
  vacations: Vacation[];
  requests?: BookingRequest[];
  searchQuery: string;
  timelineStartDate: string;
  timelineEndDate: string;
  viewMode?: 'resources' | 'projects' | 'requests';
  onEditAllocation: (alloc: Allocation) => void;
  onOpenScheduleModalWithRes: (resId: string, projId?: string) => void;
  onAddResourceClick: () => void;
  onAddProjectClick?: () => void;
  onApproveRequestWithResource?: (requestId: string, resourceId: string) => void;
  onUnassignRequest?: (requestId: string) => void;
}

export const SchedulerGrid: React.FC<SchedulerGridProps> = ({
  resources,
  projects,
  allocations,
  vacations,
  requests = [],
  searchQuery,
  timelineStartDate,
  timelineEndDate,
  viewMode = 'resources',
  onEditAllocation,
  onOpenScheduleModalWithRes,
  onAddResourceClick,
  onAddProjectClick,
  onApproveRequestWithResource,
  onUnassignRequest,
}) => {
  const [selectedRequestForSkills, setSelectedRequestForSkills] = useState<BookingRequest | null>(null);
  const [popupSearch, setPopupSearch] = useState('');

  // Define full date window for scheduler based on input date range
  const dateRange = useMemo(() => {
    let start = new Date(timelineStartDate || '2026-06-01');
    let end = new Date(timelineEndDate || '2026-07-25');

    // Safe falls backs on invalid entries
    if (isNaN(start.getTime())) {
      start = new Date(2026, 5, 1);
    }
    if (isNaN(end.getTime())) {
      end = new Date(2026, 6, 25);
    }

    // Keep range chronologically sorted
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }

    // Cap the date range to max 366 days to avoid browser freezing
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      end = new Date(start);
      end.setDate(end.getDate() + 365);
    }

    const daysList: { dateStr: string; dayLabel: string; dayNum: number; isWeekend: boolean; monthName: string }[] = [];
    const temp = new Date(start);

    let loops = 0;
    while (temp <= end && loops < 500) {
      loops++;
      const year = temp.getFullYear();
      const month = String(temp.getMonth() + 1).padStart(2, '0');
      const dayRaw = String(temp.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayRaw}`;

      const dayOfWeek = temp.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayLabel = labels[dayOfWeek];

      const monthName = temp.toLocaleString('default', { month: 'long', year: 'numeric' });

      daysList.push({
        dateStr,
        dayLabel,
        dayNum: temp.getDate(),
        isWeekend,
        monthName,
      });

      temp.setDate(temp.getDate() + 1);
    }
    return daysList;
  }, [timelineStartDate, timelineEndDate]);

  // Group days by month to draw the top-level month titles
  const monthsHeader = useMemo(() => {
    const groups: { monthName: string; count: number }[] = [];
    dateRange.forEach((day) => {
      const existing = groups.find((g) => g.monthName === day.monthName);
      if (existing) {
        existing.count += 1;
      } else {
        groups.push({ monthName: day.monthName, count: 1 });
      }
    });
    return groups;
  }, [dateRange]);

  // Get date index calculations
  const getDaysDiff = (startStr: string, endStr: string) => {
    const d1 = new Date(startStr);
    const d2 = new Date(endStr);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDayIndex = (dateStr: string) => {
    return dateRange.findIndex((d) => d.dateStr === dateStr);
  };

  // Grid dimensions
  const colWidth = 52; // exact cell pixel width
  const gridWidth = dateRange.length * colWidth;

  // Group allocations into sequential lanes per resource or project depending on viewMode
  // This supports displaying multiple lanes beautifully!
  const assignmentRows = useMemo(() => {
    interface Lane {
      project?: Project;
      resource?: Resource;
      request?: BookingRequest;
      allocs: Allocation[];
    }

    const rows: {
      id: string;
      resource?: Resource;
      project?: Project;
      projectLanes: Lane[];
    }[] = [];

    if (viewMode === 'requests') {
      // Filter projects matching search query
      const filteredProjects = projects.filter((proj) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (proj.name || '').toLowerCase().includes(q) ||
          (proj.client || '').toLowerCase().includes(q) ||
          (proj.group || '').toLowerCase().includes(q)
        );
      });

      filteredProjects.forEach((proj) => {
        const projRequests = requests.filter((r) => r.projectId === proj.id && (r.status === 'Pending' || r.status === 'Approved'));

        const projectLanes: Lane[] = [];

        // 1. Add lanes for pending requests (skill set requests)
        projRequests.forEach((req) => {
          const pseudoAlloc: Allocation = {
            id: req.id,
            resourceId: req.resourceId || 'unassigned',
            projectId: req.projectId,
            startDate: req.startDate,
            endDate: req.endDate,
            billablePercent: req.billablePercent,
            billableType: req.billableType,
          };
          projectLanes.push({
            project: proj,
            request: req,
            allocs: [pseudoAlloc],
          });
        });

        // Only show projects that have active requests (unassigned skill set data or assigned resources)
        if (projectLanes.length > 0) {
          rows.push({
            id: `row-${proj.id}`,
            project: proj,
            projectLanes,
          });
        }
      });
    } else if (viewMode === 'projects') {
      // Filter projects matching search query
      const filteredProjects = projects.filter((proj) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchProjName = (proj.name || '').toLowerCase().includes(q);
        const matchClient = (proj.client || '').toLowerCase().includes(q);
        const matchGroup = (proj.group || '').toLowerCase().includes(q);
        const hasMatchingResource = allocations
          .filter((alloc) => alloc.projectId === proj.id)
          .some((alloc) => {
            const res = resources.find((r) => r.id === alloc.resourceId);
            if (!res) return false;
            return (
              (res.name || '').toLowerCase().includes(q) ||
              (res.role || '').toLowerCase().includes(q)
            );
          });
        return matchProjName || matchClient || matchGroup || hasMatchingResource;
      });

      filteredProjects.forEach((proj) => {
        const projAllocs = allocations.filter((a) => a.projectId === proj.id);
        const allocatedResIds = Array.from(new Set(projAllocs.map((a) => a.resourceId)));
        
        const projectLanes: Lane[] = [];
        if (allocatedResIds.length === 0) {
          projectLanes.push({
            resource: { id: 'none', name: 'Unassigned', role: '-' },
            allocs: [],
          });
        } else {
          allocatedResIds.forEach((rId) => {
            const resource = resources.find((r) => r.id === rId) || {
              id: rId,
              name: 'Resource',
              role: 'Role'
            };
            const groupAllocs = projAllocs.filter((a) => a.resourceId === rId);
            projectLanes.push({
              resource,
              allocs: groupAllocs,
            });
          });
        }

        rows.push({
          id: `row-${proj.id}`,
          project: proj,
          projectLanes,
        });
      });
    } else {
      // Filter resources matching modern search query
      const filteredResources = resources.filter((res) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchName = res.name.toLowerCase().includes(q);
        const matchRole = res.role.toLowerCase().includes(q);
        const matchGroup = (res.group || '').toLowerCase().includes(q);
        return matchName || matchRole || matchGroup;
      });

      filteredResources.forEach((res) => {
        // Find all allocations for this resource
        const resAllocs = allocations.filter((a) => a.resourceId === res.id);
        
        // Get unique project IDs this resource is allocated to
        const allocatedProjIds = Array.from(new Set(resAllocs.map((a) => a.projectId)));

        const projectLanes: Lane[] = [];

        if (allocatedProjIds.length === 0) {
          // Render at least an empty lane pointing to an empty state or default project to invite booking
          projectLanes.push({
            project: { id: 'none', name: 'Unassigned', client: '-', color: 'bg-gray-100', textColor: 'text-gray-400' },
            allocs: [],
          });
        } else {
          allocatedProjIds.forEach((pId) => {
            const project = projects.find((p) => p.id === pId) || {
              id: pId,
              name: 'Project',
              client: 'Client',
              color: 'bg-[#4e82c2]',
              textColor: 'text-white'
            };
            
            const groupAllocs = resAllocs.filter((a) => a.projectId === pId);
            projectLanes.push({
              project,
              allocs: groupAllocs,
            });
          });
        }

        rows.push({
          id: `row-${res.id}`,
          resource: res,
          projectLanes,
        });
      });
    }

    return rows;
  }, [resources, projects, allocations, searchQuery, viewMode]);

  // Find vacations for a resource that overlap with the timeline
  const getApprovedVacationsForResource = (resourceId: string) => {
    return vacations.filter((v) => v.status === 'Approved' && v.resourceId === resourceId);
  };

  const renderRow = (row: typeof assignmentRows[0]) => {
    const resourceVacations = (viewMode === 'projects' || viewMode === 'requests') ? [] : (row.resource ? getApprovedVacationsForResource(row.resource.id) : []);
 
    return (
      <div key={row.id} className="flex hover:bg-slate-50/60 items-stretch relative group border-b border-gray-100 min-h-[56px]">
        
        {/* Left Sticky Column */}
        <div className="w-[190px] min-w-[190px] border-r border-gray-100 px-4 bg-white sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-h-[56px]">
          <div className="flex items-center gap-2 overflow-hidden py-3 w-full">
            {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
              // Project Row Sticky Visual Details
              <div className="truncate text-left flex-1">
                <div className="flex items-center gap-1.5 mb-1 overflow-hidden">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.project.color || 'bg-blue-500'}`} />
                  <h4 className="text-xs font-black text-gray-800 truncate" title={row.project.name}>{row.project.name}</h4>
                </div>
              </div>
            ) : row.resource ? (
              // Resource Row Sticky Visual Details
              <>
                {row.resource.avatarUrl ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={row.resource.avatarUrl}
                    alt={row.resource.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                    {(row.resource.name || '').split(' ').map((n) => n[0] || '').join('')}
                  </div>
                )}
                <div className="truncate text-left flex-1">
                  <h4 className="text-xs font-bold text-gray-700 truncate">{row.resource.name}</h4>
                  <p className="text-[10px] text-gray-400 capitalize truncate">{row.resource.role}</p>
                </div>
              </>
            ) : null}
          </div>
 
          {/* Quick action button to trigger scheduling overlay */}
          {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
            <button
              onClick={() => onOpenScheduleModalWithRes('', row.project!.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 text-slate-500 rounded cursor-pointer transition-opacity"
              title={`Schedule on ${row.project.name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : row.resource ? (
            <button
              onClick={() => onOpenScheduleModalWithRes(row.resource!.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-50 text-blue-600 rounded cursor-pointer transition-opacity"
              title={`Schedule ${row.resource.name}`}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Timeline Grid Area */}
        <div style={{ width: `${gridWidth}px` }} className="relative flex flex-col justify-center py-2 shrink-0 min-h-[56px]">
          {/* Column background lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {dateRange.map((day) => (
              <div
                key={`grid-${day.dateStr}`}
                style={{ width: `${colWidth}px` }}
                className={`h-full border-r border-gray-100 shrink-0 ${
                  day.isWeekend ? 'bg-slate-50/40' : ''
                }`}
              />
            ))}
          </div>

          {/* Vacation blocks (applicable in resource view mode only) */}
          {resourceVacations.map((v) => {
            const startIdx = getDayIndex(v.startDate);
            const endIdx = getDayIndex(v.endDate);
            if (startIdx === -1 && endIdx === -1) return null;

            const safeStartIdx = Math.max(0, startIdx);
            const safeEndIdx = endIdx === -1 ? dateRange.length - 1 : Math.min(dateRange.length - 1, endIdx);
            const spanDays = safeEndIdx - safeStartIdx + 1;

            const left = safeStartIdx * colWidth;
            const width = spanDays * colWidth;

            return (
              <div
                key={v.id}
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  height: '38px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                className="absolute bg-stripes bg-slate-100 border border-slate-200 text-slate-500 rounded px-2 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase pointer-events-none z-[4]"
                title={`Absence/Vacation Approved: ${v.reason || 'Annual Leave'}`}
              >
                🌴 Time Off
              </div>
            );
          })}

          {/* Horizontal tracks with assignments */}
          <div className="flex flex-col gap-2 w-full relative z-10 text-left">
            {row.projectLanes.map((lane, lIdx) => {
              const laneKey = viewMode === 'requests'
                ? (lane.request?.id || (lane.resource?.id ? `lane-res-${lane.resource.id}` : `lane-req-${lIdx}`))
                : viewMode === 'projects' 
                ? (lane.resource?.id || `lane-res-${lIdx}`)
                : (lane.project?.id || `lane-proj-${lIdx}`);

              return (
                <div key={laneKey} className="h-11 relative w-full flex items-center">
                  {lane.allocs.map((alloc) => {
                    const startIdx = getDayIndex(alloc.startDate);
                    const endIdx = getDayIndex(alloc.endDate);

                    // Skip if completely out of date range viewport bounds
                    if (startIdx === -1 && endIdx === -1) return null;

                    const safeStartIdx = Math.max(0, startIdx);
                    const safeEndIdx = endIdx === -1 ? dateRange.length - 1 : Math.min(dateRange.length - 1, endIdx);
                    const spanDays = safeEndIdx - safeStartIdx + 1;

                    const left = safeStartIdx * colWidth;
                    const width = spanDays * colWidth;

                    // Style categorization variables
                    let isOpportunity = false;
                    let isTimeOff = false;
                    let blockTitle = '';
                    let blockLabel = '';
                    let showPersonIcon = false;
                    let showUserCheckIcon = false;

                    if (viewMode === 'requests' && lane.request) {
                      const req = lane.request;
                      isOpportunity = req.billableType === 'Opportunity';
                      const assignedRes = req.resourceId ? resources.find((r) => r.id === req.resourceId) : null;
                      if (assignedRes) {
                        blockTitle = `Assigned Resource: ${assignedRes.name}\nRequired Skill: ${req.requiredSkill || 'General'}\nDates: ${req.startDate} to ${req.endDate}\nCommitment: ${req.billablePercent}%\nNotes: ${req.notes || ''}`;
                        blockLabel = `Assigned: ${assignedRes.name}`;
                        showUserCheckIcon = true;
                      } else {
                        blockTitle = `Required Skill: ${req.requiredSkill || 'General'}\nDates: ${req.startDate} to ${req.endDate}\nCommitment: ${req.billablePercent}%\nNotes: ${req.notes || ''}`;
                        blockLabel = req.requiredSkill || 'Skill Set Required';
                        showPersonIcon = true;
                      }
                    } else if (viewMode === 'projects' || (viewMode === 'requests' && lane.resource)) {
                      const p = row.project;
                      if (!p) return null;
                      isOpportunity = alloc.billableType === 'Opportunity' || p.isOpportunity || (p.name || '').toLowerCase().includes('opportunity') || (p.client || '').toLowerCase().includes('opportunity');
                      isTimeOff = (p.name || '').toLowerCase().includes('time off') || (p.name || '').toLowerCase().includes('absence') || (p.name || '').toLowerCase().includes('vacation');
                      blockTitle = `${lane.resource?.name || 'Resource'}: ${alloc.billablePercent}% (${alloc.billableType})`;
                      blockLabel = lane.resource?.name || 'Resource';
                    } else {
                      const pr = lane.project;
                      if (!pr) return null;
                      isOpportunity = alloc.billableType === 'Opportunity' || pr.isOpportunity || (pr.name || '').toLowerCase().includes('opportunity') || (pr.client || '').toLowerCase().includes('opportunity');
                      isTimeOff = (pr.name || '').toLowerCase().includes('time off') || (pr.name || '').toLowerCase().includes('absence') || (pr.name || '').toLowerCase().includes('vacation');
                      blockTitle = `${pr.name || 'TMS'} Project: ${alloc.billablePercent}% (${alloc.billableType})`;
                      blockLabel = pr.name || 'Project';
                    }

                    let colorClass = 'bg-[#5c8fcb]'; // muted blue
                    let borderClass = 'border-[#4274b0]';
                    let textClass = 'text-white';
                    let borderStyle = 'border-l-4';

                    if (viewMode === 'requests' && lane.request) {
                      if (lane.request.resourceId) {
                        colorClass = 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-800';
                        borderClass = 'border-blue-300 border-2';
                        textClass = 'text-blue-800';
                        borderStyle = 'border-l-4 border-l-blue-500';
                      } else {
                        colorClass = 'bg-blue-50/95 hover:bg-blue-100/90 text-blue-800';
                        borderClass = 'border-blue-400 border-2 border-dashed';
                        textClass = 'text-blue-800';
                        borderStyle = '';
                      }
                    } else if (isTimeOff) {
                      colorClass = 'bg-slate-200 bg-stripes';
                      borderClass = 'border-slate-300';
                      textClass = 'text-slate-500';
                    } else if (isOpportunity) {
                      colorClass = 'bg-[#a78bfa]'; // muted purple
                      borderClass = 'border-[#8b5cf6]';
                      textClass = 'text-white';
                    }

                    return (
                      <div
                        key={alloc.id}
                        style={{
                          left: `${left}px`,
                          width: `${width - 2}px`,
                          height: '38px',
                        }}
                        onClick={() => {
                          if (viewMode === 'requests' && lane.request) {
                            setSelectedRequestForSkills(lane.request || null);
                          } else {
                            onEditAllocation(alloc);
                          }
                        }}
                        className={`absolute select-none overflow-hidden text-left p-1.5 rounded-lg ${borderStyle} transition-transform hover:scale-[1.02] cursor-pointer shadow-sm flex flex-col justify-between ${colorClass} ${borderClass} ${textClass} z-[5]`}
                        title={blockTitle}
                      >
                        <div className="flex justify-between items-center gap-1.5 w-full">
                          <div className="flex items-center justify-between gap-1 min-w-0 flex-1">
                            <span className="text-[10px] font-bold tracking-tight uppercase leading-none truncate pr-1" title={blockLabel}>
                              {blockLabel}
                            </span>
                            {showPersonIcon && (
                              <User className="w-3 h-3 text-blue-600 hover:scale-110 transition-transform shrink-0" />
                            )}
                            {showUserCheckIcon && (
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 hover:scale-110 transition-transform shrink-0" />
                            )}
                          </div>
                          <span className="text-[8px] opacity-90 px-1 bg-white/20 rounded font-semibold leading-none shrink-0 ml-1">
                            {alloc.billablePercent}%
                          </span>
                        </div>
                        <div className="flex justify-between items-end leading-none w-full">
                          {(viewMode !== 'requests' || !lane.request) ? (
                            <span className="text-[9px] font-medium opacity-85 truncate mr-2">
                              {isTimeOff ? 'Time Off' : isOpportunity ? 'Opportunity' : 'Billable'}
                            </span>
                          ) : (
                            <div className="flex-1" />
                          )}
                          {!showPersonIcon && !showUserCheckIcon && (
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 hover:opacity-100 animate-fade-in ml-auto shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  const requestProject = useMemo(() => {
    if (!selectedRequestForSkills) return null;
    return projects.find((p) => p.id === selectedRequestForSkills.projectId) || null;
  }, [selectedRequestForSkills, projects]);

  const matchingResources = useMemo(() => {
    if (!selectedRequestForSkills) return [];
    
    const reqSkill = (selectedRequestForSkills.requiredSkill || '').toLowerCase();
    
    const list = resources.map(res => {
      const resourceSkills = res.skills || [];
      const hasSkill = resourceSkills.some(sk => sk.toLowerCase().includes(reqSkill));
      return {
        ...res,
        hasSkill,
      };
    });

    const search = popupSearch.toLowerCase().trim();
    const filtered = list.filter(res => {
      if (!search) return true;
      const matchName = res.name.toLowerCase().includes(search);
      const matchRole = res.role.toLowerCase().includes(search);
      const matchSkill = (res.skills || []).some(sk => sk.toLowerCase().includes(search));
      return matchName || matchRole || matchSkill;
    });

    return filtered.sort((a, b) => {
      // Prioritize the currently assigned resource at the very top
      const isAAssigned = selectedRequestForSkills.resourceId === a.id;
      const isBAssigned = selectedRequestForSkills.resourceId === b.id;
      if (isAAssigned && !isBAssigned) return -1;
      if (!isAAssigned && isBAssigned) return 1;

      if (a.hasSkill && !b.hasSkill) return -1;
      if (!a.hasSkill && b.hasSkill) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [selectedRequestForSkills, resources, popupSearch]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" id="scheduler-grid-main-board">
      {/* Scrollable grid area */}
      <div className="overflow-x-auto select-none relative max-h-[600px] scrollbar-thin">
        <div style={{ width: `calc(190px + ${gridWidth}px)` }} className="flex flex-col">
          
          {/* Header Row 1: Months */}
          <div className="flex bg-slate-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider h-10 items-center">
            <div className="w-[190px] min-w-[190px] border-r border-gray-100 px-4 flex items-center bg-slate-50 sticky left-0 z-20 h-full">
              {(viewMode === 'projects' || viewMode === 'requests') ? 'Projects' : 'Resources'}
            </div>
            {monthsHeader.map((m) => (
              <div
                key={m.monthName}
                style={{ width: `${m.count * colWidth}px` }}
                className="text-left pl-4 font-semibold text-gray-700 tracking-wide border-r border-gray-100"
              >
                {m.monthName}
              </div>
            ))}
          </div>

          {/* Header Row 2: Days */}
          <div className="flex bg-slate-50 border-b border-gray-200 text-[11px] font-semibold text-gray-400 h-10 items-center">
            <div className="w-[190px] min-w-[190px] border-r border-gray-100 px-4 flex items-center bg-slate-50 sticky left-0 z-20 h-full">
              <span className="text-gray-400 text-[10px] uppercase">
                {(viewMode === 'projects' || viewMode === 'requests') ? 'RESOURCE ALLOCATION' : 'PROJECT ALLOCATION'}
              </span>
            </div>
            {dateRange.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${colWidth}px` }}
                className={`text-center h-full flex flex-col justify-center border-r border-gray-100 ${
                  day.isWeekend ? 'bg-slate-100/50 text-gray-300' : ''
                }`}
              >
                <span>{day.dayLabel}</span>
                <span className="font-bold text-gray-600">{day.dayNum}</span>
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="divide-y divide-gray-100">
            {assignmentRows.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-slate-50 text-gray-400 text-sm">
                {(viewMode === 'projects' || viewMode === 'requests') ? 'No active projects found matching search filters.' : 'No active resources found matching search filters.'}
              </div>
            ) : (
              assignmentRows.map((row) => renderRow(row))
            )}


          </div>
        </div>
      </div>

      {/* Candidate Resources with Skills Popup Modal */}
      {selectedRequestForSkills && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" id="resources-skills-popup">
          <div className="bg-white dark:bg-[#0b101f] border border-gray-100 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[550px] transform transition-all animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0c1224]">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-600" /> Skill Matcher
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">
                  Project: <span className="font-bold text-slate-600 dark:text-slate-300">{requestProject?.name || 'Unknown Project'}</span>
                </p>
              </div>
              <button 
                onClick={() => {
                  setSelectedRequestForSkills(null);
                  setPopupSearch('');
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Details */}
            <div className="px-5 py-3.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100/50 dark:border-blue-900/30 flex justify-between items-center text-xs">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded uppercase tracking-wider">
                    {selectedRequestForSkills.requiredSkill || 'General Skill'}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    {selectedRequestForSkills.billablePercent}% Allocation
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium truncate italic" title={selectedRequestForSkills.notes}>
                  "{selectedRequestForSkills.notes || 'No notes provided.'}"
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-500 font-bold bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-2.5 py-1 rounded-lg shadow-xs">
                <div>📅 {selectedRequestForSkills.startDate}</div>
                <div className="text-gray-400 dark:text-gray-500 font-medium">to {selectedRequestForSkills.endDate}</div>
              </div>
            </div>

            {/* Candidate Search Bar */}
            <div className="p-3 bg-white dark:bg-[#0b101f] border-b border-gray-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search resources by name, role or skill..."
                  value={popupSearch}
                  onChange={(e) => setPopupSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-slate-50/50 dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Resources List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 p-3 space-y-2">
              {matchingResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-xs">
                  <User className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
                  No resources matched your search.
                </div>
              ) : (
                matchingResources.map((res) => {
                  const reqSkill = (selectedRequestForSkills.requiredSkill || '').toLowerCase();
                  return (
                    <div 
                      key={res.id} 
                      className={`p-3 rounded-lg border transition-all flex items-start gap-3 ${
                        res.hasSkill 
                          ? 'bg-blue-50/20 dark:bg-blue-950/5 border-blue-100/70 dark:border-blue-900/30' 
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Avatar */}
                      {res.avatarUrl ? (
                        <img
                          referrerPolicy="no-referrer"
                          src={res.avatarUrl}
                          alt={res.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-100 dark:border-slate-800 mt-0.5"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {(res.name || '').split(' ').map((n) => n[0] || '').join('')}
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{res.name}</h4>
                          <span className="text-[9px] text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate capitalize">{res.role}</span>
                          {res.hasSkill && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 rounded-full flex items-center gap-0.5 uppercase tracking-wide">
                              <Check className="w-2.5 h-2.5 stroke-[3]" /> Match
                            </span>
                          )}
                        </div>
                        
                        {/* Skills badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(res.skills || []).map((sk) => {
                            const isExactMatch = sk.toLowerCase().includes(reqSkill);
                            return (
                              <span 
                                key={sk} 
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                                  isExactMatch 
                                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-bold' 
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800'
                                }`}
                              >
                                {sk}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action */}
                      {selectedRequestForSkills.resourceId === res.id ? (
                        <button
                          onClick={() => {
                            if (onUnassignRequest) {
                              onUnassignRequest(selectedRequestForSkills.id);
                            }
                            setSelectedRequestForSkills(null);
                            setPopupSearch('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                        >
                          Unassign <X className="w-3 h-3 stroke-[3]" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (onApproveRequestWithResource) {
                              onApproveRequestWithResource(selectedRequestForSkills.id, res.id);
                            }
                            setSelectedRequestForSkills(null);
                            setPopupSearch('');
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                            res.hasSkill
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          Assign <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer info */}
            <div className="p-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 text-center font-medium bg-slate-50/50 dark:bg-[#0c1224]">
              Showing all database resources sorted by match suitability
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
