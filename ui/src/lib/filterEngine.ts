import type { BookingRequest, Project, Resource } from '../types';
import { getEffectiveBillableType } from './projectCategory';

export type FilterCriteria = Record<string, unknown>;

function isEmptyCriteria(criteria: FilterCriteria): boolean {
  return Object.keys(criteria).length === 0;
}

export function matchesProject(project: Project, criteria: FilterCriteria): boolean {
  if (isEmptyCriteria(criteria)) return true;

  if (criteria.consulting_unit_id && project.consultingUnitId !== criteria.consulting_unit_id) {
    return false;
  }
  if (criteria.market_unit_id && project.marketUnitId !== criteria.market_unit_id) {
    return false;
  }
  if (criteria.win_probability_lt !== undefined && criteria.win_probability_lt !== null) {
    const winProb = project.winProbability ?? 100;
    if (winProb >= Number(criteria.win_probability_lt)) {
      return false;
    }
  }

  return true;
}

export function matchesPerson(person: Resource, criteria: FilterCriteria): boolean {
  if (isEmptyCriteria(criteria)) return true;

  if (criteria.site_id && person.siteId !== criteria.site_id) {
    return false;
  }
  if (criteria.consulting_unit_id && person.consultingUnitId !== criteria.consulting_unit_id) {
    return false;
  }
  if (criteria.practice_area_id && person.practiceAreaId !== criteria.practice_area_id) {
    return false;
  }
  if (criteria.lifecycle_status && person.lifecycleStatus !== criteria.lifecycle_status) {
    return false;
  }
  if (criteria.status && person.status !== criteria.status) {
    return false;
  }

  return true;
}

export function matchesRequest(
  request: BookingRequest,
  criteria: FilterCriteria,
  projectById: Map<string, Project>,
): boolean {
  if (isEmptyCriteria(criteria)) return true;

  if (criteria.status && request.status !== criteria.status) {
    return false;
  }
  if (criteria.billable_type) {
    const project = projectById.get(request.projectId);
    const effective = getEffectiveBillableType(request.billableType, project);
    if (effective !== criteria.billable_type) {
      return false;
    }
  }
  if (criteria.unassigned_only === true && request.resourceId) {
    return false;
  }
  if (criteria.project_consulting_unit_id) {
    const project = projectById.get(request.projectId);
    if (!project || project.consultingUnitId !== criteria.project_consulting_unit_id) {
      return false;
    }
  }

  return true;
}

export function filterProjects(projects: Project[], criteria: FilterCriteria | null): Project[] {
  if (!criteria || isEmptyCriteria(criteria)) return projects;
  return projects.filter((p) => matchesProject(p, criteria));
}

export function filterPeople(people: Resource[], criteria: FilterCriteria | null): Resource[] {
  if (!criteria || isEmptyCriteria(criteria)) return people;
  return people.filter((p) => matchesPerson(p, criteria));
}

export function filterRequests(
  requests: BookingRequest[],
  criteria: FilterCriteria | null,
  projects: Project[],
): BookingRequest[] {
  if (!criteria || isEmptyCriteria(criteria)) return requests;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  return requests.filter((r) => matchesRequest(r, criteria, projectById));
}
