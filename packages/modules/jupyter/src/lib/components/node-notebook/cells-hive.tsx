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
    <div className="flex gap-[1px]">
      {columns.map((column, i) => (
        <div
          key={i}
          className={`flex flex-col gap-[1px] ${
            i % 2 === 1 ? 'translate-y-1' : ''
          }`}
        >
          {column.map((c) => (
            <ReducedCell type={c.type} key={c.id} />
          ))}
        </div>
      ))}
    </div>
  );
};
