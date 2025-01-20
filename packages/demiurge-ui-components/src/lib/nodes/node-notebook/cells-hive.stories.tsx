import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Cells, CellsHive, CellsHiveProps } from './cells-hive';
import { ReducedCellProps } from './reduced-cell';

//

const types = ['normal', 'validate', 'error', 'running'];

const makeCell = (id: number) => {
  const rand = Math.floor(Math.random() * types.length);
  // console.log({ rand, type: types[rand] });
  return {
    id: `${id}`,
    type: types[rand] as ReducedCellProps['type'],
  };
};

//

const StoryWrapper = (
  props: Pick<CellsHiveProps, 'columnsNumber'> & { cellsNumber: number },
) => {
  const [cells, setCells] = useState<Cells>([]);
  useEffect(() => {
    setCells(
      Array(props.cellsNumber)
        .fill(1)
        .map((_, i) => makeCell(i)),
    );
  }, [props.cellsNumber]);

  const addCell = () => {
    const rand = Math.floor(Math.random() * types.length);
    // console.log({ rand, type: types[rand] });
    cells.push({
      id: `${cells.length}`,
      type: types[rand] as ReducedCellProps['type'],
    });
    setCells([...cells]);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        style={{ position: 'absolute', left: '-75px', top: '50%' }}
        onClick={addCell}
      >
        add
      </button>
      <div style={{ minWidth: '100px' }}>
        <CellsHive columnsNumber={props.columnsNumber} cells={cells} />
      </div>
    </div>
  );
};

//

const meta = {
  title: 'Nodes/Notebook/Asset/CellsHive',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/t7q8Z4dRrFG5WjZ2WWVisd/Ewan-design?type=design&node-id=687-20646&mode=design&t=pE4zcaJ3ZpYQ6JQl-4',
    },
  },
  args: {
    columnsNumber: 5,
    cellsNumber: 0,
  },
};
