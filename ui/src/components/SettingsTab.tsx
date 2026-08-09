/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useRef } from 'react';
import { Resource, Project } from '../types';
import { Upload, FileUp, AlertCircle, CheckCircle } from 'lucide-react';
import { env } from '../lib/shared/env';
import { Button, Card } from './ui';

interface ImportResult {
  status: 'success' | 'error';
  count: number;
  errors: string[];
}

interface UploadState {
  isLoading: boolean;
  isDownloading: boolean;
  result: ImportResult | null;
  error: string | null;
}

interface SettingsTabProps {
  resources?: Resource[];
  projects?: Project[];
  onAddResource?: (resource: Omit<Resource, 'id'>) => void;
  onDeleteResource?: (id: string) => void;
  onAddProject?: (project: Omit<Project, 'id'>) => void;
  onDeleteProject?: (id: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = () => {
  const fileInputRefs = {
    persons: useRef<HTMLInputElement>(null),
    projects: useRef<HTMLInputElement>(null),
    opportunities: useRef<HTMLInputElement>(null),
    schedules: useRef<HTMLInputElement>(null),
  };

  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({
    persons: { isLoading: false, isDownloading: false, result: null, error: null },
    projects: { isLoading: false, isDownloading: false, result: null, error: null },
    opportunities: { isLoading: false, isDownloading: false, result: null, error: null },
    schedules: { isLoading: false, isDownloading: false, result: null, error: null },
  });

  const handleFileUpload = async (type: 'persons' | 'projects' | 'opportunities' | 'schedules', file: File) => {
    if (!file) return;

    setUploadStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], isLoading: true, result: null, error: null },
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Construct API URL: in dev, Node runs on 4000 (env.apiUrl); in prod same
      const apiBaseUrl = env.apiUrl;
      const response = await fetch(`${apiBaseUrl}/api/import/${type}`, {
        method: 'POST',
        body: formData,
      });

      const data: ImportResult = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0] || 'Upload failed');
      }

      setUploadStates((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: false, result: data, error: null },
      }));

      // Clear success message after 5 seconds
      setTimeout(() => {
        setUploadStates((prev) => ({
          ...prev,
          [type]: { ...prev[type], isLoading: false, result: null, error: null },
        }));
      }, 5000);
    } catch (err) {
      setUploadStates((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: false, result: null, error: (err as Error).message },
      }));
    }
  };

  const handleDownload = async (type: 'persons' | 'projects' | 'opportunities' | 'schedules') => {
    setUploadStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], isDownloading: true, error: null },
    }));

    try {
      const apiBaseUrl = env.apiUrl;
      const response = await fetch(`${apiBaseUrl}/api/import/${type}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
      const fileName = match?.[1] || `${type}_import_template.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setUploadStates((prev) => ({
        ...prev,
        [type]: { ...prev[type], isDownloading: false },
      }));
    } catch (err) {
      setUploadStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          isDownloading: false,
          error: err instanceof Error ? err.message : 'Download failed',
        },
      }));
    }
  };

  const handleBrowseClick = (type: 'persons' | 'projects' | 'opportunities' | 'schedules') => {
    fileInputRefs[type].current?.click();
  };

  const handleFileChange = (type: 'persons' | 'projects' | 'opportunities' | 'schedules', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(type, file);
    }
    // Reset input so same file can be uploaded again
    if (fileInputRefs[type].current) {
      fileInputRefs[type].current.value = '';
    }
  };

  const ImportCard = ({
    type,
    title,
    description,
  }: {
    type: 'persons' | 'projects' | 'opportunities' | 'schedules';
    title: string;
    description: string;
  }) => {
    const state = uploadStates[type];

    return (
      <Card padded className="bg-surface-muted hover:bg-surface-hover transition-colors">
        <h3 className="text-base font-semibold text-primary mb-1">{title}</h3>
        <p className="text-sm text-secondary mb-4">{description}</p>

        {/* Upload Button */}
        {!state.result && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handleBrowseClick(type)}
              loading={state.isLoading}
              disabled={state.isDownloading}
              variant="primary"
              leftIcon={<FileUp className="w-4 h-4" />}
            >
              {state.isLoading ? 'Uploading...' : 'Browse & Upload'}
            </Button>
            <Button
              onClick={() => handleDownload(type)}
              loading={state.isDownloading}
              disabled={state.isLoading}
              variant="outline"
              leftIcon={<Upload className="w-4 h-4" />}
            >
              {state.isDownloading ? 'Downloading...' : 'Download Current Data'}
            </Button>
          </div>
        )}

        {/* Success State */}
        {state.result && state.result.status === 'success' && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Successfully imported {state.result.count} record{state.result.count !== 1 ? 's' : ''}
              </p>
              {state.result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {state.result.errors.slice(0, 3).map((error, idx) => (
                    <p key={idx} className="text-xs text-green-700 dark:text-green-400">
                      {error}
                    </p>
                  ))}
                  {state.result.errors.length > 3 && (
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ... and {state.result.errors.length - 3} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {state.error && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Upload failed</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{state.error}</p>
            </div>
          </div>
        )}

        {/* Partial Errors */}
        {state.result && state.result.errors.length > 0 && state.result.status === 'success' && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {state.result.errors.length} row{state.result.errors.length !== 1 ? 's' : ''} had errors:
            </p>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {state.result.errors.map((error, idx) => (
                <p key={idx} className="text-xs text-amber-700 dark:text-amber-400">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRefs[type]}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileChange(type, e)}
          disabled={state.isLoading}
        />
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-6">
      <div>
        <h2 className="text-2xl font-extrabold text-primary tracking-tight mb-2">Data Import</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <ImportCard
          type="persons"
          title="Import Persons"
          description="Upload employee data including consulting units, sites, job levels, and competency centers."
        />
        <ImportCard
          type="projects"
          title="Import Projects"
          description="Upload project data. Billability is auto-detected from project code prefix (T/F = Billable)."
        />
        <ImportCard
          type="opportunities"
          title="Import Opportunities"
          description="Upload opportunity data with market units, probability, practice areas, and regions."
        />
        <ImportCard
          type="schedules"
          title="Import Schedules"
          description="Upload schedule rows (Employee ID or Resource Name, Project ID or Project Name, Year, Week, Days). Supports fractional days from 0 to 10."
        />
      </div>
    </div>
  );
};

