import { ReducedCell, ReducedCellProps } from './reduced-cell';

export type CellData = { type: ReducedCellProps['type']; id: string };

export type Cells = Array<CellData>;

export interface CellsHiveProps {
  cells: Cells;
  columnsNumber: number;
}

export const CellsHive = ({ cells, columnsNumber }: CellsHiveProps) => {
  const columns: Array<Cells> = Array(columnsNumber)
    .fill(1)
    .map(() => []);

  cells.forEach((c, i) => columns[i % columnsNumber].push(c));

  return (
    <div className="flex" style={{ gap: '1px' }}>
      {columns.map((column, i) => (
        <div
          key={i}
          className="flex flex-col"
          style={{
            gap: '1px',
            ...(i % 2 === 1 ? { transform: 'translateY(4px)' } : {}),
          }}
        >
          {column.map((c) => (
            <ReducedCell type={c.type} key={c.id} />
          ))}
        </div>
      ))}
    </div>
  );
};
