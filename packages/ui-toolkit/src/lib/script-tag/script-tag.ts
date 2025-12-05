import { useMemo } from 'react';
import { insertScript } from './script-tag-core';

// Re-export backend-safe functions
export { insertScript, insertScriptsSynchronously } from './script-tag-core';

// Type for script configuration
type I_Script = {
  url?: string;
  code?: string;
  async: boolean;
};

// React hook for inserting scripts
export const useScript = (script: I_Script) => {
  const p = useMemo(() => insertScript(script), [script]);
  return p;
};
