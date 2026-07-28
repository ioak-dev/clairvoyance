import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Award, Check, List, RotateCcw, Search, User, X } from 'lucide-react';
import type {
  AvailabilityMode,
  BookingRequest,
  JobCategory,
  PersonUtilizationResult,
  Project,
  WeekAllocation,
} from '../types';
import { useLookups } from '../hooks/useLookups';
import { personUtilizationService } from '../lib/services/personUtilization';
import { maxDaysPerWeek } from '../lib/weekUtils';
import { requestDateBounds } from '../types/api';

interface SkillMatcherModalProps {
  isOpen: boolean;
  request: BookingRequest | null;
  requestProject: Project | null;
  onClose: () => void;
  onUnassignRequest?: (requestId: string) => void | Promise<void>;
  onApproveRequestWithResource?: (requestId: string, resourceId: string) => void | Promise<void>;
}

interface FilterState {
  cu: string;
  practice: string;
  cc: string;
  site: string;
  level: string;
}

const defaultFilters: FilterState = {
  cu: 'all',
  practice: 'all',
  cc: 'all',
  site: 'all',
  level: 'all',
};

const JOB_CATEGORY_OPTIONS: JobCategory[] = [
  'B0- Fresher',
  'L0', 'L1', 'L2', 'L3', 'L4', 'L5',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5',
];

type WeekGap = {
  isoYear: number;
  isoWeek: number;
  requiredDays: number;
  allocatedDays: number;
  availableDays: number;
  /** Days short vs request; 0 when available >= required. */
  shortfallDays: number;
};

type UtilizationChartProps = {
  gaps: WeekGap[];
};

type UtilizationDetailsResource = {
  name: string;
  role: string;
  gaps: WeekGap[];
  avgShortfallDays: number;
};

function availableDaysFromAllocated(allocatedDays: number): number {
  return Math.max(0, 5 - (Number(allocatedDays) || 0));
}

/** Remaining shortfall vs request; 0 when availability covers the request. */
function shortfallDays(requiredDays: number, allocatedDays: number): number {
  const available = availableDaysFromAllocated(allocatedDays);
  return available >= requiredDays ? 0 : requiredDays - available;
}

function matchRequestWeekGaps(
  requestWeeks: WeekAllocation[],
  personWeeks: PersonUtilizationResult['utilization'],
): WeekGap[] {
  const byKey = new Map(
    personWeeks.map((w) => [`${w.isoYear}-${w.isoWeek}`, Number(w.utilization) || 0]),
  );

  return [...requestWeeks]
    .sort((a, b) => a.isoYear - b.isoYear || a.isoWeek - b.isoWeek)
    .map((rw) => {
      const allocatedDays = byKey.get(`${rw.isoYear}-${rw.isoWeek}`) ?? 0;
      const availableDays = availableDaysFromAllocated(allocatedDays);
      return {
        isoYear: rw.isoYear,
        isoWeek: rw.isoWeek,
        requiredDays: rw.daysPerWeek,
        allocatedDays,
        availableDays,
        shortfallDays: shortfallDays(rw.daysPerWeek, allocatedDays),
      };
    });
}

function avgShortfallDays(gaps: WeekGap[]): number {
  if (gaps.length === 0) return 0;
  return gaps.reduce((sum, g) => sum + g.shortfallDays, 0) / gaps.length;
}

function formatWeekLabel(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
}

function mixChannel(start: number, end: number, ratio: number) {
  return Math.round(start + (end - start) * ratio);
}

/** Same green→yellow→red scale as before (0–100). Shortfall days map via ×20. */
function shortfallToColor(days: number) {
  const value = (Number(days) || 0) * 20;
  const green = { r: 34, g: 197, b: 94 };
  const yellow = { r: 234, g: 179, b: 8 };
  const red = { r: 239, g: 68, b: 68 };

  if (value <= 20) {
    return `rgb(${green.r}, ${green.g}, ${green.b})`;
  }
  if (value >= 100) {
    return `rgb(${red.r}, ${red.g}, ${red.b})`;
  }
  if (value <= 60) {
    const ratio = (value - 20) / 40;
    return `rgb(${mixChannel(green.r, yellow.r, ratio)}, ${mixChannel(green.g, yellow.g, ratio)}, ${mixChannel(green.b, yellow.b, ratio)})`;
  }
  const ratio = (value - 60) / 40;
  return `rgb(${mixChannel(yellow.r, red.r, ratio)}, ${mixChannel(yellow.g, red.g, ratio)}, ${mixChannel(yellow.b, red.b, ratio)})`;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  const path = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    path.push(`Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`);
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  path.push(`Q ${penultimate.x.toFixed(2)} ${penultimate.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);

  return path.join(' ');
}

const ResourceAvailabilityOverlay: React.FC<UtilizationChartProps> = ({ gaps }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

  const chart = useMemo(() => {
    if (!gaps.length) return null;

    const width = 320;
    const height = 100;
    const maxDays = 5;
    const slot = width / gaps.length;

    const segments = gaps.map((gap, index) => {
      const x = index * slot;
      const segmentWidth = slot;
      const y = height - (gap.shortfallDays / maxDays) * height;
      return {
        gap,
        x,
        width: segmentWidth,
        y,
        color: shortfallToColor(gap.shortfallDays),
      };
    });

    const smoothPoints = segments.map((segment) => ({
      x: segment.x + segment.width / 2,
      y: segment.y,
    }));

    const linePath = buildSmoothPath([
      { x: segments[0].x, y: segments[0].y },
      ...smoothPoints,
      {
        x: segments[segments.length - 1].x + segments[segments.length - 1].width,
        y: segments[segments.length - 1].y,
      },
    ]);
    const areaPath = `${linePath} L ${width.toFixed(2)} ${height} L 0 ${height} Z`;

    const gradientStops = segments.map((segment) => ({
      offset: `${((segment.x + segment.width / 2) / width) * 100}%`,
      color: segment.color,
    }));

    if (gradientStops.length > 0) {
      gradientStops.unshift({ offset: '0%', color: segments[0].color });
      gradientStops.push({ offset: '100%', color: segments[segments.length - 1].color });
    }

    return { width, height, linePath, areaPath, segments, gradientStops };
  }, [gaps]);

  if (!chart) return null;

  const hovered = hoveredIndex === null ? null : chart.segments[hoveredIndex] ?? null;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {chart.gradientStops.map((stop, index) => (
              <stop
                key={`${stop.offset}-${index}`}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity="0.16"
              />
            ))}
          </linearGradient>
        </defs>
        <path d={chart.areaPath} fill={`url(#${gradientId})`} />
        {chart.segments.map((segment, index) => (
          <rect
            key={`${segment.gap.isoYear}-${segment.gap.isoWeek}`}
            x={segment.x}
            y={0}
            width={segment.width}
            height={chart.height}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
          />
        ))}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-20 rounded-md border border-default bg-surface px-2 py-1 text-[10px] font-medium text-primary shadow-xl"
          style={{
            left: `calc(${((hovered.x + hovered.width / 2) / chart.width) * 100}% - 36px)`,
          }}
        >
          <div>{formatWeekLabel(hovered.gap.isoYear, hovered.gap.isoWeek)}</div>
          <div className="text-tertiary">
            {hovered.gap.shortfallDays === 0
              ? 'Covers request'
              : `${hovered.gap.shortfallDays}d/wk short`}
          </div>
          <div className="text-tertiary">
            Need {hovered.gap.requiredDays}d · Available {hovered.gap.availableDays}d
          </div>
        </div>
      )}
    </div>
  );
};

const ResourceAvailabilityDetailsModal: React.FC<{
  resource: UtilizationDetailsResource | null;
  onClose: () => void;
}> = ({ resource, onClose }) => {
  if (!resource) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay backdrop-blur-sm p-4">
      <div className="bg-surface border border-subtle rounded-xl shadow-app-md w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="app-card-header px-6 py-4 border-b border-subtle">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="text-lg font-semibold text-primary">Availability vs Request</h3>
              </div>
              <p className="mt-1 text-sm text-secondary truncate">{resource.name} · {resource.role}</p>
              <p className="mt-1 text-xs text-tertiary">
                Avg shortfall across request weeks:{' '}
                {resource.avgShortfallDays === 0
                  ? '0d/wk (covers request)'
                  : `${resource.avgShortfallDays.toFixed(1)}d/wk`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-tertiary hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {resource.gaps.length === 0 ? (
            <div className="rounded-lg border border-subtle bg-surface-muted/30 px-4 py-8 text-sm text-tertiary text-center">
              No request weeks to compare.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-subtle">
              <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-3 bg-surface-muted/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
                <span>Week</span>
                <span className="text-right">Required</span>
                <span className="text-right">Available</span>
                <span className="text-right">Shortfall</span>
              </div>
              <div>
                {resource.gaps.map((gap) => (
                  <div
                    key={`${gap.isoYear}-${gap.isoWeek}`}
                    className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm text-primary"
                  >
                    <span>{formatWeekLabel(gap.isoYear, gap.isoWeek)}</span>
                    <span className="text-right">{gap.requiredDays}d</span>
                    <span className="text-right">{gap.availableDays}d</span>
                    <span className="text-right font-semibold">
                      {gap.shortfallDays === 0 ? '0d' : `${gap.shortfallDays}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function filtersFromRequest(request: BookingRequest | null): FilterState {
  if (!request) return defaultFilters;
  return {
    cu: request.consultingUnitId || 'all',
    practice: request.practiceAreaId || 'all',
    cc: request.competencyCenterId || 'all',
    site: request.siteId || 'all',
    level: request.jobCategory || 'all',
  };
}

export const SkillMatcherModal: React.FC<SkillMatcherModalProps> = ({
  isOpen,
  request,
  requestProject,
  onClose,
  onUnassignRequest,
  onApproveRequestWithResource,
}) => {
  const [selectedFilters, setSelectedFilters] = useState<FilterState>(defaultFilters);
  const [availability, setAvailability] = useState<AvailabilityMode>('complete');
  const [nameQuery, setNameQuery] = useState('');
  const [results, setResults] = useState<PersonUtilizationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [detailsResource, setDetailsResource] = useState<UtilizationDetailsResource | null>(null);
  const { data: lookups } = useLookups();

  const runSearch = useCallback(
    async (filters: FilterState, availabilityMode: AvailabilityMode) => {
      if (!request) return;

      setIsLoading(true);
      setError(null);
      try {
        const bounds = requestDateBounds(request);
        if (!bounds) {
          setResults([]);
          setHasSearched(true);
          setError('Request has no week allocations.');
          return;
        }

        const rows = await personUtilizationService.search({
          from: bounds.startDate,
          to: bounds.endDate,
          availability: availabilityMode,
          requiredDays: maxDaysPerWeek(request.weeks),
          consultingUnitId: filters.cu === 'all' ? null : filters.cu,
          practiceAreaId: filters.practice === 'all' ? null : filters.practice,
          competencyCenterId: filters.cc === 'all' ? null : filters.cc,
          siteId: filters.site === 'all' ? null : filters.site,
          jobCategory: filters.level === 'all' ? null : filters.level,
          name: null,
        });

        const sorted = [...rows].sort((a, b) => {
          const aAssigned = request.resourceId === a.id;
          const bAssigned = request.resourceId === b.id;
          if (aAssigned && !bAssigned) return -1;
          if (!aAssigned && bAssigned) return 1;
          return a.name.localeCompare(b.name);
        });

        setResults(sorted);
        setHasSearched(true);
      } catch (err) {
        setResults([]);
        setHasSearched(true);
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setIsLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!isOpen || !request) {
      setSelectedFilters(defaultFilters);
      setAvailability('complete');
      setNameQuery('');
      setResults([]);
      setError(null);
      setHasSearched(false);
      setIsLoading(false);
      setDetailsResource(null);
      return;
    }

    const initialFilters = filtersFromRequest(request);
    setSelectedFilters(initialFilters);
    setAvailability('complete');
    setNameQuery('');
    void runSearch(initialFilters, 'complete');
  }, [isOpen, request, runSearch]);

  const filteredResults = useMemo(() => {
    const query = nameQuery.trim().toLowerCase();
    if (!query) return results;
    return results.filter((res) => res.name.toLowerCase().includes(query));
  }, [results, nameQuery]);

  const filterOptions = useMemo(() => {
    const filteredCompetencyCenters = (lookups?.competencyCenters || []).filter((entry) => {
      return selectedFilters.practice === 'all' || entry.practice_area_id === selectedFilters.practice;
    });

    return {
      cu: lookups?.consultingUnits || [],
      practice: lookups?.practiceAreas || [],
      cc: filteredCompetencyCenters,
      site: lookups?.sites || [],
      level: JOB_CATEGORY_OPTIONS,
    };
  }, [lookups, selectedFilters.practice]);

  useEffect(() => {
    if (selectedFilters.cc === 'all') return;
    const stillValid = filterOptions.cc.some((entry) => entry.id === selectedFilters.cc);
    if (!stillValid) {
      setSelectedFilters((current) => ({ ...current, cc: 'all' }));
    }
  }, [filterOptions.cc, selectedFilters.cc]);

  if (!isOpen || !request) {
    return null;
  }

  const requestBounds = requestDateBounds(request);
  const requiredDays = maxDaysPerWeek(request.weeks);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
  };

  const renderIdFilter = (
    key: keyof Omit<FilterState, 'level'>,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <div>
      <label className="block text-xs font-medium text-secondary mb-1.5">{label}</label>
      <select
        value={selectedFilters[key]}
        onChange={(e) => updateFilter(key, e.target.value)}
        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="all">Any</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );

  const selectClassName =
    'w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" id="resources-skills-popup">
      <div className="bg-surface border border-subtle rounded-xl shadow-app-md w-full max-w-5xl overflow-hidden flex flex-col h-[650px] transform transition-all animate-scale-up">
        <div className="app-card-header px-6 py-3.5 border-b border-subtle">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Award className="w-5 h-5 text-blue-600 shrink-0" />
                <h3 className="text-lg font-semibold text-primary shrink-0">Skill Matcher</h3>
                <span className="text-tertiary shrink-0">·</span>
                <span className="text-sm text-secondary truncate">
                  {requestProject?.name || 'Unknown project'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                <span className="font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {request.requiredSkill || 'General skill'}
                </span>
                <span className="text-secondary">{requiredDays}d/wk required</span>
                <span className="text-tertiary">·</span>
                <span className="text-secondary">
                  {requestBounds ? `${requestBounds.startDate} – ${requestBounds.endDate}` : 'No weeks'}
                </span>
              </div>
              {request.notes && (
                <p className="mt-1.5 text-xs text-tertiary leading-snug line-clamp-1" title={request.notes}>
                  {request.notes}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-tertiary hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <aside className="w-80 shrink-0 border-r border-subtle bg-surface flex flex-col">
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1.5">Availability</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as AvailabilityMode)}
                    className={selectClassName}
                  >
                    <option value="complete">Completely available</option>
                    <option value="partial">Partially available</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>

                {renderIdFilter('cu', 'Consulting unit', filterOptions.cu)}
                {renderIdFilter('practice', 'Practice area', filterOptions.practice)}
                {renderIdFilter('cc', 'Competency center', filterOptions.cc)}
                {renderIdFilter('site', 'Site', filterOptions.site)}

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1.5">Job level</label>
                  <select
                    value={selectedFilters.level}
                    onChange={(e) => updateFilter('level', e.target.value)}
                    className={selectClassName}
                  >
                    <option value="all">Any</option>
                    {filterOptions.level.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
            </div>

            <div className="p-5 border-t border-subtle bg-surface flex gap-2">
              <button
                type="button"
                onClick={() => void runSearch(selectedFilters, availability)}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {isLoading ? 'Searching…' : 'Search'}
              </button>

              <button
                type="button"
                title="Clear all filters"
                aria-label="Clear all filters"
                onClick={() => {
                  setSelectedFilters(defaultFilters);
                  setAvailability('everyone');
                  setNameQuery('');
                }}
                className="shrink-0 inline-flex items-center justify-center rounded-lg border border-default px-3 py-2.5 text-xs font-semibold text-secondary transition-colors hover:bg-surface-hover"
              >
                Clear all
              </button>

              <button
                type="button"
                title="Reset filters"
                aria-label="Reset filters"
                onClick={() => {
                  const reset = filtersFromRequest(request);
                  setSelectedFilters(reset);
                  setAvailability('complete');
                  setNameQuery('');
                }}
                className="shrink-0 inline-flex items-center justify-center rounded-lg border border-default p-2.5 text-secondary transition-colors hover:bg-surface-hover"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-h-0 bg-surface-muted/20">
            <div className="border-b border-subtle bg-surface px-4 py-3">
              <label className="block text-xs font-medium text-secondary mb-1.5">Filter by name</label>
              <div className="relative">
                <Search className="w-4 h-4 text-tertiary absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Type to narrow results…"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-default rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-input"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="mb-1 text-xs font-medium text-tertiary">
                {isLoading
                  ? 'Searching…'
                  : hasSearched
                    ? nameQuery.trim()
                      ? `Showing ${filteredResults.length} of ${results.length} resource${results.length === 1 ? '' : 's'}`
                      : `Showing ${results.length} resource${results.length === 1 ? '' : 's'}`
                    : 'Set filters on the left and click Search'}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {error}
                </div>
              )}

              {!isLoading && hasSearched && filteredResults.length === 0 && !error ? (
                <div className="flex flex-col items-center justify-center py-12 text-tertiary text-xs">
                  <User className="w-8 h-8 text-tertiary mb-2 opacity-50" />
                  {nameQuery.trim() && results.length > 0
                    ? 'No resources match the name filter.'
                    : 'No resources matched the selected filters.'}
                </div>
              ) : (
                filteredResults.map((res) => {
                  const gaps = matchRequestWeekGaps(request.weeks, res.utilization);
                  const avgShort = avgShortfallDays(gaps);

                  return (
                  <div
                    key={res.id}
                    className="relative overflow-hidden p-4 rounded-xl border transition-all flex items-start gap-3 bg-surface border-subtle hover:border-default hover:shadow-app-sm"
                  >
                    <ResourceAvailabilityOverlay gaps={gaps} />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/85 via-surface/45 to-surface/10" />
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {(res.name || '').split(' ').map((n) => n[0] || '').join('')}
                    </div>

                    <div className="relative z-10 flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-primary truncate">{res.name}</h4>
                        <span className="text-xs text-tertiary">·</span>
                        <span className="text-xs text-secondary truncate">{res.role}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface/60 text-secondary border border-subtle backdrop-blur-[1px]">
                          {avgShort === 0
                            ? '0d/wk short'
                            : `${avgShort % 1 === 0 ? avgShort : avgShort.toFixed(1)}d/wk short`}
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-tertiary">
                        Days short vs request (0 = availability covers need)
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-tertiary">
                        {res.group && (
                          <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                            Consulting unit · {res.group}
                          </span>
                        )}
                        {res.practiceArea && (
                          <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                            Practice · {res.practiceArea}
                          </span>
                        )}
                        {res.competencyCenter && (
                          <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                            Competency center · {res.competencyCenter}
                          </span>
                        )}
                        {res.site && (
                          <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                            Site · {res.site}
                          </span>
                        )}
                        {res.jobCategory && (
                          <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                            Level · {res.jobCategory}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        title="View availability details"
                        aria-label={`View availability details for ${res.name}`}
                        onClick={() =>
                          setDetailsResource({
                            name: res.name,
                            role: res.role,
                            gaps,
                            avgShortfallDays: avgShort,
                          })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-default bg-surface text-secondary transition-all hover:bg-surface-hover"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>

                      {request.resourceId === res.id ? (
                        <button
                          onClick={async () => {
                            if (onUnassignRequest) {
                              await onUnassignRequest(request.id);
                            }
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer tint-red shrink-0"
                        >
                          Unassign <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (onApproveRequestWithResource) {
                              await onApproveRequestWithResource(request.id, res.id);
                            }
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                        >
                          Assign <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <ResourceAvailabilityDetailsModal
          resource={detailsResource}
          onClose={() => setDetailsResource(null)}
        />
      </div>
    </div>
  );
};
