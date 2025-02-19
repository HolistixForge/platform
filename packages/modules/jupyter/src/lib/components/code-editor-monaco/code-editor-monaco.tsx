import { useRef } from 'react';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';

import { cssVar } from '@monorepo/ui-base';

import { CodeEditorMonacoProps } from './code-editor-monaco-lazy';

import './code-editor-monaco.scss';

type IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
type IStandaloneThemeData = editor.IStandaloneThemeData;

//

type TTheme = {
  name: string;
  value: IStandaloneThemeData;
};

const defaultTheme = (): TTheme => ({
  name: 'defaulttheme',
  value: {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': cssVar('--c-blue-gray-8'),
    },
  },
});

//
//

const definedThemes = new Map<string, TTheme>();

//
//

const CodeEditorMonaco = ({
  code,
  onMount,
  onFocus,
  onBlur,
  onChange,
  language = 'python',
  theme,
}: CodeEditorMonacoProps) => {
  //

  const editorRef = useRef<IStandaloneCodeEditor | null>(null);

  const t = theme ? theme : defaultTheme();

  const mount = (div: HTMLDivElement) => {
    if (!div) {
      //console.warn('editor-mount-box not ready');
      return;
    } else if (!monaco) {
      //console.warn('monaco editor lib not ready');
      return;
    } else if (editorRef.current !== null) {
      //console.warn('CodeEditorMonaco initialized yet');
      return;
    } else {
      //
      // define monaco theme if necessary
      if (!definedThemes.get(t.name)) {
        console.log('define theme', t);
        monaco.editor.defineTheme(t.name, t.value);
        definedThemes.set(t.name, t);
      }

      const thisEditor: IStandaloneCodeEditor = monaco.editor.create(div, {
        language,
        theme: t.name,
        automaticLayout: true, // Enable automatic layout adjustments
      });

      // Timeout used to be sure 'onBlur' will run before 'onFocus' when jumping from a code cell to another
      onFocus &&
        thisEditor.onDidFocusEditorWidget(() =>
          setTimeout(() => onFocus(), 300)
        );

      onChange &&
        thisEditor.onDidChangeModelContent(() =>
          onChange(thisEditor.getValue())
        );

      onBlur && thisEditor.onDidBlurEditorWidget(onBlur);

      thisEditor.getModel()?.setValue(code);

      editorRef.current = thisEditor;

      onMount && onMount(thisEditor);
    }
  };

  return (
    <div
      ref={mount}
      className="editor-mount-box"
      style={{ width: '100%', height: 'var(--monaco-editor-height)' }}
    ></div>
  );
};

export default CodeEditorMonaco;
