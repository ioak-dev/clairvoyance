/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Resource, Project, Allocation, Vacation, BookingRequest } from './types';

// Components
import { SchedulerGrid } from './components/SchedulerGrid';
import { VacationTab } from './components/VacationTab';
import { ProjectTab } from './components/ProjectTab';
import { ResourceTab } from './components/ResourceTab';
import { RequestsTab } from './components/RequestsTab';
import { DashboardTab } from './components/DashboardTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { LabTab } from './components/LabTab';
import { FilterSidebar } from './components/FilterSidebar';
import type { FilterFormValues } from './components/FilterFormModal';

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
  Clock,
  Filter,
  X,
  Sun,
  Moon,
  ChevronDown,
  Settings,
  LogOut,
  CalendarDays,
  Palmtree,
  Database,
  LayoutDashboard,
  BarChart3,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { useCreatePerson, useDeletePerson, usePeople, useUpdatePerson } from './hooks/usePeople';
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from './hooks/useProjects';
import { useCreateRequest, useDeleteRequest, useRequests, useUpdateRequest, requestQueryKeys } from './hooks/useRequests';
import { useCreateSchedule, useDeleteSchedule, useDeleteSchedulesByRequest, useSchedules, useUpdateSchedule, scheduleQueryKeys } from './hooks/useSchedules';
import { useCreateVacation, useDeleteVacation, useUpdateVacation, useVacations } from './hooks/useVacations';
import { usePersonFilters, useProjectFilters, useRequestFilters } from './hooks/useFilters';
import { useLookups } from './hooks/useLookups';
import { useQueryClient } from '@tanstack/react-query';
import type { SavedFilter } from './types';
import {
  ROUTES,
  DEFAULT_ROUTE,
  parsePathname,
  isScheduleArea,
} from './lib/routes';
import { CURRENT_DATE_STRING, countWeekdays } from './lib/dateUtils';

// Helper to compute weekdays (excluding Sat/Sun) — re-exported via dateUtils
const calculateWeekdays = countWeekdays;

function navMenuItemClass(isActive: boolean): string {
  return `inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium tracking-[0.02em] leading-none transition-colors cursor-pointer whitespace-nowrap ${
    isActive
      ? 'bg-nav-active text-primary'
      : 'text-secondary hover:text-primary hover:bg-surface-hover'
  }`;
}

function navMenuIconClass(isActive: boolean): string {
  return `w-[15px] h-[15px] shrink-0 ${isActive ? 'text-primary' : 'text-tertiary'}`;
}

type NavMenuItemProps = {
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick: () => void;
  showChevron?: boolean;
  chevronOpen?: boolean;
};

function NavMenuItem({
  label,
  icon: Icon,
  isActive = false,
  onClick,
  showChevron = false,
  chevronOpen = false,
}: NavMenuItemProps) {
  return (
    <button type="button" onClick={onClick} className={navMenuItemClass(isActive)}>
      <Icon className={navMenuIconClass(isActive)} strokeWidth={1.75} />
      <span>{label}</span>
      {showChevron && (
        <ChevronDown
          className={`w-3.5 h-3.5 text-tertiary transition-transform ${chevronOpen ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}

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

  const location = useLocation();
  const navigate = useNavigate();
  const route = parsePathname(location.pathname);
  const activeTab = route?.tab ?? 'scheduler';
  const sidebarActive = route?.scheduleSidebar ?? 'resources';

  const [masterDataMenuOpen, setMasterDataMenuOpen] = useState(false);
  const masterDataMenuRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!masterDataMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (masterDataMenuRef.current && !masterDataMenuRef.current.contains(e.target as Node)) {
        setMasterDataMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [masterDataMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const { data: resources = [] } = usePeople();
  const { data: projects = [] } = useProjects();
  const { data: allocations = [] } = useSchedules();
  const { data: vacations = [] } = useVacations();
  const { data: requests = [] } = useRequests();
  const {
    data: projectFilters = [],
    create: createProjectFilter,
    update: updateProjectFilter,
    remove: deleteProjectFilter,
  } = useProjectFilters();
  const {
    data: personFilters = [],
    create: createPersonFilter,
    update: updatePersonFilter,
    remove: deletePersonFilter,
  } = usePersonFilters();
  const {
    data: requestFilters = [],
    create: createRequestFilter,
    update: updateRequestFilter,
    remove: deleteRequestFilter,
  } = useRequestFilters();
  const { data: lookups } = useLookups();

  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const deleteSchedulesByRequest = useDeleteSchedulesByRequest();
  const createVacation = useCreateVacation();
  const updateVacation = useUpdateVacation();
  const deleteVacation = useDeleteVacation();

  const queryClient = useQueryClient();
  const refreshSchedulingData = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: requestQueryKeys.all }),
      queryClient.refetchQueries({ queryKey: scheduleQueryKeys.all }),
    ]);
  }, [queryClient]);

  // Filter state
  const [timelineStartDate, setTimelineStartDate] = useState('2026-06-01');
  const [timelineEndDate, setTimelineEndDate] = useState('2027-12-31');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeProjectFilterId, setActiveProjectFilterId] = useState<string | null>(null);
  const [activePersonFilterId, setActivePersonFilterId] = useState<string | null>(null);
  const [activeRequestFilterId, setActiveRequestFilterId] = useState<string | null>(null);

  const filterViewContext = useMemo(() => {
    if (activeTab === 'requests') return 'requests' as const;
    return sidebarActive === 'projects' ? ('projects' as const) : ('resources' as const);
  }, [activeTab, sidebarActive]);

  const sidebarFilters = useMemo(() => {
    if (filterViewContext === 'projects') return projectFilters;
    if (filterViewContext === 'resources') return personFilters;
    return requestFilters;
  }, [filterViewContext, projectFilters, personFilters, requestFilters]);

  const activeFilterId = useMemo(() => {
    if (filterViewContext === 'projects') return activeProjectFilterId;
    if (filterViewContext === 'resources') return activePersonFilterId;
    return activeRequestFilterId;
  }, [filterViewContext, activeProjectFilterId, activePersonFilterId, activeRequestFilterId]);

  const filterCriteria = useMemo(() => {
    if (!activeFilterId) return null;
    const match = sidebarFilters.find((f) => f.id === activeFilterId);
    return match?.criteria ?? null;
  }, [activeFilterId, sidebarFilters]);

  const handleSelectFilter = useCallback((filter: SavedFilter | null) => {
    const id = filter?.id ?? null;
    if (filterViewContext === 'projects') setActiveProjectFilterId(id);
    else if (filterViewContext === 'resources') setActivePersonFilterId(id);
    else setActiveRequestFilterId(id);
  }, [filterViewContext]);

  const handleCreateFilter = useCallback(async (values: FilterFormValues) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      criteria: values.criteria,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
    };
    if (filterViewContext === 'projects') await createProjectFilter.mutateAsync(payload);
    else if (filterViewContext === 'resources') await createPersonFilter.mutateAsync(payload);
    else await createRequestFilter.mutateAsync(payload);
  }, [filterViewContext, createProjectFilter, createPersonFilter, createRequestFilter]);

  const handleUpdateFilter = useCallback(async (id: string, values: FilterFormValues) => {
    const patch = {
      name: values.name,
      description: values.description || undefined,
      criteria: values.criteria,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
    };
    if (filterViewContext === 'projects') await updateProjectFilter.mutateAsync({ id, patch });
    else if (filterViewContext === 'resources') await updatePersonFilter.mutateAsync({ id, patch });
    else await updateRequestFilter.mutateAsync({ id, patch });
  }, [filterViewContext, updateProjectFilter, updatePersonFilter, updateRequestFilter]);

  const handleDeleteFilter = useCallback(async (id: string) => {
    if (filterViewContext === 'projects') await deleteProjectFilter.mutateAsync(id);
    else if (filterViewContext === 'resources') await deletePersonFilter.mutateAsync(id);
    else await deleteRequestFilter.mutateAsync(id);
  }, [filterViewContext, deleteProjectFilter, deletePersonFilter, deleteRequestFilter]);

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
  const handleSaveNewAllocation = async (newAlloc: Omit<Allocation, 'id'>) => {
    await createSchedule.mutateAsync(newAlloc);
  };

  const handleUpdateAllocation = async (updatedAlloc: Allocation) => {
    await updateSchedule.mutateAsync(updatedAlloc);
  };

  const handleDeleteAllocation = async (id: string) => {
    await deleteSchedule.mutateAsync(id);
  };

  const handleApproveVacation = async (id: string) => {
    await updateVacation.mutateAsync({ id, patch: { status: 'Approved' } });
  };

  const handleRejectVacation = async (id: string) => {
    await updateVacation.mutateAsync({ id, patch: { status: 'Rejected' } });
  };

  const handleSubmitVacation = async (newVac: Omit<Vacation, 'id' | 'status'>) => {
    await createVacation.mutateAsync(newVac);
  };

  const handleDeleteVacation = async (id: string) => {
    await deleteVacation.mutateAsync(id);
  };

  const handleApproveRequest = async (id: string) => {
    const proposal = requests.find((r) => r.id === id);
    if (!proposal || !proposal.resourceId) return;

    await deleteSchedulesByRequest.mutateAsync(id);

    await createSchedule.mutateAsync({
      resourceId: proposal.resourceId,
      projectId: proposal.projectId,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      billablePercent: proposal.billablePercent,
      billableType: proposal.billableType,
      requestId: proposal.id,
    });

    const updatedRequest = await updateRequest.mutateAsync({
      id,
      patch: { resourceId: proposal.resourceId, status: 'Approved' },
    });

    queryClient.setQueryData<BookingRequest[]>(requestQueryKeys.list(), (current) =>
      current?.map((r) => (r.id === updatedRequest.id ? updatedRequest : r)),
    );

    await refreshSchedulingData();
  };

  const handleApproveRequestWithResource = async (requestId: string, resourceId: string) => {
    const proposal = requests.find((r) => r.id === requestId);
    if (!proposal) return;

    // Replace any existing schedule for this request (reassignment support).
    await deleteSchedulesByRequest.mutateAsync(requestId);

    await createSchedule.mutateAsync({
      resourceId,
      projectId: proposal.projectId,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      billablePercent: proposal.billablePercent,
      billableType: proposal.billableType,
      requestId,
    });

    const updatedRequest = await updateRequest.mutateAsync({
      id: requestId,
      patch: { resourceId, status: 'Approved' },
    });

    queryClient.setQueryData<BookingRequest[]>(requestQueryKeys.list(), (current) =>
      current?.map((r) => (r.id === updatedRequest.id ? updatedRequest : r)),
    );

    await refreshSchedulingData();
  };

  const handleUnassignRequest = async (requestId: string) => {
    await deleteSchedulesByRequest.mutateAsync(requestId);
    const updatedRequest = await updateRequest.mutateAsync({
      id: requestId,
      patch: { resourceId: '', status: 'Pending' },
    });

    queryClient.setQueryData<BookingRequest[]>(requestQueryKeys.list(), (current) =>
      current?.map((r) => (r.id === updatedRequest.id ? updatedRequest : r)),
    );

    await refreshSchedulingData();
  };

  const handleRejectRequest = async (id: string) => {
    await deleteSchedulesByRequest.mutateAsync(id);
    await updateRequest.mutateAsync({ id, patch: { status: 'Rejected' } });

    await refreshSchedulingData();
  };

  const handleDeleteRequest = async (id: string) => {
    await deleteSchedulesByRequest.mutateAsync(id);
    await deleteRequest.mutateAsync(id);

    await refreshSchedulingData();
  };

  const handleSaveBookingRequest = async (newReq: Omit<BookingRequest, 'id' | 'status'>) => {
    await createRequest.mutateAsync(newReq);
  };

  const handleAddResource = async (newRes: Omit<Resource, 'id'>) => {
    await createPerson.mutateAsync(newRes);
  };

  const handleUpdateResource = async (updatedRes: Resource) => {
    await updatePerson.mutateAsync(updatedRes);
  };

  const handleDeleteResource = async (id: string) => {
    await deletePerson.mutateAsync(id);
  };

  const handleAddProject = async (newProj: Omit<Project, 'id'>) => {
    await createProject.mutateAsync(newProj);
  };

  const handleUpdateProject = async (updatedProj: Project) => {
    await updateProject.mutateAsync(updatedProj);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject.mutateAsync(id);
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

  if (!route) {
    return <Navigate to={DEFAULT_ROUTE} replace />;
  }

  return (
    <div className="h-screen bg-canvas flex flex-col font-sans overflow-hidden" id="winplanner-root-app">

      {/* 1. Global Navigation Bar Header */}
      <header className="bg-header border-b border-default z-40 h-14 shrink-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">

          {/* Logo */}
          <a href={ROUTES.schedulePeople} className="flex items-center gap-2 shrink-0" onClick={(e) => { e.preventDefault(); navigate(ROUTES.schedulePeople); }}>
            <img
              src={new URL('../assets/Westermnacher-logotype-gray.svg', import.meta.url).href}
              alt="Westermnacher"
              className="app-logo h-4 w-auto max-w-[240px] object-contain"
            />
          </a>

          {/* Core Navigation */}
          <nav className="flex items-center gap-0.5" aria-label="Main">
            <NavMenuItem
              label="Schedule"
              icon={CalendarDays}
              isActive={isScheduleArea(activeTab)}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.schedulePeople);
              }}
            />
            <NavMenuItem
              label="Time Off"
              icon={Palmtree}
              isActive={activeTab === 'vacation'}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.timeOff);
              }}
            />

            {/* Master Data dropdown */}
            <div className="relative" ref={masterDataMenuRef}>
              <NavMenuItem
                label="Master Data"
                icon={Database}
                isActive={activeTab === 'projects' || activeTab === 'resources' || masterDataMenuOpen}
                showChevron
                chevronOpen={masterDataMenuOpen}
                onClick={() => setMasterDataMenuOpen((open) => !open)}
              />

              {masterDataMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-surface-raised rounded-2xl shadow-app-md border border-subtle p-3 z-50">
                  <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] mb-2 px-2">
                    Master Data
                  </p>
                  <div className="space-y-0.5">
                    {([
                      {
                        path: ROUTES.masterProjects,
                        tab: 'projects' as const,
                        label: 'Projects',
                        description: 'Portfolio, clients, and assignments',
                        icon: FolderKanban,
                      },
                      {
                        path: ROUTES.masterPeople,
                        tab: 'resources' as const,
                        label: 'People',
                        description: 'Team members, roles, and capacity',
                        icon: Users,
                      },
                    ]).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.tab;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            navigate(item.path);
                            setMasterDataMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
                            isActive ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                          }`}
                        >
                          <Icon className={`w-[15px] h-[15px] mt-0.5 shrink-0 ${isActive ? 'text-primary' : 'text-tertiary'}`} strokeWidth={1.75} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium tracking-[0.02em] text-primary">{item.label}</div>
                            <div className="text-xs text-secondary leading-snug tracking-wide mt-0.5">{item.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <NavMenuItem
              label="Dashboard"
              icon={LayoutDashboard}
              isActive={activeTab === 'dashboard'}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.dashboard);
              }}
            />
            <NavMenuItem
              label="Reports"
              icon={BarChart3}
              isActive={activeTab === 'reports'}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.reports);
              }}
            />
            <NavMenuItem
              label="Lab"
              icon={FlaskConical}
              isActive={activeTab === 'lab'}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.lab);
              }}
            />
            <NavMenuItem
              label="Settings"
              icon={Settings}
              isActive={activeTab === 'settings'}
              onClick={() => {
                setMasterDataMenuOpen(false);
                navigate(ROUTES.settings);
              }}
            />
          </nav>

        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full text-tertiary hover:text-primary hover:bg-surface-hover transition-colors flex items-center justify-center cursor-pointer"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            id="theme-toggle-button"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-500" style={{ animationDuration: '6s' }} />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <div className="relative flex items-center gap-2.5 pl-2 border-l border-default" ref={userMenuRef}>
            <div className="text-right hidden sm:block">
              <span className="text-sm font-medium text-primary block leading-tight">Elizabeth Taylor</span>
              <span className="text-xs text-tertiary block">Resource Planner</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMasterDataMenuOpen(false);
                setUserMenuOpen((open) => !open);
              }}
              className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:ring-2 hover:ring-blue-400/50 transition-shadow cursor-pointer"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              id="user-menu-button"
            >
              ET
            </button>

            {userMenuOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-52 bg-surface-raised rounded-xl shadow-app-md border border-subtle py-1 z-50"
                role="menu"
                id="user-menu-dropdown"
              >
                <div className="px-3 py-2 border-b border-subtle sm:hidden">
                  <p className="text-sm font-medium text-primary">Elizabeth Taylor</p>
                  <p className="text-xs text-tertiary">Resource Planner</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setMasterDataMenuOpen(false);
                    navigate(ROUTES.settings);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-surface-muted flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-tertiary shrink-0" />
                  Profile settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    window.alert('Logged out (demo)');
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-surface-muted flex items-center gap-2.5 transition-colors cursor-pointer border-t border-subtle"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Split Pane Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Left rail — fixed to viewport, does not scroll with page content */}
        {isScheduleArea(activeTab) && (
          <aside className="fixed top-14 left-0 bottom-0 z-40 w-[110px] bg-rail border-r border-default flex flex-col shrink-0">
            <div className="flex flex-col gap-1 py-4 px-2 flex-1 min-h-0 overflow-y-auto">

              {/* Projects sidebar selector */}
              <button
                onClick={() => {
                  setActiveProjectFilterId(null);
                  navigate(ROUTES.scheduleProjects);
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${sidebarActive === 'projects' && activeTab === 'scheduler'
                  ? 'tint-blue font-bold border'
                  : 'text-tertiary hover:text-primary hover:bg-surface-muted'
                  }`}
              >
                <FolderKanban className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Projects
                  <span className="block text-[8px] text-tertiary mt-1">({projectsCount})</span>
                </div>
              </button>

              {/* Resources sidebar selector */}
              <button
                onClick={() => {
                  setActivePersonFilterId(null);
                  navigate(ROUTES.schedulePeople);
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${sidebarActive === 'resources' && activeTab === 'scheduler'
                  ? 'tint-blue font-bold border'
                  : 'text-tertiary hover:text-primary hover:bg-surface-muted'
                  }`}
              >
                <Users className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Resources
                  <span className="block text-[8px] text-tertiary mt-1">({staffCount})</span>
                </div>
              </button>

              {/* Request sidebar selector */}
              <button
                onClick={() => {
                  setActiveRequestFilterId(null);
                  navigate(ROUTES.scheduleRequests);
                }}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${activeTab === 'requests'
                  ? 'tint-blue font-bold border'
                  : 'text-tertiary hover:text-primary hover:bg-surface-muted'
                  }`}
              >
                <Clock className="w-5 h-5" />
                <div className="text-[10px] font-semibold text-center leading-none">
                  Request
                  <span className="block text-[8px] text-tertiary mt-1">({requests.filter(r => r.status === 'Pending').length})</span>
                </div>
              </button>

            </div>

            {/* Filter — pinned to bottom of fixed rail */}
            <div className="shrink-0 px-2 pt-2 pb-3 border-t border-subtle bg-rail">
              <button
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                className={`w-full py-2.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isDrawerOpen
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-secondary hover:text-blue-500 hover:bg-surface-muted'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-[9px] font-semibold tracking-wide">Filter</span>
              </button>
            </div>
          </aside>
        )}

        <FilterSidebar
          isOpen={isScheduleArea(activeTab) && isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          viewContext={filterViewContext}
          filters={sidebarFilters}
          activeFilterId={activeFilterId}
          lookups={lookups}
          onSelectFilter={handleSelectFilter}
          onCreateFilter={handleCreateFilter}
          onUpdateFilter={handleUpdateFilter}
          onDeleteFilter={handleDeleteFilter}
        />

        {/* Right Active Work Area */}
        <main
          className={`flex-1 min-h-0 bg-canvas-subtle ${
            isScheduleArea(activeTab)
              ? 'ml-[110px] p-8 overflow-hidden flex flex-col'
              : 'p-8 overflow-y-auto'
          }`}
        >

          {/* Main content tabs dispatching router routing */}
          {isScheduleArea(activeTab) && (
            <div className="flex flex-col flex-1 min-h-0 gap-6">



              {/* Grid interactive Filters Toolbar exactly like visual mockup */}
              <div className="app-card p-2 shrink-0 flex items-center justify-between flex-wrap gap-4">

                <div className="flex items-center gap-1 flex-wrap flex-1 max-w-xl">
                  {/* Interactive Date Range Selector with From and To date pickers */}
                  <div className="flex items-center gap-2 bg-surface-muted p-2 border border-default rounded-lg text-xs font-bold text-primary">
                    <span className="flex items-center gap-1">
                      🗓️ <span className="text-tertiary">From:</span>
                    </span>
                    <input
                      type="date"
                      value={timelineStartDate}
                      onChange={(e) => setTimelineStartDate(e.target.value)}
                      className="border-0 bg-transparent text-primary font-bold p-0 focus:ring-0 focus:outline-none cursor-pointer text-xs w-[110px]"
                    />
                    <span className="text-tertiary mx-1">→</span>
                    <span className="text-tertiary">To:</span>
                    <input
                      type="date"
                      value={timelineEndDate}
                      onChange={(e) => setTimelineEndDate(e.target.value)}
                      className="border-0 bg-transparent text-primary font-bold p-0 focus:ring-0 focus:outline-none cursor-pointer text-xs w-[110px]"
                      title="Maximum scroll range"
                    />
                  </div>
                </div>
              </div>


              {/* Main Timeline Allocation Grid Board */}
              <div className="flex-1 min-h-0">
              <SchedulerGrid
                resources={resources}
                projects={projects}
                allocations={allocations}
                vacations={vacations}
                requests={requests}
                filterCriteria={filterCriteria}
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
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activeTab === 'resources' && (
            <ResourceTab
              resources={resources}
              onAddResource={handleAddResource}
              onUpdateResource={handleUpdateResource}
              onDeleteResource={handleDeleteResource}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab
              resources={resources}
              projects={projects}
              allocations={allocations}
              requests={requests}
              vacations={vacations}
              referenceDate={CURRENT_DATE_STRING}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              resources={resources}
              projects={projects}
              allocations={allocations}
            />
          )}

          {activeTab === 'lab' && <LabTab requests={requests} resources={resources} projects={projects} />}

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
