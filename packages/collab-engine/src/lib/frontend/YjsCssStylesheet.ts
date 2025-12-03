import { injectCssClass } from '@holistix/ui-toolkit';
import './YjsAwareness.css';

const userCss: {
  [key: string]: Array<string>;
} = {};

export const buildUserCss = (key: number, color: string | undefined) => {
  color = color || 'var(--c-orange-4)';
  const k = `${key}`;

  if (!userCss[k]) {
    userCss[k] = [
      `
        .yRemoteSelection-${key} {
            background-color: ${color};
            opacity: 0.8;
        }
        `,
      `
        .yRemoteSelectionHead-${key} {
            background-color: ${color};
            border-left: ${color} solid 2px;
            border-top: ${color} solid 2px;
            border-bottom: ${color} solid 2px;
        }
        `,
      `
        .yRemoteSelectionHead-${key}::after {
            border: 3px solid ${color};
        }
        `,
    ];
    userCss[k].forEach((rule: string) => injectCssClass(rule));
  }
};
