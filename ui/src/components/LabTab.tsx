/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FlaskConical } from 'lucide-react';

export const LabTab: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center app-card" id="lab-workspace">
      <div className="p-4 tint-blue rounded-full mb-4">
        <FlaskConical className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-extrabold text-primary tracking-tight">Lab</h2>
      <p className="mt-2 text-sm text-secondary max-w-sm leading-relaxed">
        Experimental features and prototypes live here. Check back as new ideas graduate from the lab.
      </p>
      <div className="mt-6 px-4 py-1.5 tint-blue text-xs font-bold uppercase tracking-wider rounded-full">
        Coming Soon
      </div>
    </div>
  );
};
