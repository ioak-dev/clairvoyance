/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import { Resource, Project } from '../types';
import { SlidersHorizontal } from 'lucide-react';

interface SettingsTabProps {
  resources?: Resource[];
  projects?: Project[];
  onAddResource?: (resource: Omit<Resource, 'id'>) => void;
  onDeleteResource?: (id: string) => void;
  onAddProject?: (project: Omit<Project, 'id'>) => void;
  onDeleteProject?: (id: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center app-card" id="settings-coming-soon">
      <div className="p-4 tint-blue rounded-full mb-4">
        <SlidersHorizontal className="w-8 h-8 animate-pulse" />
      </div>
      <h2 className="text-2xl font-extrabold text-primary tracking-tight">Settings Workspace</h2>
      <p className="mt-2 text-sm text-secondary max-w-sm">
        We are crafting custom configuration panels for you. This settings view is coming soon!
      </p>
      <div className="mt-6 px-4 py-1.5 tint-blue text-xs font-bold uppercase tracking-wider rounded-full">
        Coming Soon
      </div>
    </div>
  );
};

