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
  getRequestBlockBackground,
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
import { SkillMatcherModal } from './SkillMatcherModal';

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
                      const isAssigned = !!lane.request.resourceId;
                      const category = row.project
                        ? getProjectCategory(row.project)
                        : 'Billable';
                      if (isAssigned) {
                        blockCategory = category;
                        blockChrome = getAllocationBlockChrome(category);
                        blockSurfaceStyle = getAllocationBlockBackground(
                          alloc.billablePercent,
                          blockChrome,
                        );
                      } else {
                        blockChrome = getRequestBlockChrome(category);
                        blockSurfaceStyle = getRequestBlockBackground(blockChrome);
                      }
                      textClass = blockChrome.textClass;
                      badgeClass = blockChrome.badgeClass;
                      if (!isAssigned) {
                        borderClass = 'border border-dotted';
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
                              <User className="w-3 h-3 text-secondary hover:scale-110 transition-transform shrink-0" />
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
                          {(viewMode !== 'requests' || !lane.request || !!lane.request.resourceId) ? (
                            <span className="text-[9px] font-medium opacity-85 truncate mr-2">
                              {isTimeOff ? 'Time Off' : blockCategory || (lane.request ? 'Open request' : 'Billable')}
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

      <SkillMatcherModal
        isOpen={!!selectedRequestForSkills}
        request={selectedRequestForSkills}
        requestProject={requestProject}
        popupSearch={popupSearch}
        matchingResources={matchingResources}
        onClose={() => {
          setSelectedRequestForSkills(null);
          setPopupSearch('');
        }}
        onSearchChange={setPopupSearch}
        onUnassignRequest={onUnassignRequest}
        onApproveRequestWithResource={onApproveRequestWithResource}
      />
    </div>
  );
};
