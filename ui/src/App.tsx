/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Resource, Project, Allocation, Vacation, BookingRequest } from './types';
import {
  INITIAL_RESOURCES,
  INITIAL_PROJECTS,
  INITIAL_ALLOCATIONS,
  INITIAL_VACATIONS,
  INITIAL_REQUESTS,
  REQUESTS_TAB_MOCK_DATA,
} from './data';

// Components
import { SchedulerGrid } from './components/SchedulerGrid';
import { VacationTab } from './components/VacationTab';
import { ProjectTab } from './components/ProjectTab';
import { ResourceTab } from './components/ResourceTab';
import { RequestsTab } from './components/RequestsTab';
import { DashboardTab } from './components/DashboardTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';

// Modals
import {
  CapacityFinderModal,
  ScheduleModal,
  RequestModal,
  EditAllocationModal,
  AddResourceModal,
  AddProjectModal,
} from './components/Modals';

// Icons
import {
  Users,
  FolderKanban,
  Calendar,
  Search,
  FileSpreadsheet,
  LayoutDashboard,
  SlidersHorizontal,
  Settings,
  Plus,
  Compass,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
  Filter,
  X,
  Sun,
  Moon,
} from 'lucide-react';

const CURRENT_DATE_STRING = '2026-06-22'; // System date matching metadata

// Helper to compute weekdays (excluding Sat/Sun)
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

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('winplanner_dark_mode') === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('winplanner_dark_mode', String(darkMode));
    } catch (e) { }
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Navigation
  const [activeTab, setActiveTab] = useState<'scheduler' | 'vacation' | 'projects' | 'resources' | 'requests' | 'dashboard' | 'reports' | 'settings'>('scheduler');
  const [sidebarActive, setSidebarActive] = useState<'projects' | 'resources'>('resources');

  // Core Persisted Work States
  const [resources, setResources] = useState<Resource[]>(() => {
    try {
      const saved = localStorage.getItem('winplanner_resources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return INITIAL_RESOURCES;
    } catch (e) {
      console.warn("Storage restricted - using initial resources memory state:", e);
      return INITIAL_RESOURCES;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('winplanner_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return INITIAL_PROJECTS;
    } catch (e) {
      console.warn("Storage restricted - using initial projects memory state:", e);
      return INITIAL_PROJECTS;
    }
  });

  const [allocations, setAllocations] = useState<Allocation[]>(() => {
    try {
      const saved = localStorage.getItem('winplanner_allocations');
      const parsed = saved ? JSON.parse(saved) : INITIAL_ALLOCATIONS;
      const safeParsed = Array.isArray(parsed) ? parsed : INITIAL_ALLOCATIONS;
      return safeParsed.map((a: any) => ({
        ...a,
        billableType: a.billableType === 'Non-Billable' ? 'Opportunity' : a.billableType
      }));
    } catch (e) {
      console.warn("Storage restricted - using initial allocations memory state:", e);
      return INITIAL_ALLOCATIONS;
    }
  });

  const [vacations, setVacations] = useState<Vacation[]>(() => {
    try {
      const saved = localStorage.getItem('winplanner_vacations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return INITIAL_VACATIONS;
    } catch (e) {
      console.warn("Storage restricted - using initial vacations memory state:", e);
      return INITIAL_VACATIONS;
    }
  });

  const [requests, setRequests] = useState<BookingRequest[]>(() => {
    try {
      const saved = localStorage.getItem('winplanner_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8) {
          return parsed.map((r: any) => ({
            ...r,
            billableType: r.billableType === 'Non-Billable' ? 'Opportunity' : r.billableType
          }));
        }
      }
      return REQUESTS_TAB_MOCK_DATA;
    } catch (e) {
      console.warn("Storage restricted - using initial requests memory state:", e);
      return REQUESTS_TAB_MOCK_DATA;
    }
  });

  // Filter Query States
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineStartDate, setTimelineStartDate] = useState('2026-06-01');
  const [timelineEndDate, setTimelineEndDate] = useState('2026-07-25');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedFilterChip, setSelectedFilterChip] = useState<{
    type: 'resource' | 'group' | 'project';
    name: string;
    id?: string;
  } | null>(null);

  // Modal Visibility States
  const [isCapacityFinderOpen, setIsCapacityFinderOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [selectedEditAllocation, setSelectedEditAllocation] = useState<Allocation | null>(null);

  // Pre-fill states for quick scheduling
  const [prefilledResourceId, setPrefilledResourceId] = useState('');
  const [prefilledProjectId, setPrefilledProjectId] = useState('');
  const [prefilledStartDate, setPrefilledStartDate] = useState('');
  const [prefilledEndDate, setPrefilledEndDate] = useState('');

  // Save to LocalStorage side-effects
  useEffect(() => {
    try {
      localStorage.setItem('winplanner_resources', JSON.stringify(resources));
    } catch (e) {
      // Quiet fail if cookies / DOMStorage are blocked
    }
  }, [resources]);

  useEffect(() => {
    try {
      localStorage.setItem('winplanner_projects', JSON.stringify(projects));
    } catch (e) {
      // Quiet fail
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('winplanner_allocations', JSON.stringify(allocations));
    } catch (e) {
      // Quiet fail
    }
  }, [allocations]);

  useEffect(() => {
    try {
      localStorage.setItem('winplanner_vacations', JSON.stringify(vacations));
    } catch (e) {
      // Quiet fail
    }
  }, [vacations]);

  useEffect(() => {
    try {
      localStorage.setItem('winplanner_requests', JSON.stringify(requests));
    } catch (e) {
      // Quiet fail
    }
  }, [requests]);

  // Compute Scheduled Time hours dynamically to show in the gorgeous header metrics cards
  const scheduledTimeKPIs = useMemo(() => {
    let allHoursSum = 0;
    let toDateHoursSum = 0;
    let futureHoursSum = 0;

    allocations.forEach((alloc) => {
      // 1. Total Planned ALL Hours
      const totalWeekdays = calculateWeekdays(alloc.startDate, alloc.endDate);
      const allocHours = totalWeekdays * 8 * (alloc.billablePercent / 100);
      allHoursSum += allocHours;

      // 2. TO DATE Hours (Up to and including CURRENT_DATE_STRING: June 22, 2026)
      if (alloc.endDate <= CURRENT_DATE_STRING) {
        toDateHoursSum += allocHours;
      } else if (alloc.startDate <= CURRENT_DATE_STRING) {
        // Overlap split
        const partialWeekdaysToDate = calculateWeekdays(alloc.startDate, CURRENT_DATE_STRING);
        const partialHours = partialWeekdaysToDate * 8 * (alloc.billablePercent / 100);
        toDateHoursSum += partialHours;

        // Balance left represents future
        const remainingWeekdays = calculateWeekdays(
          new Date(new Date(CURRENT_DATE_STRING).getTime() + 86400000).toISOString().split('T')[0], // Day after June 22
          alloc.endDate
        );
        futureHoursSum += remainingWeekdays * 8 * (alloc.billablePercent / 100);
      } else {
        // Completely in future
        futureHoursSum += allocHours;
      }
    });

    return {
      all: Math.round(allHoursSum),
      toDate: Math.round(toDateHoursSum),
      future: Math.round(futureHoursSum),
    };
  }, [allocations]);

  // Operational State Mutators
  const handleSaveNewAllocation = (newAlloc: Omit<Allocation, 'id'>) => {
    const allocationId = `alloc-${Date.now()}`;
    const cleanAlloc: Allocation = {
      id: allocationId,
      ...newAlloc,
    };
    setAllocations((prev) => [...prev, cleanAlloc]);
  };

  const handleUpdateAllocation = (updatedAlloc: Allocation) => {
    setAllocations((prev) => prev.map((a) => (a.id === updatedAlloc.id ? updatedAlloc : a)));
  };

  const handleDeleteAllocation = (id: string) => {
    setAllocations((prev) => prev.filter((a) => a.id !== id));
  };

  const handleApproveVacation = (id: string) => {
    setVacations((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'Approved' } : v)));
  };

  const handleRejectVacation = (id: string) => {
    setVacations((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'Rejected' } : v)));
  };

  const handleSubmitVacation = (newVac: Omit<Vacation, 'id' | 'status'>) => {
    const cleanVac: Vacation = {
      id: `vac-${Date.now()}`,
      ...newVac,
      status: 'Pending',
    };
    setVacations((prev) => [...prev, cleanVac]);
  };

  const handleDeleteVacation = (id: string) => {
    setVacations((prev) => prev.filter((v) => v.id !== id));
  };

  const handleApproveRequest = (id: string) => {
    const proposal = requests.find((r) => r.id === id);
    if (!proposal) return;

    // Place allocation timeline event
    handleSaveNewAllocation({
      resourceId: proposal.resourceId,
      projectId: proposal.projectId,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      billablePercent: proposal.billablePercent,
      billableType: proposal.billableType,
    });

    // Mark proposal requested log as Approved
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Approved' } : r)));
  };

  const handleApproveRequestWithResource = (requestId: string, resourceId: string) => {
    const proposal = requests.find((r) => r.id === requestId);
    if (!proposal) return;

    // Place allocation timeline event
    handleSaveNewAllocation({
      resourceId: resourceId,
      projectId: proposal.projectId,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      billablePercent: proposal.billablePercent,
      billableType: proposal.billableType,
    });

    // Mark proposal requested log as Approved and set assigned resourceId
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, resourceId, status: 'Approved' } : r)));
  };

  const handleUnassignRequest = (requestId: string) => {
    const proposal = requests.find((r) => r.id === requestId);
    if (!proposal) return;

    if (proposal.resourceId) {
      // Find the allocation created for this request
      const matchingAlloc = allocations.find((a) =>
        a.resourceId === proposal.resourceId &&
        a.projectId === proposal.projectId &&
        a.startDate === proposal.startDate &&
        a.endDate === proposal.endDate
      );
      if (matchingAlloc) {
        setAllocations((prev) => prev.filter((a) => a.id !== matchingAlloc.id));
      }
    }

    // Mark proposal requested log as Pending and clear resourceId
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, resourceId: undefined, status: 'Pending' } : r)));
  };

  const handleRejectRequest = (id: string) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Rejected' } : r)));
  };

  const handleDeleteRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveBookingRequest = (newReq: Omit<BookingRequest, 'id' | 'status'>) => {
    const proposal: BookingRequest = {
      id: `req-${Date.now()}`,
      ...newReq,
      status: 'Pending',
    };
    setRequests((prev) => [proposal, ...prev]);
  };

  const handleAddResource = (newRes: Omit<Resource, 'id'>) => {
    setResources((prev) => [...prev, { id: `res-${Date.now()}`, ...newRes }]);
  };

  const handleDeleteResource = (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
    // Cascade delete allocations
    setAllocations((prev) => prev.filter((a) => a.resourceId !== id));
    // Cascade delete vacations
    setVacations((prev) => prev.filter((v) => v.resourceId !== id));
  };

  const handleAddProject = (newProj: Omit<Project, 'id'>) => {
    setProjects((prev) => [...prev, { id: `proj-${Date.now()}`, ...newProj }]);
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Cascade delete allocations
    setAllocations((prev) => prev.filter((a) => a.projectId !== id));
  };

  // Pre-fill schedule prompt from capacity helper
  const handleBookFromCapacityFinder = (resourceId: string, start: string, end: string) => {
    setPrefilledResourceId(resourceId);
    setPrefilledStartDate(start);
    setPrefilledEndDate(end);
    setIsScheduleModalOpen(true);
  };

  // Sidebar dynamic counts
  const projectsCount = projects.length;
  const staffCount = resources.length;

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col font-sans" id="winplanner-root-app">

      {/* 1. Global Navigation Bar Header matches screenshot layout */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-14 shrink-0 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-10">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img
              src={new URL('../assets/Westermnacher-logotype-gray.svg', import.meta.url).href}
              alt="Westermnacher"
              className="h-4 w-auto max-w-[240px] object-contain"
            />
          </div>

          {/* Core Navigation Tabs (Scheduler, Vacation, Dashboard, Reports, Settings) */}
          <nav className="flex h-14">
            {(['scheduler', 'vacation', 'projects', 'resources', 'dashboard', 'reports', 'settings'] as const).map((tab) => {
              const isActive = activeTab === 'requests' ? tab === 'scheduler' : activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-full px-5 text-xs font-bold uppercase tracking-wider relative flex items-center justify-center transition-all cursor-pointer ${isActive
                    ? 'text-blue-600 border-b-4 border-blue-500 font-extrabold bg-blue-50/20'
                    : 'text-gray-500 hover:text-gray-900 border-b-4 border-transparent hover:border-gray-205'
                    }`}
                >
                  {tab}
                </button>
              );
            })}
          </nav>

        </div>

        {/* Global profile user identifier client-safe */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-slate-50 text-gray-500 hover:text-gray-900 transition-all flex items-center justify-center cursor-pointer shadow-sm relative group dark:border-slate-800 dark:hover:bg-slate-800/85 dark:text-gray-300 dark:hover:text-white"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            id="theme-toggle-button"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 block uppercase">Administrator</span>
              <span className="text-xs font-bold text-gray-700 block truncate max-w-[160px]">
                divanshu.jagtani
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#4e82c2] text-white font-bold flex items-center justify-center shadow-sm">
              DJ
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Split Pane Body */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Vertical Sub-Panel: Projects and Resources triggers */}
        {(activeTab === 'scheduler' || activeTab === 'requests') && (
          <aside className="w-[110px] bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="flex flex-col gap-1 py-4 px-2">

              {/* Projects sidebar selector */}
              <button
                onClick={() => {
                  setSidebarActive('projects');
                  setSearchQuery('');
                  setDrawerSearch('');
                  setSelectedFilterChip(null);
                  setActiveTab('scheduler');
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${sidebarActive === 'projects' && activeTab === 'scheduler'
                  ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-slate-50'
                  }`}
              >
                <FolderKanban className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Projects
                  <span className="block text-[8px] text-gray-400 mt-1">({projectsCount})</span>
                </div>
              </button>

              {/* Resources sidebar selector */}
              <button
                onClick={() => {
                  setSidebarActive('resources');
                  setSearchQuery('');
                  setDrawerSearch('');
                  setSelectedFilterChip(null);
                  setActiveTab('scheduler');
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${sidebarActive === 'resources' && activeTab === 'scheduler'
                  ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-slate-50'
                  }`}
              >
                <Users className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Resources
                  <span className="block text-[8px] text-gray-400 mt-1">({staffCount})</span>
                </div>
              </button>

              {/* Request sidebar selector */}
              <button
                onClick={() => {
                  setActiveTab('requests');
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === 'requests'
                  ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-slate-50'
                  }`}
              >
                <Clock className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Request
                  <span className="block text-[8px] text-gray-400 mt-1">({requests.filter(r => r.status === 'Pending').length})</span>
                </div>
              </button>

            </div>

            {/* Filter icon button at the bottom wrapper */}
            <div className="mt-auto px-2 pt-2 pb-2 border-t border-gray-100">
              <button
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                className={`w-full py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${isDrawerOpen
                  ? 'bg-blue-600 text-white font-bold shadow-md'
                  : 'bg-slate-50 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-200'
                  }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-[9px] font-black tracking-tight uppercase">Filter</span>
              </button>
            </div>
          </aside>
        )}

        {/* Sidebar Drawer Panel */}
        {(activeTab === 'scheduler' || activeTab === 'requests') && isDrawerOpen && (
          activeTab === 'requests' ? (
            <div className="absolute left-[110px] top-0 bottom-0 w-80 bg-black border-r border-neutral-900 shadow-xl z-30 flex flex-col animate-fade-in">
              <div className="p-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-950">
                <div>
                  <h3 className="text-xs font-black text-neutral-400 uppercase tracking-wider">
                    Filters
                  </h3>
                  <p className="text-[10px] text-neutral-600 mt-0.5 font-medium">
                    Empty for Request Mode
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-neutral-200 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
                <Filter className="w-8 h-8 text-neutral-800 mb-2 animate-pulse" />
                <p className="text-[11px] font-bold text-neutral-600 tracking-wider uppercase">No Filters Available</p>
                <p className="text-[10px] text-neutral-700 mt-1 max-w-[200px]">
                  Filters are disabled when Request Tab is active
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute left-[110px] top-0 bottom-0 w-80 bg-white border-r border-gray-200 shadow-xl z-30 flex flex-col animate-fade-in">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    {sidebarActive === 'resources' ? 'Resource Workloads' : 'Project Assignments'}
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                    {sidebarActive === 'resources' ? 'Resource utilization & projects' : 'Project scope & resources'}
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filter input */}
              <div className="p-3 border-b border-gray-100 bg-white space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={
                      sidebarActive === 'resources'
                        ? 'Search resource or group...'
                        : 'Search projects or clients...'
                    }
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-slate-50/50 text-gray-850"
                  />
                </div>

                {/* Active Filter Chip Display */}
                {selectedFilterChip && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 animate-fade-in">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Filtered:</span>
                    <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 pl-2 pr-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                      <span className="truncate max-w-[150px]">
                        {selectedFilterChip.type === 'group' ? '👥' : selectedFilterChip.type === 'project' ? '📂' : '👤'} {selectedFilterChip.name}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFilterChip(null);
                          setSearchQuery('');
                        }}
                        className="p-0.5 hover:bg-blue-100 rounded-full text-blue-500 hover:text-blue-800 transition cursor-pointer"
                        title="Clear filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* List items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-slate-50/30">
                {sidebarActive === 'resources' ? (
                  // LIST OF ALL RESOURCES with number of projects assigned
                  (() => {
                    const filteredResources = resources.filter((res) => {
                      if (!drawerSearch) return true;
                      const q = drawerSearch.toLowerCase();
                      return (
                        (res.name || '').toLowerCase().includes(q) ||
                        (res.role || '').toLowerCase().includes(q) ||
                        (res.group || '').toLowerCase().includes(q)
                      );
                    });

                    if (filteredResources.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-gray-400">
                          No resources found matching the filter.
                        </div>
                      );
                    }

                    const groupedResources: { [groupName: string]: Resource[] } = {};
                    filteredResources.forEach((res) => {
                      const g = res.group || 'Unassigned';
                      if (!groupedResources[g]) {
                        groupedResources[g] = [];
                      }
                      groupedResources[g].push(res);
                    });

                    return Object.entries(groupedResources).map(([groupName, groupRes]) => {
                      const isGroupSelected = selectedFilterChip?.type === 'group' && selectedFilterChip.name === groupName;
                      return (
                        <div key={groupName} className="space-y-1.5 mb-4">
                          {/* Clickable Group Header */}
                          <div
                            onClick={() => {
                              if (isGroupSelected) {
                                setSelectedFilterChip(null);
                                setSearchQuery('');
                              } else {
                                setSelectedFilterChip({ type: 'group', name: groupName });
                                setSearchQuery(groupName);
                              }
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all select-none ${isGroupSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                              : 'bg-slate-100/85 text-slate-700 border-slate-200/50 hover:bg-blue-50 hover:border-blue-300'
                              }`}
                            title="Click to filter timeline by this group"
                          >
                            <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isGroupSelected ? 'text-white' : 'text-slate-500'
                              }`}>
                              👥 {groupName}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isGroupSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                              }`}>
                              {groupRes.length}
                            </span>
                          </div>

                          <div className="space-y-1 pl-4.5 border-l border-gray-100">
                            {groupRes.map((res) => {
                              const isResSelected = selectedFilterChip?.type === 'resource' && selectedFilterChip.id === res.id;

                              return (
                                <div
                                  key={res.id}
                                  onClick={() => {
                                    if (isResSelected) {
                                      setSelectedFilterChip(null);
                                      setSearchQuery('');
                                    } else {
                                      setSelectedFilterChip({ type: 'resource', name: res.name, id: res.id });
                                      setSearchQuery(res.name);
                                    }
                                  }}
                                  className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-md cursor-pointer transition-colors select-none ${isResSelected
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                  title="Click to filter timeline by this resource"
                                >
                                  <span className="truncate" title={res.name}>
                                    {res.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  // LIST OF ALL PROJECTS with number of resources assigned
                  (() => {
                    const filteredProjects = projects.filter((proj) => {
                      if (!drawerSearch) return true;
                      const q = drawerSearch.toLowerCase();
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

                    if (filteredProjects.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-gray-400">
                          No projects found matching the filter.
                        </div>
                      );
                    }

                    const groupedProjects: { [groupName: string]: Project[] } = {};
                    filteredProjects.forEach((proj) => {
                      const g = proj.group || 'Unassigned';
                      if (!groupedProjects[g]) {
                        groupedProjects[g] = [];
                      }
                      groupedProjects[g].push(proj);
                    });

                    return Object.entries(groupedProjects).map(([groupName, groupProjs]) => {
                      const isGroupSelected = selectedFilterChip?.type === 'group' && selectedFilterChip.name === groupName;
                      return (
                        <div key={groupName} className="space-y-1.5 mb-4">
                          {/* Clickable Group Header */}
                          <div
                            onClick={() => {
                              if (isGroupSelected) {
                                setSelectedFilterChip(null);
                                setSearchQuery('');
                              } else {
                                setSelectedFilterChip({ type: 'group', name: groupName });
                                setSearchQuery(groupName);
                              }
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all select-none ${isGroupSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                              : 'bg-slate-100/85 text-slate-700 border-slate-200/50 hover:bg-blue-50 hover:border-blue-300'
                              }`}
                            title="Click to filter timeline by this group"
                          >
                            <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isGroupSelected ? 'text-white' : 'text-slate-500'
                              }`}>
                              📂 {groupName}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isGroupSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                              }`}>
                              {groupProjs.length}
                            </span>
                          </div>

                          <div className="space-y-1 pl-4.5 border-l border-gray-100">
                            {groupProjs.map((proj) => {
                              const isProjSelected = selectedFilterChip?.type === 'project' && selectedFilterChip.id === proj.id;
                              return (
                                <div
                                  key={proj.id}
                                  onClick={() => {
                                    if (isProjSelected) {
                                      setSelectedFilterChip(null);
                                      setSearchQuery('');
                                    } else {
                                      setSelectedFilterChip({ type: 'project', name: proj.name, id: proj.id });
                                      setSearchQuery(proj.name);
                                    }
                                  }}
                                  className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-md cursor-pointer transition-colors select-none ${isProjSelected
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                  title="Click to filter timeline by this project"
                                >
                                  <span className="truncate" title={proj.name}>
                                    {proj.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          ))}

        {/* Right Active Work Area */}
        <main className="flex-1 p-8 overflow-y-auto bg-[#fafbfc]">

          {/* Main content tabs dispatching router routing */}
          {(activeTab === 'scheduler' || activeTab === 'requests') && (
            <div className="space-y-6">



              {/* Grid interactive Filters Toolbar exactly like visual mockup */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 p-2 shadow-sm flex items-center justify-between flex-wrap gap-4">

                <div className="flex items-center gap-1 flex-wrap flex-1 max-w-xl">
                  {/* Search filter input 
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Filter resources or roles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-slate-50/50"
                    />
                  </div>
*/}
                  {/* Interactive Date Range Selector with From and To date pickers */}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      🗓️ <span className="text-gray-400 dark:text-gray-500">From:</span>
                    </span>
                    <input
                      type="date"
                      value={timelineStartDate}
                      onChange={(e) => setTimelineStartDate(e.target.value)}
                      className="border-0 bg-transparent text-gray-800 dark:text-gray-100 font-bold p-0 focus:ring-0 focus:outline-none cursor-pointer text-xs w-[110px]"
                    />
                    <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                    <span className="text-gray-400 dark:text-gray-500">To:</span>
                    <input
                      type="date"
                      value={timelineEndDate}
                      onChange={(e) => setTimelineEndDate(e.target.value)}
                      className="border-0 bg-transparent text-gray-800 dark:text-gray-100 font-bold p-0 focus:ring-0 focus:outline-none cursor-pointer text-xs w-[110px]"
                    />
                  </div>
                </div>
              </div>


              {/* Main Timeline Allocation Grid Board */}
              <SchedulerGrid
                resources={resources}
                projects={projects}
                allocations={allocations}
                vacations={vacations}
                requests={requests}
                searchQuery={searchQuery}
                timelineStartDate={timelineStartDate}
                timelineEndDate={timelineEndDate}
                viewMode={activeTab === 'requests' ? 'requests' : sidebarActive}
                onEditAllocation={(alloc) => setSelectedEditAllocation(alloc)}
                onOpenScheduleModalWithRes={(resId, projId) => {
                  setPrefilledResourceId(resId);
                  setPrefilledProjectId(projId || '');
                  setPrefilledStartDate('2026-06-01');
                  setPrefilledEndDate('2026-06-15');
                  setIsScheduleModalOpen(true);
                }}
                onAddResourceClick={() => setIsAddResourceModalOpen(true)}
                onAddProjectClick={() => setIsAddProjectModalOpen(true)}
                onApproveRequestWithResource={handleApproveRequestWithResource}
                onUnassignRequest={handleUnassignRequest}
              />

            </div>
          )}

          {activeTab === 'vacation' && (
            <VacationTab
              vacations={vacations}
              resources={resources}
              onApproveVacation={handleApproveVacation}
              onRejectVacation={handleRejectVacation}
              onSubmitVacation={handleSubmitVacation}
              onDeleteVacation={handleDeleteVacation}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectTab
              projects={projects}
            />
          )}

          {activeTab === 'resources' && (
            <ResourceTab
              resources={resources}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab
              resources={resources}
              projects={projects}
              allocations={allocations}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              resources={resources}
              projects={projects}
              allocations={allocations}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              resources={resources}
              projects={projects}
              onAddResource={handleAddResource}
              onDeleteResource={handleDeleteResource}
              onAddProject={handleAddProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

        </main>
      </div>

      {/* 3. Global Interactives Modals Shells */}
      <CapacityFinderModal
        isOpen={isCapacityFinderOpen}
        onClose={() => setIsCapacityFinderOpen(false)}
        resources={resources}
        projects={projects}
        allocations={allocations}
        onBookResource={handleBookFromCapacityFinder}
      />

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        resources={resources}
        projects={projects}
        onSave={handleSaveNewAllocation}
        initialResourceId={prefilledResourceId}
        initialProjectId={prefilledProjectId}
        initialStartDate={prefilledStartDate || '2026-06-01'}
        initialEndDate={prefilledEndDate || '2026-06-15'}
      />

      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        resources={resources}
        projects={projects}
        onSave={handleSaveBookingRequest}
      />

      <EditAllocationModal
        isOpen={selectedEditAllocation !== null}
        onClose={() => setSelectedEditAllocation(null)}
        allocation={selectedEditAllocation}
        projects={projects}
        resources={resources}
        onUpdate={handleUpdateAllocation}
        onDelete={handleDeleteAllocation}
      />

      <AddResourceModal
        isOpen={isAddResourceModalOpen}
        onClose={() => setIsAddResourceModalOpen(false)}
        onAdd={handleAddResource}
      />

      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onAdd={handleAddProject}
      />

    </div>
  );
}
