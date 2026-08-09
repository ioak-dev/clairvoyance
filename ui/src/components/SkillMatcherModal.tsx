import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Check, List, RotateCcw, Search, User, X } from 'lucide-react';
import type {
  AvailabilityMode,
  BookingRequest,
  PersonUtilizationResult,
  Project,
  UtilizationSegment,
} from '../types';
import { useLookups } from '../hooks/useLookups';
import { personUtilizationService } from '../lib/services/personUtilization';
import {
  blockHoursOnDate,
  expandDates,
  personDailyCapacityHours,
  rosterSlotHours,
  rosterSummaryLabel,
} from '../lib/rosterUtils';
import { requestDateBounds } from '../types/api';
import { Modal, Button, IconButton, Input, Select, Field, Label, Badge } from './ui';

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

type DayGap = {
  date: string;
  requiredHours: number;
  allocatedHours: number;
  availableHours: number;
  /** Hours short vs request; 0 when available >= required. */
  shortfallHours: number;
};

type UtilizationChartProps = {
  gaps: DayGap[];
};

type UtilizationDetailsResource = {
  name: string;
  role: string;
  gaps: DayGap[];
  avgShortfallHours: number;
};

/** Average Mon–Fri roster need in hours (search threshold). */
function averageWeekdayRequiredHours(request: BookingRequest): number {
  const dailyCapacity = personDailyCapacityHours();
  const weekday = request.roster.slice(0, 5);
  const total = weekday.reduce(
    (sum, raw) => sum + rosterSlotHours(request.unit, raw, dailyCapacity),
    0,
  );
  return total / 5;
}

function availableHoursFromSegment(
  seg: UtilizationSegment | undefined,
  fallbackCapacity: number,
): number {
  if (!seg) return fallbackCapacity;
  const util = Number(seg.utilization) || 0;
  const booked = Number(seg.hours) || 0;
  if (util > 0) {
    const capacity = booked / util;
    return Math.max(0, capacity - booked);
  }
  return Math.max(0, fallbackCapacity * (1 - util));
}

/** Remaining shortfall vs request; 0 when availability covers the request. */
function shortfallHours(requiredHours: number, availableHours: number): number {
  return availableHours >= requiredHours ? 0 : requiredHours - availableHours;
}

function matchRequestDayGaps(
  request: BookingRequest,
  personUtilization: UtilizationSegment[],
): DayGap[] {
  const bounds = requestDateBounds(request);
  if (!bounds) return [];

  const dailyCapacity = personDailyCapacityHours();
  const byDate = new Map(personUtilization.map((seg) => [seg.date, seg]));

  return expandDates(bounds.startDate, bounds.endDate).map((date) => {
    const required = blockHoursOnDate(request, date, dailyCapacity);
    const seg = byDate.get(date);
    const allocated = Number(seg?.hours) || 0;
    const available = availableHoursFromSegment(seg, dailyCapacity);
    return {
      date,
      requiredHours: required,
      allocatedHours: allocated,
      availableHours: available,
      shortfallHours: shortfallHours(required, available),
    };
  });
}

function avgShortfallHours(gaps: DayGap[]): number {
  const relevant = gaps.filter((g) => g.requiredHours > 0);
  if (relevant.length === 0) return 0;
  return relevant.reduce((sum, g) => sum + g.shortfallHours, 0) / relevant.length;
}

function formatHours(value: number): string {
  const normalized = Number(value) || 0;
  const rounded = Math.abs(normalized - Math.round(normalized)) < 0.05
    ? String(Math.round(normalized))
    : normalized.toFixed(1);
  return `${rounded}h`;
}

function formatShortfallLabel(avgShort: number): string {
  if (avgShort === 0) return '0h short';
  return `${avgShort % 1 === 0 ? avgShort : avgShort.toFixed(1)}h short`;
}

const ResourceAvailabilityOverlay: React.FC<UtilizationChartProps> = ({ gaps }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (!gaps.length) return null;

    const width = 320;
    const height = 100;
    const maxHours = Math.max(
      personDailyCapacityHours(),
      ...gaps.map((g) => g.requiredHours),
      1,
    );
    const slot = width / gaps.length;

    const segments = gaps.map((gap, index) => {
      const x = index * slot;
      const segmentWidth = slot;
      const requestedHours = Math.max(0, Math.min(maxHours, gap.requiredHours));
      const fulfillableHours = Math.max(0, Math.min(requestedHours, gap.availableHours));
      const unfulfillableHours = Math.max(0, requestedHours - fulfillableHours);
      const fulfillableTopY = height - (fulfillableHours / maxHours) * height;
      const requestedTopY = height - (requestedHours / maxHours) * height;
      const fulfillableHeight = (fulfillableHours / maxHours) * height;
      const unfulfillableHeight = (unfulfillableHours / maxHours) * height;
      return {
        gap,
        x,
        width: segmentWidth,
        requestedHours,
        fulfillableHours,
        unfulfillableHours,
        fulfillableTopY,
        requestedTopY,
        fulfillableHeight,
        unfulfillableHeight,
      };
    });

    return { width, height, maxHours, segments };
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
        {chart.segments.map((segment) => (
          <rect
            key={`amber-${segment.gap.date}`}
            x={segment.x}
            y={segment.requestedTopY}
            width={segment.width}
            height={segment.unfulfillableHeight}
            fill="#f59e0b"
            fillOpacity="0.07"
          />
        ))}
        {chart.segments.map((segment) => (
          <rect
            key={`green-${segment.gap.date}`}
            x={segment.x}
            y={segment.fulfillableTopY}
            width={segment.width}
            height={segment.fulfillableHeight}
            fill="#22c55e"
            fillOpacity="0.09"
          />
        ))}
        {chart.segments.map((segment, index) => (
          <rect
            key={segment.gap.date}
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
          <div>{hovered.gap.date}</div>
          <div className="text-tertiary">
            Fulfillable {formatHours(hovered.fulfillableHours)} · Unfulfillable{' '}
            {formatHours(hovered.unfulfillableHours)}
          </div>
          <div className="text-tertiary">
            Requested {formatHours(hovered.requestedHours)} on a {formatHours(chart.maxHours)}/day scale
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
  return (
    <Modal
      open={!!resource}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <List className="w-5 h-5 text-blue-600 shrink-0" />
          Availability vs Request
        </span>
      }
      description={
        resource ? (
          <>
            <span className="block truncate">{resource.name} · {resource.role}</span>
            <span className="block mt-1">
              Avg shortfall across request days:{' '}
              {resource.avgShortfallHours === 0
                ? '0h (covers request)'
                : `${resource.avgShortfallHours.toFixed(1)}h/day`}
            </span>
          </>
        ) : undefined
      }
    >
      {!resource || resource.gaps.length === 0 ? (
        <div className="rounded-lg border border-subtle bg-surface-muted/30 px-4 py-8 text-sm text-tertiary text-center">
          No request days to compare.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-subtle">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-3 bg-surface-muted/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">
            <span>Date</span>
            <span className="text-right">Required</span>
            <span className="text-right">Available</span>
            <span className="text-right">Shortfall</span>
          </div>
          <div>
            {resource.gaps.map((gap) => (
              <div
                key={gap.date}
                className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm text-primary"
              >
                <span>{gap.date}</span>
                <span className="text-right">{formatHours(gap.requiredHours)}</span>
                <span className="text-right">{formatHours(gap.availableHours)}</span>
                <span className="text-right font-semibold">
                  {formatHours(gap.shortfallHours)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

function filtersFromRequest(request: BookingRequest | null): FilterState {
  if (!request) return defaultFilters;
  return {
    cu: request.consultingUnitId || 'all',
    practice: request.practiceAreaId || 'all',
    cc: request.competencyCenterId || 'all',
    site: request.siteId || 'all',
    level: request.jobLevelId || 'all',
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
  const [assigningResourceId, setAssigningResourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [detailsResource, setDetailsResource] = useState<UtilizationDetailsResource | null>(null);
  const { data: lookups } = useLookups();
  const isAssigning = assigningResourceId !== null;

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
          setError('Request has no date range.');
          return;
        }

        const requiredHours = averageWeekdayRequiredHours(request);
        const rows = await personUtilizationService.search({
          from: bounds.startDate,
          to: bounds.endDate,
          availability: availabilityMode,
          requiredHours,
          consultingUnitId: filters.cu === 'all' ? null : filters.cu,
          practiceAreaId: filters.practice === 'all' ? null : filters.practice,
          competencyCenterId: filters.cc === 'all' ? null : filters.cc,
          siteId: filters.site === 'all' ? null : filters.site,
          jobLevelId: filters.level === 'all' ? null : filters.level,
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
      setAssigningResourceId(null);
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
      level: lookups?.jobLevels || [],
    };
  }, [lookups, selectedFilters.practice]);

  const levelNameById = useMemo(() => {
    return new Map((lookups?.jobLevels || []).map((entry) => [entry.id, entry.name]));
  }, [lookups]);

  useEffect(() => {
    if (selectedFilters.cc === 'all') return;
    const stillValid = filterOptions.cc.some((entry) => entry.id === selectedFilters.cc);
    if (!stillValid) {
      setSelectedFilters((current) => ({ ...current, cc: 'all' }));
    }
  }, [filterOptions.cc, selectedFilters.cc]);

  const requestBounds = request ? requestDateBounds(request) : null;
  const capacityLabel = request ? rosterSummaryLabel(request.unit, request.roster) : '';

  const updateFilter = (key: keyof FilterState, value: string) => {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
  };

  const toSelectOptions = (options: { id: string; name: string }[]) => [
    { value: 'all', label: 'Any' },
    ...options.map((option) => ({ value: option.id, label: option.name })),
  ];

  const renderIdFilter = (
    key: keyof Omit<FilterState, 'level'>,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <Field>
      <Label>{label}</Label>
      <Select
        value={selectedFilters[key]}
        onChange={(v) => updateFilter(key, v)}
        options={toSelectOptions(options)}
      />
    </Field>
  );

  return (
    <>
      <Modal
        open={isOpen && !!request}
        onClose={onClose}
        size="2xl"
        id="resources-skills-popup"
        panelClassName="h-[650px] max-h-[650px]"
        title={
          <span className="flex items-center gap-2 min-w-0">
            <Award className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="shrink-0">Skill Matcher</span>
            <span className="text-tertiary shrink-0">·</span>
            <span className="text-sm font-normal text-secondary truncate">
              {requestProject?.name || 'Unknown project'}
            </span>
          </span>
        }
        description={
          request ? (
            <>
              <span className="flex items-center gap-2 flex-wrap">
                <Badge tone="blue">{request.requestName || 'General request'}</Badge>
                <span>{capacityLabel} required</span>
                <span className="text-tertiary">·</span>
                <span>
                  {requestBounds ? `${requestBounds.startDate} – ${requestBounds.endDate}` : 'No dates'}
                </span>
              </span>
              {request.notes && (
                <span className="block mt-1 line-clamp-1" title={request.notes}>
                  {request.notes}
                </span>
              )}
            </>
          ) : undefined
        }
      >
        {request && (
          <div className="-mx-5 -my-4 flex h-full min-h-0">
            <aside className="w-80 shrink-0 border-r border-subtle bg-surface flex flex-col">
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <Field>
                  <Label>Availability</Label>
                  <Select
                    value={availability}
                    onChange={(v) => setAvailability(v)}
                    options={[
                      { value: 'complete', label: 'Completely available' },
                      { value: 'partial', label: 'Partially available' },
                      { value: 'everyone', label: 'Everyone' },
                    ]}
                  />
                </Field>

                {renderIdFilter('cu', 'Consulting unit', filterOptions.cu)}
                {renderIdFilter('practice', 'Practice area', filterOptions.practice)}
                {renderIdFilter('cc', 'Competency center', filterOptions.cc)}
                {renderIdFilter('site', 'Site', filterOptions.site)}

                <Field>
                  <Label>Job level</Label>
                  <Select
                    value={selectedFilters.level}
                    onChange={(v) => updateFilter('level', v)}
                    options={toSelectOptions(filterOptions.level)}
                  />
                </Field>
              </div>

              <div className="p-5 border-t border-subtle bg-surface flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  loading={isLoading}
                  disabled={isAssigning}
                  onClick={() => void runSearch(selectedFilters, availability)}
                >
                  {isLoading ? 'Searching…' : 'Search'}
                </Button>

                <Button
                  variant="outline"
                  title="Clear all filters"
                  aria-label="Clear all filters"
                  disabled={isLoading || isAssigning}
                  onClick={() => {
                    setSelectedFilters(defaultFilters);
                    setAvailability('everyone');
                    setNameQuery('');
                  }}
                >
                  Clear all
                </Button>

                <IconButton
                  label="Reset filters"
                  variant="outline"
                  disabled={isLoading || isAssigning}
                  onClick={() => {
                    const reset = filtersFromRequest(request);
                    setSelectedFilters(reset);
                    setAvailability('complete');
                    setNameQuery('');
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                </IconButton>
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-0 bg-surface-muted/20">
              <div className="border-b border-subtle bg-surface px-4 py-3">
                <Field>
                  <Label>Filter by name</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-tertiary absolute left-3 top-2.5" />
                    <Input
                      type="text"
                      placeholder="Type to narrow results…"
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>
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
                    const gaps = matchRequestDayGaps(request, res.utilization);
                    const avgShort = avgShortfallHours(gaps);

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
                            <Badge>{formatShortfallLabel(avgShort)}</Badge>
                          </div>

                          <div className="mt-2 text-[11px] text-tertiary">
                            Green = fulfillable request hours, amber = unfulfillable request hours
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
                            {res.jobLevelId && (
                              <span className="rounded-md bg-surface/55 px-2 py-0.5 border border-subtle backdrop-blur-[1px]">
                                Level · {(levelNameById.get(res.jobLevelId) || res.jobLevelId)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="relative z-10 flex items-center gap-2 shrink-0">
                          <IconButton
                            label={`View availability details for ${res.name}`}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDetailsResource({
                                name: res.name,
                                role: res.role,
                                gaps,
                                avgShortfallHours: avgShort,
                              })
                            }
                          >
                            <List className="w-3.5 h-3.5" />
                          </IconButton>

                          {request.resourceId === res.id ? (
                            <Button
                              size="sm"
                              className="tint-red"
                              rightIcon={<X className="w-3.5 h-3.5" />}
                              loading={assigningResourceId === res.id}
                              disabled={isLoading || (isAssigning && assigningResourceId !== res.id)}
                              onClick={async () => {
                                if (!onUnassignRequest || isAssigning || isLoading) return;
                                setAssigningResourceId(res.id);
                                try {
                                  await onUnassignRequest(request.id);
                                  onClose();
                                } finally {
                                  setAssigningResourceId(null);
                                }
                              }}
                            >
                              {assigningResourceId === res.id ? 'Unassigning…' : 'Unassign'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              rightIcon={<Check className="w-3.5 h-3.5" />}
                              loading={assigningResourceId === res.id}
                              disabled={isLoading || (isAssigning && assigningResourceId !== res.id)}
                              onClick={async () => {
                                if (!onApproveRequestWithResource || isAssigning || isLoading) return;
                                setAssigningResourceId(res.id);
                                try {
                                  await onApproveRequestWithResource(request.id, res.id);
                                  onClose();
                                } finally {
                                  setAssigningResourceId(null);
                                }
                              }}
                            >
                              {assigningResourceId === res.id ? 'Assigning…' : 'Assign'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ResourceAvailabilityDetailsModal
        resource={detailsResource}
        onClose={() => setDetailsResource(null)}
      />
    </>
  );
};
