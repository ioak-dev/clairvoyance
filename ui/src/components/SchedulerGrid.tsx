/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Resource, Project, Allocation, Vacation, BookingRequest } from '../types';
import { Edit2, AlertCircle, Info, Calendar, Plus, User, X, Check, Award, Search, UserCheck, Loader2 } from 'lucide-react';
import {
  getProjectCategory,
  getAllocationBlockChrome,
  getRequestBlockChrome,
  getAllocationBlockBackground,
  SCHEDULE_BLOCK_BADGE_CLASS,
  type ProjectCategory,
  type AllocationBlockChrome,
} from '../lib/projectCategory';
import {
  filterPeople,
  filterProjects,
  filterRequests,
} from '../lib/filterEngine';
import { buildDateRange, addDays } from '../lib/dateUtils';
import { useSchedulesInRange } from '../hooks/useSchedules';
import { useHorizontalTimelineWindow } from '../hooks/useHorizontalTimelineWindow';

const COL_WIDTH = 52;
const FETCH_BUFFER_DAYS = 21;

interface SchedulerGridProps {
  resources: Resource[];
  projects: Project[];
  allocations: Allocation[];
  vacations: Vacation[];
  requests?: BookingRequest[];
  filterCriteria?: Record<string, unknown> | null;
  timelineStartDate: string;
  timelineEndDate: string;
  viewMode?: 'resources' | 'projects' | 'requests';
  onEditAllocation: (alloc: Allocation) => void;
  onOpenScheduleModalWithRes: (resId: string, projId?: string) => void;
  onAddResourceClick: () => void;
  onAddProjectClick?: () => void;
  onApproveRequestWithResource?: (requestId: string, resourceId: string) => void | Promise<void>;
  onUnassignRequest?: (requestId: string) => void | Promise<void>;
}

export const SchedulerGrid: React.FC<SchedulerGridProps> = ({
  resources,
  projects,
  allocations: _allocations,
  vacations,
  requests = [],
  filterCriteria = null,
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

  const { scrollRef, windowStart, windowEnd, handleScroll } = useHorizontalTimelineWindow(
    timelineStartDate,
    timelineEndDate,
  );

  const fetchStart = addDays(windowStart, -FETCH_BUFFER_DAYS);
  const fetchEnd = addDays(windowEnd, FETCH_BUFFER_DAYS);
  const {
    data: rangeAllocations = [],
    isFetching: isFetchingSchedules,
  } = useSchedulesInRange(fetchStart, fetchEnd);

  const allocations = rangeAllocations;

  const onTimelineScroll = useCallback(() => {
    handleScroll(COL_WIDTH);
  }, [handleScroll]);

  const dateRange = useMemo(
    () => buildDateRange(windowStart, windowEnd),
    [windowStart, windowEnd],
  );

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
  const colWidth = COL_WIDTH;
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
      projects.forEach((proj) => {
        const projRequests = filterRequests(
          requests.filter((r) => r.projectId === proj.id && (r.status === 'Pending' || r.status === 'Approved')),
          filterCriteria,
          projects,
        );

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
      const filteredProjects = filterProjects(projects, filterCriteria);

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
      const filteredResources = filterPeople(resources, filterCriteria);

      filteredResources.forEach((res) => {
        // Find all allocations for this resource
        const resAllocs = allocations.filter((a) => a.resourceId === res.id);
        
        // Get unique project IDs this resource is allocated to
        const allocatedProjIds = Array.from(new Set(resAllocs.map((a) => a.projectId)));

        const projectLanes: Lane[] = [];

        if (allocatedProjIds.length === 0) {
          // Render at least an empty lane pointing to an empty state or default project to invite booking
          projectLanes.push({
            project: { id: 'none', name: 'Unassigned', client: '-', color: 'bg-gray-400', textColor: 'text-gray-400' },
            allocs: [],
          });
        } else {
          allocatedProjIds.forEach((pId) => {
            const project = projects.find((p) => p.id === pId) || {
              id: pId,
              name: 'Project',
              client: 'Client',
              color: 'bg-emerald-500',
              textColor: 'text-white',
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
  }, [resources, projects, allocations, requests, filterCriteria, viewMode]);

  // Find vacations for a resource that overlap with the timeline
  const getApprovedVacationsForResource = (resourceId: string) => {
    return vacations.filter((v) => v.status === 'Approved' && v.resourceId === resourceId);
  };

  const renderRow = (row: typeof assignmentRows[0]) => {
    const resourceVacations = (viewMode === 'projects' || viewMode === 'requests') ? [] : (row.resource ? getApprovedVacationsForResource(row.resource.id) : []);
 
    return (
      <div key={row.id} className="flex hover:bg-surface-muted/60 items-stretch relative group border-b border-subtle min-h-[56px]">
        
        {/* Left Sticky Column */}
        <div className="w-[190px] min-w-[190px] border-r border-subtle px-4 bg-surface sticky left-0 z-20 flex items-center justify-between shadow-app-sm min-h-[56px]">
          <div className="flex items-center gap-2 overflow-hidden py-3 w-full">
            {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
              // Project Row Sticky Visual Details
              <div className="truncate text-left flex-1">
                <h4 className="text-xs font-black text-primary truncate" title={row.project.name}>{row.project.name}</h4>
              </div>
            ) : row.resource ? (
              // Resource Row Sticky Visual Details
              <>
                {row.resource.avatarUrl ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={row.resource.avatarUrl}
                    alt={row.resource.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-subtle"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                    {(row.resource.name || '').split(' ').map((n) => n[0] || '').join('')}
                  </div>
                )}
                <div className="truncate text-left flex-1">
                  <h4 className="text-xs font-bold text-primary truncate">{row.resource.name}</h4>
                  <p className="text-[10px] text-tertiary capitalize truncate">{row.resource.role}</p>
                </div>
              </>
            ) : null}
          </div>
 
          {/* Quick action button to trigger scheduling overlay */}
          {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
            <button
              onClick={() => onOpenScheduleModalWithRes('', row.project!.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-hover text-secondary rounded cursor-pointer transition-opacity"
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
                className={`h-full border-r border-subtle shrink-0 ${
                  day.isWeekend ? 'bg-weekend-cell' : ''
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
                className="absolute bg-slate-200 dark:bg-zinc-600 border border-slate-300 dark:border-zinc-500 text-slate-600 dark:text-slate-300 rounded px-2 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase pointer-events-none z-[4]"
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
                    let isTimeOff = false;
                    let blockCategory: ProjectCategory | null = null;
                    let blockTitle = '';
                    let blockLabel = '';
                    let showPersonIcon = false;
                    let showUserCheckIcon = false;

                    if (viewMode === 'requests' && lane.request) {
                      const req = lane.request;
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
                      isTimeOff = (p.name || '').toLowerCase().includes('time off') || (p.name || '').toLowerCase().includes('absence') || (p.name || '').toLowerCase().includes('vacation');
                      blockTitle = `${lane.resource?.name || 'Resource'}: ${alloc.billablePercent}% (${alloc.billableType})`;
                      blockLabel = lane.resource?.name || 'Resource';
                    } else {
                      const pr = lane.project;
                      if (!pr) return null;
                      isTimeOff = (pr.name || '').toLowerCase().includes('time off') || (pr.name || '').toLowerCase().includes('absence') || (pr.name || '').toLowerCase().includes('vacation');
                      blockTitle = `${pr.name || 'Project'}: ${alloc.billablePercent}% (${alloc.billableType})`;
                      blockLabel = pr.name || 'Project';
                    }

                    let colorClass = '';
                    let borderClass = 'border';
                    let textClass = 'text-slate-800';
                    let badgeClass = SCHEDULE_BLOCK_BADGE_CLASS;
                    let blockSurfaceStyle: React.CSSProperties | undefined;
                    let blockChrome: AllocationBlockChrome | null = null;

                    if (viewMode === 'requests' && lane.request) {
                      blockChrome = getRequestBlockChrome(!!lane.request.resourceId);
                      blockSurfaceStyle = getAllocationBlockBackground(alloc.billablePercent, blockChrome);
                      textClass = blockChrome.textClass;
                      badgeClass = blockChrome.badgeClass;
                      if (!lane.request.resourceId) {
                        borderClass = 'border border-dashed';
                      }
                    } else {
                      const proj =
                        lane.project ||
                        row.project ||
                        projects.find((p) => p.id === alloc.projectId);
                      if (proj) {
                        isTimeOff =
                          isTimeOff ||
                          (proj.name || '').toLowerCase().includes('time off') ||
                          (proj.name || '').toLowerCase().includes('absence') ||
                          (proj.name || '').toLowerCase().includes('vacation');
                        if (isTimeOff) {
                          colorClass = 'bg-slate-200 dark:bg-zinc-600';
                          borderClass = 'border-slate-300 dark:border-zinc-500';
                          textClass = 'text-slate-600 dark:text-slate-300';
                        } else {
                          blockCategory = getProjectCategory(proj);
                          blockChrome = getAllocationBlockChrome(blockCategory);
                          blockSurfaceStyle = getAllocationBlockBackground(
                            alloc.billablePercent,
                            blockChrome,
                          );
                          textClass = blockChrome.textClass;
                          badgeClass = blockChrome.badgeClass;
                        }
                      }
                    }

                    return (
                      <div
                        key={alloc.id}
                        style={{
                          left: `${left}px`,
                          width: `${width - 2}px`,
                          height: '38px',
                          ...blockSurfaceStyle,
                        }}
                        onClick={() => {
                          if (viewMode === 'requests' && lane.request) {
                            setSelectedRequestForSkills(lane.request || null);
                          } else {
                            onEditAllocation(alloc);
                          }
                        }}
                        className={`absolute select-none overflow-hidden text-left p-1.5 rounded-lg transition-transform hover:scale-[1.02] cursor-pointer shadow-sm flex flex-col justify-between ${colorClass} ${borderClass} ${textClass} z-[5]`}
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
                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold leading-none shrink-0 ml-1 border ${badgeClass}`}>
                            {alloc.billablePercent}%
                          </span>
                        </div>
                        <div className="flex justify-between items-end leading-none w-full">
                          {(viewMode !== 'requests' || !lane.request) ? (
                            <span className="text-[9px] font-medium opacity-85 truncate mr-2">
                              {isTimeOff ? 'Time Off' : blockCategory || 'Billable'}
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
    <div className="app-card overflow-hidden flex flex-col h-full min-h-0" id="scheduler-grid-main-board">
      {/* Scrollable grid — horizontal lazy load + vertical row scroll */}
      <div
        ref={scrollRef}
        onScroll={onTimelineScroll}
        className="flex-1 min-h-0 overflow-auto select-none relative scrollbar-thin"
      >
        {isFetchingSchedules && (
          <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 rounded-full bg-surface/95 border border-default px-2.5 py-1 text-[10px] font-medium text-secondary shadow-app-sm pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            Loading…
          </div>
        )}
        <div style={{ width: `calc(190px + ${gridWidth}px)` }} className="flex flex-col">
          
          {/* Header Row 1: Months */}
          <div className="flex bg-grid-header border-b border-subtle text-xs font-bold text-secondary uppercase tracking-wider h-10 items-center sticky top-0 z-30">
            <div className="w-[190px] min-w-[190px] border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40 h-full">
              {(viewMode === 'projects' || viewMode === 'requests') ? 'Projects' : 'Resources'}
            </div>
            {monthsHeader.map((m) => (
              <div
                key={m.monthName}
                style={{ width: `${m.count * colWidth}px` }}
                className="text-left pl-4 font-semibold text-primary tracking-wide border-r border-subtle"
              >
                {m.monthName}
              </div>
            ))}
          </div>

          {/* Header Row 2: Days */}
          <div className="flex bg-grid-header border-b border-default text-[11px] font-semibold text-tertiary h-10 items-center sticky top-10 z-30">
            <div className="w-[190px] min-w-[190px] border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40 h-full">
              <span className="text-tertiary text-[10px] uppercase">
                {(viewMode === 'projects' || viewMode === 'requests') ? 'RESOURCE ALLOCATION' : 'PROJECT ALLOCATION'}
              </span>
            </div>
            {dateRange.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${colWidth}px` }}
                className={`text-center h-full flex flex-col justify-center border-r border-subtle ${
                  day.isWeekend ? 'bg-weekend-cell text-tertiary' : ''
                }`}
              >
                <span>{day.dayLabel}</span>
                <span className="font-bold text-secondary">{day.dayNum}</span>
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="divide-y divide-gray-100">
            {assignmentRows.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-surface-muted text-tertiary text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" id="resources-skills-popup">
          <div className="bg-surface border border-subtle rounded-xl shadow-app-md w-full max-w-lg overflow-hidden flex flex-col h-[550px] transform transition-all animate-scale-up">
            
            {/* Modal Header */}
            <div className="app-card-header px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-600" /> Skill Matcher
                </h3>
                <p className="text-[11px] text-tertiary font-medium">
                  Project: <span className="font-bold text-secondary">{requestProject?.name || 'Unknown Project'}</span>
                </p>
              </div>
              <button 
                onClick={() => {
                  setSelectedRequestForSkills(null);
                  setPopupSearch('');
                }}
                className="p-1.5 rounded-lg text-tertiary hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Details */}
            <div className="px-5 py-3.5 tint-blue border-b border-subtle flex justify-between items-center text-xs">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 tint-blue rounded uppercase tracking-wider">
                    {selectedRequestForSkills.requiredSkill || 'General Skill'}
                  </span>
                  <span className="text-tertiary">•</span>
                  <span className="font-semibold text-secondary">
                    {selectedRequestForSkills.billablePercent}% Allocation
                  </span>
                </div>
                <div className="text-[10px] text-tertiary font-medium truncate italic" title={selectedRequestForSkills.notes}>
                  "{selectedRequestForSkills.notes || 'No notes provided.'}"
                </div>
              </div>
              <div className="text-right text-[10px] text-secondary font-bold bg-surface-raised border border-default px-2.5 py-1 rounded-lg shadow-app-sm">
                <div>📅 {selectedRequestForSkills.startDate}</div>
                <div className="text-tertiary font-medium">to {selectedRequestForSkills.endDate}</div>
              </div>
            </div>

            {/* Candidate Search Bar */}
            <div className="p-3 bg-surface border-b border-subtle">
              <div className="relative">
                <Search className="w-4 h-4 text-tertiary absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search resources by name, role or skill..."
                  value={popupSearch}
                  onChange={(e) => setPopupSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-default rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-input"
                />
              </div>
            </div>

            {/* Resources List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--app-border-subtle)] p-3 space-y-2">
              {matchingResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-tertiary text-xs">
                  <User className="w-8 h-8 text-tertiary mb-2 opacity-50" />
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
                          ? 'tint-blue' 
                          : 'bg-surface border-subtle hover:bg-surface-muted'
                      }`}
                    >
                      {/* Avatar */}
                      {res.avatarUrl ? (
                        <img
                          referrerPolicy="no-referrer"
                          src={res.avatarUrl}
                          alt={res.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-subtle mt-0.5"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full tint-blue text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                          {(res.name || '').split(' ').map((n) => n[0] || '').join('')}
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-primary truncate">{res.name}</h4>
                          <span className="text-[9px] text-tertiary">•</span>
                          <span className="text-[10px] text-secondary font-medium truncate capitalize">{res.role}</span>
                          {res.hasSkill && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 tint-emerald rounded-full flex items-center gap-0.5 uppercase tracking-wide">
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
                                    ? 'tint-blue font-bold' 
                                    : 'bg-surface-muted text-secondary border border-subtle'
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
                          onClick={async () => {
                            if (onUnassignRequest) {
                              await onUnassignRequest(selectedRequestForSkills.id);
                            }
                            setSelectedRequestForSkills(null);
                            setPopupSearch('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-app-sm flex items-center gap-1 cursor-pointer tint-red"
                        >
                          Unassign <X className="w-3 h-3 stroke-[3]" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (onApproveRequestWithResource) {
                              await onApproveRequestWithResource(selectedRequestForSkills.id, res.id);
                            }
                            setSelectedRequestForSkills(null);
                            setPopupSearch('');
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-app-sm flex items-center gap-1 cursor-pointer ${
                            res.hasSkill
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-surface-muted hover:bg-surface-hover text-primary'
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
            <div className="p-3 border-t border-subtle text-[10px] text-tertiary text-center font-medium bg-surface-muted">
              Showing all database resources sorted by match suitability
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
