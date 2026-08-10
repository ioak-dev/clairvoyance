import { useMutation } from '@tanstack/react-query';
import { importService, type ImportType } from '../lib/services/import';

export function useImportUpload() {
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) =>
      importService.upload(type, file),
  });
}

export function useImportTemplateDownload() {
  return useMutation({
    mutationFn: (type: ImportType) => importService.downloadTemplate(type),
  });
}
