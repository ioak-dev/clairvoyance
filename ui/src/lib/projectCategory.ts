import type { Project } from '../types';
import type { BillableType } from '../types';

export type ProjectCategory = 'Billable' | 'Non-billable' | 'Opportunity';

export function getProjectCategory(project: Project): ProjectCategory {
  // Use billableType if available (project-level field)
  if (project.billableType) {
    if (project.billableType === 'Opportunity') {
      return 'Opportunity';
    }
    if (project.billableType === 'Non-billable') {
      return 'Non-billable';
    }
    // billableType === 'Billable'
    return 'Billable';
  }

  // Fallback: check naming conventions if billableType not set
  const name = project.name.toLowerCase();
  const group = (project.group || '').toLowerCase();

  if (project.isOpportunity || (project.winProbability ?? 100) < 100) {
    return 'Opportunity';
  }
  if (name.includes('non-billable') || group.includes('non-billable')) {
    return 'Non-billable';
  }
  return 'Billable';
}

/** Small dot / swatch (sidebar, tables, request cards). */
export function getProjectCategoryDotClass(category: ProjectCategory): string {
  switch (category) {
    case 'Opportunity':
      return 'bg-purple-500';
    case 'Non-billable':
      return 'bg-amber-500';
    case 'Billable':
    default:
      return 'bg-emerald-500';
  }
}

export function getProjectCategoryDotClassForProject(project: Project): string {
  return getProjectCategoryDotClass(getProjectCategory(project));
}

/** Larger icon tile background (project list). */
export function getProjectCategoryIconClass(category: ProjectCategory): string {
  switch (category) {
    case 'Opportunity':
      return 'bg-purple-500';
    case 'Non-billable':
      return 'bg-amber-500';
    case 'Billable':
    default:
      return 'bg-emerald-500';
  }
}

/** Category badge styling aligned with scheduler block palette. */
export function getProjectCategoryBadgeClass(category: ProjectCategory): string {
  switch (category) {
    case 'Opportunity':
      return 'bg-[rgb(78,130,194)] text-white border-[rgb(56,100,155)]';
    case 'Non-billable':
      return 'bg-[rgb(217,150,148)] text-white border-[rgb(197,130,128)]';
    case 'Billable':
    default:
      return 'bg-[rgb(129,164,137)] text-white border-[rgb(109,144,117)]';
  }
}

/** Timeline allocation block styling (scheduler calendar). */
export function getProjectCategoryBlockStyle(category: ProjectCategory): {
  colorClass: string;
  borderClass: string;
  textClass: string;
} {
  switch (category) {
    case 'Opportunity':
      return {
        colorClass: 'bg-blue-600',
        borderClass: 'border border-blue-700',
        textClass: 'text-white',
      };
    case 'Non-billable':
      return {
        colorClass: 'bg-[rgb(217,150,148)]',
        borderClass: 'border border-[rgb(197,130,128)]',
        textClass: 'text-white',
      };
    case 'Billable':
    default:
      return {
        colorClass: 'bg-[rgb(129,164,137)]',
        borderClass: 'border border-[rgb(109,144,117)]',
        textClass: 'text-white',
      };
  }
}

type Rgb = { r: number; g: number; b: number };

function rgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Blend an RGB color toward white — used for subtle diagonal line overlays. */
function lightenRgb(color: Rgb, towardWhite: number): string {
  const t = Math.max(0, Math.min(1, towardWhite));
  return rgb({
    r: Math.round(color.r + (255 - color.r) * t),
    g: Math.round(color.g + (255 - color.g) * t),
    b: Math.round(color.b + (255 - color.b) * t),
  });
}

/** Subtle % badge on schedule blocks — faint dark glass on any block color. */
export const SCHEDULE_BLOCK_BADGE_CLASS =
  'bg-black/20 text-white/90 border border-black/10';

export type AllocationBlockChrome = {
  fillColor: string;
  borderColor: string;
  stripeColor: string;
  textClass: string;
  badgeClass: string;
};

export type BlockBackgroundStyle = {
  backgroundColor: string;
  borderColor: string;
  backgroundImage?: string;
};

function getProjectCategoryBlockRgb(category: ProjectCategory): {
  fill: Rgb;
  border: Rgb;
} {
  switch (category) {
    case 'Opportunity':
      return {
        fill: { r: 78, g: 130, b: 194 },
        border: { r: 56, g: 100, b: 155 },
      };
    case 'Non-billable':
      return {
        fill: { r: 217, g: 150, b: 148 },
        border: { r: 197, g: 130, b: 128 },
      };
    case 'Billable':
    default:
      return {
        fill: { r: 129, g: 164, b: 137 },
        border: { r: 109, g: 144, b: 117 },
      };
  }
}

/** Opaque category fill + single subtle stripe tint. */
export function getAllocationBlockChrome(category: ProjectCategory): AllocationBlockChrome {
  const { fill, border } = getProjectCategoryBlockRgb(category);
  return {
    fillColor: rgb(fill),
    borderColor: rgb(border),
    stripeColor: lightenRgb(fill, 0.03),
    textClass: 'text-white',
    badgeClass: SCHEDULE_BLOCK_BADGE_CLASS,
  };
}

/** Open / unassigned request — light opaque tint of category color (no see-through grid). */
export function getRequestBlockChrome(category: ProjectCategory = 'Billable'): AllocationBlockChrome {
  const { fill, border } = getProjectCategoryBlockRgb(category);
  return {
    // Opaque equivalent of rgba(fill, 0.2) over the app surface
    fillColor: `color-mix(in srgb, ${rgb(fill)} 20%, var(--app-surface))`,
    borderColor: rgb(border),
    stripeColor: 'transparent',
    textClass: 'text-primary',
    badgeClass: 'bg-black/8 text-primary border border-black/10 dark:bg-white/10 dark:text-primary dark:border-white/15',
  };
}

/** Unassigned requests — transparent fill only, no allocation stripe pattern. */
export function getRequestBlockBackground(chrome: AllocationBlockChrome): BlockBackgroundStyle {
  return {
    backgroundColor: chrome.fillColor,
    borderColor: chrome.borderColor,
  };
}

/**
 * Solid category fill for schedule blocks.
 * Utilization is shown via the day bars above the block, not stripe patterns.
 */
export function getAllocationBlockBackgroundFromDays(
  _daysPerWeek: number,
  chrome: AllocationBlockChrome,
): BlockBackgroundStyle {
  return {
    backgroundColor: chrome.fillColor,
    borderColor: chrome.borderColor,
  };
}

export function getAllocationBlockBackground(
  _percent: number,
  chrome: AllocationBlockChrome,
): BlockBackgroundStyle {
  return {
    backgroundColor: chrome.fillColor,
    borderColor: chrome.borderColor,
  };
}

export function getProjectCategoryLabel(category: ProjectCategory): string {
  return category;
}

/** Billable type stored on project — get directly from project.billableType. */
export function getBillableTypeFromProject(project: Project): BillableType {
  if (project.billableType) {
    return project.billableType;
  }
  return getProjectCategory(project) === 'Opportunity' ? 'Opportunity' : 'Billable';
}
