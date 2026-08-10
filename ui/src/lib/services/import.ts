import { env } from '../shared/env';

export type ImportType = 'persons' | 'projects' | 'opportunities' | 'schedules';

export interface ImportResult {
  status: 'success' | 'error';
  count: number;
  errors: string[];
}

export interface ImportTemplateDownload {
  blob: Blob;
  fileName: string;
}

export const importService = {
  async upload(type: ImportType, file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${env.apiUrl}/api/import/${type}`, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as ImportResult;
    if (!response.ok) {
      throw new Error(data.errors?.[0] || 'Upload failed');
    }
    return data;
  },

  async downloadTemplate(type: ImportType): Promise<ImportTemplateDownload> {
    const response = await fetch(`${env.apiUrl}/api/import/${type}/download`);
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') || '';
    const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
    const fileName = match?.[1] || `${type}_import_template.xlsx`;
    return { blob, fileName };
  },
};
