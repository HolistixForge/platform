import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { getCssProperties } from '../css-utils/css-utils';
import { copyToClipboard } from '../utils/copy-to-clipboard';

import './palette-viewer.css';

//
//
type PaletteGroups = { [key: string]: { [key: string]: string } };

const StoryWrapper = (props: Record<string, never>) => {
  const [palette, setPalette] = useState<PaletteGroups>({});
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    const palette = getCssProperties('--c-');
    const groups: PaletteGroups = {};
    Object.keys(palette).forEach((property) => {
      const group = property.replace(/\d/g, '');
      if (!groups[group]) groups[group] = {};
      groups[group][property] = palette[property];
    });
    console.log(groups);
    setPalette(groups);
  }, []);

  //

  const handleColorBoxClick = (propertyName: string) => {
    // Copy the CSS property name to clipboard
    copyToClipboard(propertyName)
      .then(() => {
        setCopied(`var(${propertyName})`);
      })
      .catch((error) => {
        console.error('Error copying to clipboard:', error);
      });
  };

  //

  return (
    <div className="palette-viewer" style={{ width: '1000px' }}>
      <h1>Palette Viewer</h1>
      <h2>{copied ? `copied to clipboard: ${copied}` : ''}&nbsp;</h2>

      {Object.entries(palette).map(([groupName, group]) => {
        console.log({ groupName, group });
        return (
          <div key={groupName}>
            <h3>{groupName}</h3>
            <div className="color-grid">
              {Object.entries(group)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([propertyName, color]) => (
                  <div
                    key={propertyName}
                    className="color-box"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorBoxClick(propertyName)}
                  >
                    <span className="color-label">
                      {propertyName}
                      <br />
                    </span>
                    <span style={{ fontSize: '10px' }}>{color}</span>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

//

const meta = {
  title: 'Palette/Default',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
