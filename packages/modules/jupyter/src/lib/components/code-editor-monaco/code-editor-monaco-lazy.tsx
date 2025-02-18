import { lazy, Suspense } from 'react';

const LazyCodeEditorMonaco = lazy(() => import('./code-editor-monaco'));

export type CodeEditorMonacoProps = {
  code: string;
  onMount?: (editor: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (s: string) => void;
  theme?: any;
  language?: string;
};

export const CodeEditorMonaco = (props: CodeEditorMonacoProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyCodeEditorMonaco {...props} />
  </Suspense>
);
