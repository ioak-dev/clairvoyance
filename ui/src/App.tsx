/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Resource, Project, AllocationBlock, Vacation, BookingRequest } from './types';

// Components
import { SchedulerGrid, type SchedulerGridHandle } from './components/SchedulerGrid';
import { VacationTab } from './components/VacationTab';
import { ProjectTab } from './components/ProjectTab';
import { ResourceTab } from './components/ResourceTab';
import { RequestsTab } from './components/RequestsTab';
import { DashboardTab } from './components/DashboardTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { LabTab } from './components/LabTab';
import { FilterSidebar } from './components/FilterSidebar';
import { ScheduleEntityDrawer } from './components/ScheduleEntityDrawer';
import type { FilterFormValues } from './components/FilterFormModal';
import {
  Button,
  IconButton,
  Menu,
  DropdownMenuButton,
  DropdownMenuItems,
  DropdownMenuItem,
  Switch,
} from './components/ui';
import { cn } from './lib/cn';

// Modals
import {
  CapacityFinderModal,
  ScheduleModal,
  RequestModal,
  EditAllocationModal,
  AddResourceModal,
  AddProjectModal,
  type ScheduleApplyScope,
  type ScheduleEditPatch,
} from './components/Modals';

// Icons
import {
  Users,
  FolderKanban,
  Clock,
  X,
  Sun,
  Moon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
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
import {
  useCopyRequestToSchedule,
  useDeleteSchedule,
  useDeleteSchedulesByRequest,
  useReplaceScheduleRange,
  useSchedules,
  useSplitSchedule,
  useUpsertSchedule,
  scheduleQueryKeys,
} from './hooks/useSchedules';
import { useCreateVacation, useDeleteVacation, useUpdateVacation, useVacations } from './hooks/useVacations';
import { usePersonFilters, useProjectFilters, useRequestFilters } from './hooks/useFilters';
import { useLookups } from './hooks/useLookups';
import { useQueryClient } from '@tanstack/react-query';
import type { Roster, SavedFilter, ScheduleUnit } from './types';
import {
  ROUTES,
  DEFAULT_ROUTE,
  parsePathname,
  isScheduleArea,
} from './lib/routes';
import { CURRENT_DATE_STRING } from './lib/dateUtils';

function navMenuItemClass(isActive: boolean): string {
  return cn(
    'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium tracking-[0.02em] leading-none transition-colors cursor-pointer whitespace-nowrap',
    isActive
      ? 'bg-nav-active text-primary'
      : 'text-secondary hover:text-primary hover:bg-surface-hover',
  );
}

function navMenuIconClass(isActive: boolean): string {
  return cn('w-[15px] h-[15px] shrink-0', isActive ? 'text-primary' : 'text-tertiary');
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
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={navMenuItemClass(isActive)}
      leftIcon={<Icon className={navMenuIconClass(isActive)} strokeWidth={1.75} />}
      rightIcon={
        showChevron ? (
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-tertiary transition-transform',
              chevronOpen && 'rotate-180',
            )}
            strokeWidth={1.75}
          />
        ) : undefined
      }
    >
      {label}
    </Button>
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

  // Modal Visibility States (declared early so full-list fetch can gate on them)
  const [isCapacityFinderOpen, setIsCapacityFinderOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [selectedEditBlock, setSelectedEditBlock] = useState<AllocationBlock | null>(null);
  const [editApplyScope, setEditApplyScope] = useState<ScheduleApplyScope>('entire');
  const [editPartialRange, setEditPartialRange] = useState<{ startDate: string; endDate: string } | null>(null);

  // Pre-fill states for quick scheduling
  const [prefilledResourceId, setPrefilledResourceId] = useState('');
  const [prefilledProjectId, setPrefilledProjectId] = useState('');
  const [prefilledStartDate, setPrefilledStartDate] = useState('');
  const [prefilledEndDate, setPrefilledEndDate] = useState('');

  const { data: resources = [], isPending: isPendingPeople } = usePeople();
  const { data: projects = [], isPending: isPendingProjects } = useProjects();
  // Full schedule list only when dashboard / reports / capacity finder need it.
  const needsFullScheduleList =
    activeTab === 'dashboard' || activeTab === 'reports' || isCapacityFinderOpen;
  const { data: scheduleAssignments = [] } = useSchedules(needsFullScheduleList);
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
  const upsertSchedule = useUpsertSchedule();
  const replaceScheduleRange = useReplaceScheduleRange();
  const splitSchedule = useSplitSchedule();
  const copyRequestToSchedule = useCopyRequestToSchedule();
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
  const schedulerGridRef = useRef<SchedulerGridHandle>(null);
  const timelineDateInputRef = useRef<HTMLInputElement>(null);
  const timelineCommittedDateRef = useRef(CURRENT_DATE_STRING);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEntityDrawerOpen, setIsEntityDrawerOpen] = useState(false);
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);
  const [hideUnbooked, setHideUnbooked] = useState(false);
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
    setFocusedEntityId(null);
    const id = filter?.id ?? null;
    if (filterViewContext === 'projects') setActiveProjectFilterId(id);
    else if (filterViewContext === 'resources') setActivePersonFilterId(id);
    else setActiveRequestFilterId(id);
  }, [filterViewContext]);

  useEffect(() => {
    setFocusedEntityId(null);
  }, [filterViewContext]);

  // Auto-select first available filter when entering a tab with no active filter
  useEffect(() => {
    if (!activeFilterId && sidebarFilters.length > 0) {
      handleSelectFilter(sidebarFilters[0]);
    }
  }, [filterViewContext, sidebarFilters, activeFilterId, handleSelectFilter]);

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

  // Operational State Mutators
  const handleSaveNewAllocation = async (params: {
    resourceId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    unit: ScheduleUnit;
    roster: Roster;
    title?: string;
    billableType?: import('./types').BillableType;
    bookingType: import('./types').BookingCommitmentType;
  }) => {
    await upsertSchedule.mutateAsync({
      personId: params.resourceId,
      projectId: params.projectId,
      startDate: params.startDate,
      endDate: params.endDate,
      unit: params.unit,
      roster: params.roster,
      title: params.title,
      billableType: params.billableType ?? null,
      bookingType: params.bookingType,
    });
  };

  const handleUpdateBlock = async (block: AllocationBlock, patch: ScheduleEditPatch) => {
    if (patch.applyScope === 'partial') {
      await replaceScheduleRange.mutateAsync({
        id: block.scheduleId,
        rangeStart: patch.startDate,
        rangeEnd: patch.endDate,
        unit: patch.unit,
        roster: patch.roster,
        title: patch.title,
      });
      return;
    }
    await upsertSchedule.mutateAsync({
      id: block.scheduleId,
      personId: block.resourceId,
      projectId: block.projectId,
      requestId: block.requestId,
      billableType: patch.billableType !== undefined ? patch.billableType : (block.billableType ?? null),
      bookingType: block.bookingType,
      title: patch.title,
      startDate: patch.startDate,
      endDate: patch.endDate,
      unit: patch.unit,
      roster: patch.roster,
    });
  };

  const handleDeleteBlock = async (block: AllocationBlock) => {
    await deleteSchedule.mutateAsync(block.scheduleId);
  };

  const handleSplitBlock = useCallback(
    async (block: AllocationBlock, splitDate: string) => {
      await splitSchedule.mutateAsync({ id: block.scheduleId, splitDate });
    },
    [splitSchedule],
  );

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
    await copyRequestToSchedule.mutateAsync({ requestId: id, personId: proposal.resourceId });
    await refreshSchedulingData();
  };

  const handleApproveRequestWithResource = useCallback(async (requestId: string, resourceId: string) => {
    await copyRequestToSchedule.mutateAsync({ requestId, personId: resourceId });
    await refreshSchedulingData();
  }, [copyRequestToSchedule, refreshSchedulingData]);

  const handleUnassignRequest = useCallback(async (requestId: string) => {
    await deleteSchedulesByRequest.mutateAsync(requestId);
    const updatedRequest = await updateRequest.mutateAsync({
      id: requestId,
      patch: { resourceId: '', status: 'Pending' },
    });

    queryClient.setQueryData<BookingRequest[]>(requestQueryKeys.list(), (current) =>
      current?.map((r) => (r.id === updatedRequest.id ? updatedRequest : r)),
    );

    await refreshSchedulingData();
  }, [deleteSchedulesByRequest, updateRequest, queryClient, refreshSchedulingData]);

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

  const handleEditBlock = useCallback((
    block: AllocationBlock,
    options?: {
      applyScope?: ScheduleApplyScope;
      partialRange?: { startDate: string; endDate: string } | null;
    },
  ) => {
    setEditApplyScope(options?.applyScope ?? 'entire');
    setEditPartialRange(options?.partialRange ?? null);
    setSelectedEditBlock(block);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setSelectedEditBlock(null);
    setEditApplyScope('entire');
    setEditPartialRange(null);
  }, []);

  const handleOpenScheduleModalWithRes = useCallback((
    resId: string,
    projId?: string,
    startDate?: string,
    endDate?: string,
  ) => {
    setPrefilledResourceId(resId);
    setPrefilledProjectId(projId || '');
    setPrefilledStartDate(startDate || '');
    setPrefilledEndDate(endDate || '');
    setIsScheduleModalOpen(true);
  }, []);

  const handleAddResourceClick = useCallback(() => {
    setIsAddResourceModalOpen(true);
  }, []);

  const handleAddProjectClick = useCallback(() => {
    setIsAddProjectModalOpen(true);
  }, []);

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
              onClick={() => navigate(ROUTES.schedulePeople)}
            />
            <NavMenuItem
              label="Time Off"
              icon={Palmtree}
              isActive={activeTab === 'vacation'}
              onClick={() => navigate(ROUTES.timeOff)}
            />

            {/* Master Data dropdown */}
            <Menu>
              {({ open }) => (
                <>
                  <DropdownMenuButton
                    variant="ghost"
                    className={navMenuItemClass(
                      activeTab === 'projects' || activeTab === 'resources' || open,
                    )}
                    leftIcon={
                      <Database
                        className={navMenuIconClass(
                          activeTab === 'projects' || activeTab === 'resources' || open,
                        )}
                        strokeWidth={1.75}
                      />
                    }
                    rightIcon={
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 text-tertiary transition-transform',
                          open && 'rotate-180',
                        )}
                        strokeWidth={1.75}
                      />
                    }
                  >
                    Master Data
                  </DropdownMenuButton>
                  <DropdownMenuItems
                    anchor="bottom start"
                    className="w-72 rounded-2xl p-2"
                    id="master-data-menu"
                  >
                    <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] mb-1 px-2">
                      Master Data
                    </p>
                    {(
                      [
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
                      ] as const
                    ).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.tab;
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            'rounded-xl px-3 py-2.5 items-start gap-3',
                            isActive && 'bg-surface-muted',
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-[15px] h-[15px] mt-0.5 shrink-0',
                              isActive ? 'text-primary' : 'text-tertiary',
                            )}
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium tracking-[0.02em] text-primary">
                              {item.label}
                            </span>
                            <span className="block text-xs text-secondary leading-snug tracking-wide mt-0.5">
                              {item.description}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuItems>
                </>
              )}
            </Menu>

            <NavMenuItem
              label="Dashboard"
              icon={LayoutDashboard}
              isActive={activeTab === 'dashboard'}
              onClick={() => navigate(ROUTES.dashboard)}
            />
            <NavMenuItem
              label="Reports"
              icon={BarChart3}
              isActive={activeTab === 'reports'}
              onClick={() => navigate(ROUTES.reports)}
            />
            <NavMenuItem
              label="Lab"
              icon={FlaskConical}
              isActive={activeTab === 'lab'}
              onClick={() => navigate(ROUTES.lab)}
            />
            <NavMenuItem
              label="Settings"
              icon={Settings}
              isActive={activeTab === 'settings'}
              onClick={() => navigate(ROUTES.settings)}
            />
          </nav>

        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <IconButton
            label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            id="theme-toggle-button"
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full text-tertiary"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </IconButton>

          <div className="relative flex items-center gap-2.5 pl-2 border-l border-default">
            <div className="text-right hidden sm:block">
              <span className="text-sm font-medium text-primary block leading-tight">Elizabeth Taylor</span>
              <span className="text-xs text-tertiary block">Resource Planner</span>
            </div>
            <Menu>
              <DropdownMenuButton
                variant="ghost"
                size="icon"
                id="user-menu-button"
                className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 hover:ring-2 hover:ring-blue-400/50"
                aria-label="User menu"
              >
                ET
              </DropdownMenuButton>
              <DropdownMenuItems className="w-52" id="user-menu-dropdown">
                <div className="px-3 py-2 border-b border-subtle sm:hidden">
                  <p className="text-sm font-medium text-primary">Elizabeth Taylor</p>
                  <p className="text-xs text-tertiary">Resource Planner</p>
                </div>
                <DropdownMenuItem onClick={() => navigate(ROUTES.settings)}>
                  <Settings className="w-4 h-4 text-tertiary shrink-0" />
                  Profile settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  className="border-t border-subtle"
                  onClick={() => window.alert('Logged out (demo)')}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuItems>
            </Menu>
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
                  const alreadyHere = sidebarActive === 'projects' && activeTab === 'scheduler';
                  navigate(ROUTES.scheduleProjects);
                  setIsDrawerOpen(false);
                  setIsEntityDrawerOpen(alreadyHere ? (prev) => !prev : true);
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
                  const alreadyHere = sidebarActive === 'resources' && activeTab === 'scheduler';
                  navigate(ROUTES.schedulePeople);
                  setIsDrawerOpen(false);
                  setIsEntityDrawerOpen(alreadyHere ? (prev) => !prev : true);
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
                  const alreadyHere = activeTab === 'requests';
                  setIsEntityDrawerOpen(false);
                  navigate(ROUTES.scheduleRequests);
                  setIsDrawerOpen(alreadyHere ? (prev) => !prev : true);
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
          </aside>
        )}

        <ScheduleEntityDrawer
          isOpen={
            isEntityDrawerOpen &&
            !isDrawerOpen &&
            activeTab === 'scheduler' &&
            (sidebarActive === 'projects' || sidebarActive === 'resources')
          }
          mode={sidebarActive === 'projects' ? 'projects' : 'resources'}
          onClose={() => setIsEntityDrawerOpen(false)}
          onManageFilters={() => {
            setIsEntityDrawerOpen(false);
            setIsDrawerOpen(true);
          }}
          projects={projects}
          resources={resources}
          filters={sidebarFilters}
          activeFilterId={activeFilterId}
          focusedEntityId={focusedEntityId}
          onSelectFilter={handleSelectFilter}
          onFocusEntity={setFocusedEntityId}
        />

        <FilterSidebar
          isOpen={isScheduleArea(activeTab) && isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onBack={
            activeTab === 'scheduler'
              ? () => {
                  setIsDrawerOpen(false);
                  setIsEntityDrawerOpen(true);
                }
              : undefined
          }
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
            <div className="flex flex-col flex-1 min-h-0 gap-2">



              {/* Calendar navigation */}
              <div className="shrink-0 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-0.5 bg-surface-muted/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      title="Previous week"
                      aria-label="Previous week"
                      onClick={() => schedulerGridRef.current?.scrollByWeeks(-1)}
                      className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Today"
                      aria-label="Jump to today"
                      onClick={() => {
                        timelineCommittedDateRef.current = CURRENT_DATE_STRING;
                        if (timelineDateInputRef.current) {
                          timelineDateInputRef.current.value = CURRENT_DATE_STRING;
                        }
                        schedulerGridRef.current?.focusToday();
                      }}
                      className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                      <Circle className="w-2.5 h-2.5 fill-current" />
                    </button>
                    <button
                      type="button"
                      title="Next week"
                      aria-label="Next week"
                      onClick={() => schedulerGridRef.current?.scrollByWeeks(1)}
                      className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-[var(--app-border)] mx-1" />
                    <label
                      title="Jump to date"
                      aria-label="Jump to date"
                      className="relative p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <input
                        ref={timelineDateInputRef}
                        type="date"
                        defaultValue={CURRENT_DATE_STRING}
                        onChange={(e) => {
                          const next = e.target.value;
                          // Native date inputs fire change only when a full day is chosen
                          // (not while browsing months).
                          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
                          if (next === timelineCommittedDateRef.current) return;
                          timelineCommittedDateRef.current = next;
                          schedulerGridRef.current?.focusOnDate(next);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label="Choose date"
                      />
                    </label>
                </div>

                {activeTab === 'scheduler' && (
                  <div className="inline-flex items-center gap-2.5">
                    <Switch
                      checked={hideUnbooked}
                      onChange={setHideUnbooked}
                      aria-label={
                        sidebarActive === 'projects'
                          ? 'Hide projects with no bookings'
                          : 'Hide resources with no bookings'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setHideUnbooked((v) => !v)}
                      className="text-[12px] text-secondary hover:text-primary transition-colors cursor-pointer text-left"
                    >
                      Hide {sidebarActive === 'projects' ? 'projects' : 'resources'} with no bookings
                    </button>
                  </div>
                )}
              </div>


              {/* Main Timeline Allocation Grid Board */}
              <div className="flex-1 min-h-0">
              <SchedulerGrid
                ref={schedulerGridRef}
                resources={resources}
                projects={projects}
                vacations={vacations}
                requests={requests}
                filterCriteria={filterCriteria}
                focusedEntityId={focusedEntityId}
                hideUnbooked={hideUnbooked}
                isEntitiesLoading={isPendingPeople || isPendingProjects}
                viewMode={activeTab === 'requests' ? 'requests' : sidebarActive}
                onEditBlock={handleEditBlock}
                onSplitBlock={handleSplitBlock}
                onDeleteBlock={handleDeleteBlock}
                onOpenScheduleModalWithRes={handleOpenScheduleModalWithRes}
                onAddResourceClick={handleAddResourceClick}
                onAddProjectClick={handleAddProjectClick}
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
              assignments={scheduleAssignments}
              requests={requests}
              vacations={vacations}
              referenceDate={CURRENT_DATE_STRING}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              resources={resources}
              projects={projects}
              assignments={scheduleAssignments}
              requests={requests}
              vacations={vacations}
            />
          )}

          {activeTab === 'lab' && <LabTab />}

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

      {/* 3. Global Interactives Modals Shells — mount only when open */}
      {isCapacityFinderOpen && (
        <CapacityFinderModal
          isOpen={isCapacityFinderOpen}
          onClose={() => setIsCapacityFinderOpen(false)}
          resources={resources}
          projects={projects}
          assignments={scheduleAssignments}
          onBookResource={handleBookFromCapacityFinder}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          resources={resources}
          projects={projects}
          onSave={handleSaveNewAllocation}
          initialResourceId={prefilledResourceId}
          initialProjectId={prefilledProjectId}
          initialStartDate={prefilledStartDate || CURRENT_DATE_STRING}
          initialEndDate={prefilledEndDate || CURRENT_DATE_STRING}
        />
      )}

      {isRequestModalOpen && (
        <RequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          resources={resources}
          projects={projects}
          onSave={handleSaveBookingRequest}
        />
      )}

      {selectedEditBlock && (
        <EditAllocationModal
          isOpen
          onClose={handleCloseEditModal}
          block={selectedEditBlock}
          projects={projects}
          resources={resources}
          onUpdate={handleUpdateBlock}
          onDelete={handleDeleteBlock}
          initialApplyScope={editApplyScope}
          initialPartialRange={editPartialRange}
        />
      )}

      {isAddResourceModalOpen && (
        <AddResourceModal
          isOpen={isAddResourceModalOpen}
          onClose={() => setIsAddResourceModalOpen(false)}
          onAdd={handleAddResource}
        />
      )}

      {isAddProjectModalOpen && (
        <AddProjectModal
          isOpen={isAddProjectModalOpen}
          onClose={() => setIsAddProjectModalOpen(false)}
          onAdd={handleAddProject}
        />
      )}

    </div>
  );
}
