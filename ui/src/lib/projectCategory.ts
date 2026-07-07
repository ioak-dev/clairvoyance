import type { Project } from '../types';
import type { BillableType } from '../types';

export type ProjectCategory = 'Billable' | 'Non-billable' | 'Internal' | 'Opportunity';

export function getProjectCategory(project: Project): ProjectCategory {
  const name = project.name.toLowerCase();
  const group = (project.group || '').toLowerCase();

  if (project.isOpportunity || (project.winProbability ?? 100) < 100) {
    return 'Opportunity';
  }
  if (name.includes('internal') || name.includes('support') || group.includes('internal')) {
    return 'Internal';
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
    case 'Internal':
      return 'bg-blue-500';
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
    case 'Internal':
      return 'bg-blue-500';
    case 'Non-billable':
      return 'bg-amber-500';
    case 'Billable':
    default:
      return 'bg-emerald-500';
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
    case 'Internal':
      return {
        colorClass: 'bg-[rgb(129,164,137)]',
        borderClass: 'border border-[rgb(109,144,117)]',
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

/** Matches `bg-stripes` in index.css — 6px bands, 12px period at full density. */
const STRIPE_BAND_PX = 6;
const TIME_OFF_STRIPE_PERIOD_PX = 12;

/**
 * Repeat period for diagonal bands — null at 100% (solid).
 * Heavy pattern (12px, same as time-off) at low allocation; sparser as % rises.
 */
export function getAllocationStripeSpacing(percent: number): number | null {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped >= 100) return null;
  const utilization = clamped / 100;
  const minPeriod = TIME_OFF_STRIPE_PERIOD_PX;
  const maxPeriod = 48;
  return minPeriod + utilization * (maxPeriod - minPeriod);
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
    case 'Internal':
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

/** Request-lane blocks (assigned vs open skill request). */
export function getRequestBlockChrome(assigned: boolean): AllocationBlockChrome {
  const fill: Rgb = assigned ? { r: 59, g: 130, b: 246 } : { r: 96, g: 165, b: 250 };
  return {
    fillColor: rgb(fill),
    borderColor: assigned ? 'rgb(147, 197, 253)' : 'rgb(96, 165, 250)',
    stripeColor: lightenRgb(fill, 0.035),
    textClass: 'text-white',
    badgeClass: SCHEDULE_BLOCK_BADGE_CLASS,
  };
}

/**
 * Solid category fill + single diagonal stripe band when utilization < 100%.
 * Heavy pattern at low % (12px period); solid at 100%.
 */
export function getAllocationBlockBackground(
  percent: number,
  chrome: AllocationBlockChrome,
): BlockBackgroundStyle {
  const period = getAllocationStripeSpacing(percent);
  if (period === null) {
    return {
      backgroundColor: chrome.fillColor,
      borderColor: chrome.borderColor,
    };
  }
  const band = STRIPE_BAND_PX;
  return {
    backgroundColor: chrome.fillColor,
    borderColor: chrome.borderColor,
    backgroundImage: `repeating-linear-gradient(45deg, ${chrome.stripeColor} 0px, ${chrome.stripeColor} ${band}px, transparent ${band}px, transparent ${period}px)`,
  };
}

export function getProjectCategoryLabel(category: ProjectCategory): string {
  return category;
}

/** Billable type stored on schedules — inherited from the project, not user-editable. */
export function getBillableTypeFromProject(project: Project): BillableType {
  return getProjectCategory(project) === 'Opportunity' ? 'Opportunity' : 'Billable';
}
