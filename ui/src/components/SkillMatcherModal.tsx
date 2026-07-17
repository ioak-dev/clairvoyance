import React, { useEffect, useMemo, useState } from 'react';
import { Award, Check, Search, User, X } from 'lucide-react';
import { BookingRequest, Project, Resource } from '../types';

interface SkillMatchResource extends Resource {
    hasSkill: boolean;
}

interface SkillMatcherModalProps {
    isOpen: boolean;
    request: BookingRequest | null;
    requestProject: Project | null;
    popupSearch: string;
    matchingResources: SkillMatchResource[];
    onClose: () => void;
    onSearchChange: (value: string) => void;
    onUnassignRequest?: (requestId: string) => void | Promise<void>;
    onApproveRequestWithResource?: (requestId: string, resourceId: string) => void | Promise<void>;
}

interface FilterState {
    cu: string;
    practice: string;
    cc: string;
    level: string;
}

const defaultFilters: FilterState = {
    cu: 'all',
    practice: 'all',
    cc: 'all',
    level: 'all',
};

export const SkillMatcherModal: React.FC<SkillMatcherModalProps> = ({
    isOpen,
    request,
    requestProject,
    popupSearch,
    matchingResources,
    onClose,
    onSearchChange,
    onUnassignRequest,
    onApproveRequestWithResource,
}) => {
    const [selectedFilters, setSelectedFilters] = useState<FilterState>(defaultFilters);

    useEffect(() => {
        if (!isOpen) {
            setSelectedFilters(defaultFilters);
        }
    }, [isOpen]);

    const filterOptions = useMemo(() => {
        const collect = (key: keyof Pick<Resource, 'group' | 'practiceArea' | 'role' | 'jobCategory'>) => {
            const values = matchingResources
                .map((res) => {
                    if (key === 'group') return res.group || 'Unassigned';
                    if (key === 'practiceArea') return res.practiceArea || 'Unassigned';
                    if (key === 'role') return res.role || 'Unassigned';
                    return res.jobCategory || res.role || 'Unassigned';
                })
                .filter(Boolean)
                .map((value) => value.toString().trim());

            return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
        };

        return {
            cu: collect('group'),
            practice: collect('practiceArea'),
            cc: collect('role'),
            level: collect('jobCategory'),
        };
    }, [matchingResources]);

    const displayedResources = useMemo(() => {
        const search = popupSearch.toLowerCase().trim();

        const filtered = matchingResources.filter((res) => {
            if (search && !res.name.toLowerCase().includes(search)) {
                return false;
            }

            const matchesCu = selectedFilters.cu === 'all' || (res.group || 'Unassigned').toLowerCase() === selectedFilters.cu.toLowerCase();
            const matchesPractice = selectedFilters.practice === 'all' || (res.practiceArea || 'Unassigned').toLowerCase() === selectedFilters.practice.toLowerCase();
            const matchesCc = selectedFilters.cc === 'all' || (res.role || 'Unassigned').toLowerCase() === selectedFilters.cc.toLowerCase();
            const matchesLevel = selectedFilters.level === 'all' || (res.jobCategory || res.role || 'Unassigned').toLowerCase() === selectedFilters.level.toLowerCase();

            return matchesCu && matchesPractice && matchesCc && matchesLevel;
        });

        return filtered.sort((a, b) => {
            if (a.hasSkill && !b.hasSkill) return -1;
            if (!a.hasSkill && b.hasSkill) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [matchingResources, popupSearch, selectedFilters]);

    if (!isOpen || !request) {
        return null;
    }

    const updateFilter = (key: keyof FilterState, value: string) => {
        setSelectedFilters((current) => ({ ...current, [key]: value }));
    };

    const renderFilterGroup = (key: keyof FilterState, label: string, options: string[]) => {
        const selectedValue = selectedFilters[key];
        return (
            <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-secondary">{label}</label>
                <select
                    value={selectedValue}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    className="w-full rounded-lg border border-subtle bg-surface px-2.5 py-2 text-[11px] text-secondary focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                    <option value="all">All</option>
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay backdrop-blur-sm p-4 overflow-y-auto animate-fade-in" id="resources-skills-popup">
            <div className="bg-surface border border-subtle rounded-xl shadow-app-md w-full max-w-5xl overflow-hidden flex flex-col h-[650px] transform transition-all animate-scale-up">
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
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-tertiary hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-5 py-3.5 tint-blue border-b border-subtle flex justify-between items-center text-xs">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 tint-blue rounded uppercase tracking-wider">
                                {request.requiredSkill || 'General Skill'}
                            </span>
                            <span className="text-tertiary">•</span>
                            <span className="font-semibold text-secondary">
                                {request.billablePercent}% Allocation
                            </span>
                        </div>
                        <div className="text-[10px] text-tertiary font-medium truncate italic" title={request.notes}>
                            "{request.notes || 'No notes provided.'}"
                        </div>
                    </div>
                    <div className="text-right text-[10px] text-secondary font-bold bg-surface-raised border border-default px-2.5 py-1 rounded-lg shadow-app-sm">
                        <div>📅 {request.startDate}</div>
                        <div className="text-tertiary font-medium">to {request.endDate}</div>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
                    <aside className="w-72 shrink-0 border-r border-subtle bg-surface-muted/60 p-4 space-y-4 overflow-y-auto">
                        <div>
                            <h3 className="text-[12px] font-black uppercase tracking-[0.24em] text-primary">Filters</h3>
                            <p className="mt-1 text-[11px] text-tertiary">Refine the candidate pool by the available profile attributes.</p>
                        </div>
                        {renderFilterGroup('cu', 'CU', filterOptions.cu)}
                        {renderFilterGroup('practice', 'Practice', filterOptions.practice)}
                        {renderFilterGroup('cc', 'CC', filterOptions.cc)}
                        {renderFilterGroup('level', 'Level', filterOptions.level)}

                        <button
                            type="button"
                            onClick={() => setSelectedFilters(defaultFilters)}
                            className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-[11px] font-semibold text-secondary transition-colors hover:bg-surface-hover"
                        >
                            Reset filters
                        </button>
                    </aside>

                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="border-b border-subtle bg-surface p-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-tertiary absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    placeholder="Search resources by name..."
                                    value={popupSearch}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-default rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-input"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            <div className="mb-2 text-[11px] font-semibold text-tertiary">
                                Showing {displayedResources.length} resource{displayedResources.length === 1 ? '' : 's'}
                            </div>
                            {displayedResources.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-tertiary text-xs">
                                    <User className="w-8 h-8 text-tertiary mb-2 opacity-50" />
                                    No resources matched the selected filters.
                                </div>
                            ) : (
                                displayedResources.map((res) => {
                                    const reqSkill = (request.requiredSkill || '').toLowerCase();
                                    return (
                                        <div
                                            key={res.id}
                                            className={`p-3 rounded-lg border transition-all flex items-start gap-3 ${res.hasSkill ? 'tint-blue' : 'bg-surface border-subtle hover:bg-surface-muted'
                                                }`}
                                        >
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

                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-tertiary">
                                                    {res.group && <span className="rounded-full border border-subtle bg-surface-muted px-2 py-0.5">CU: {res.group}</span>}
                                                    {res.practiceArea && <span className="rounded-full border border-subtle bg-surface-muted px-2 py-0.5">Practice: {res.practiceArea}</span>}
                                                    {res.role && <span className="rounded-full border border-subtle bg-surface-muted px-2 py-0.5">CC: {res.role}</span>}
                                                    {(res.jobCategory || res.role) && <span className="rounded-full border border-subtle bg-surface-muted px-2 py-0.5">Level: {res.jobCategory || res.role}</span>}
                                                </div>

                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {(res.skills || []).map((sk) => {
                                                        const isExactMatch = sk.toLowerCase().includes(reqSkill);
                                                        return (
                                                            <span
                                                                key={sk}
                                                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${isExactMatch ? 'tint-blue font-bold' : 'bg-surface-muted text-secondary border border-subtle'
                                                                    }`}
                                                            >
                                                                {sk}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {request.resourceId === res.id ? (
                                                <button
                                                    onClick={async () => {
                                                        if (onUnassignRequest) {
                                                            await onUnassignRequest(request.id);
                                                        }
                                                        onClose();
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-app-sm flex items-center gap-1 cursor-pointer tint-red"
                                                >
                                                    Unassign <X className="w-3 h-3 stroke-[3]" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        if (onApproveRequestWithResource) {
                                                            await onApproveRequestWithResource(request.id, res.id);
                                                        }
                                                        onClose();
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-app-sm flex items-center gap-1 cursor-pointer ${res.hasSkill ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-surface-muted hover:bg-surface-hover text-primary'
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
                    </div>
                </div>
            </div>
        </div>
    );
};
