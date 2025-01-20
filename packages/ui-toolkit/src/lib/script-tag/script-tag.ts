import { useMemo } from 'react';

//
//

type I_Script = {
  url?: string;
  code?: string;
  async: boolean;
};

//
//

export const insertScript = ({ url, code, async = true }: I_Script) => {
  const p = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = async;

    if (code) script.innerHTML = code;
    else if (url) {
      script.addEventListener('load', () => {
        resolve(script);
      });
      script.src = url;
    } else reject('no code nor url provided');

    document.body.appendChild(script);
    if (code) resolve(script);
  });

  return p;
};

//
//

export const insertScriptsSynchronously = async (scripts: I_Script[]) => {
  let i = 0;
  while (i < scripts.length) {
    await insertScript(scripts[i]);
    i++;
  }
  return true;
};

//
//

export const useScript = (script: I_Script) => {
  const p = useMemo(() => insertScript(script), [script]);
  return p;
};
