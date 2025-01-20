// ----- Edge

type EEdgeType = 'UNKNOWN' | 'REFERENCE' | 'SEQUENCE';

type Def = 'none';
type HasData<T> = T extends Def
  ? {
      /* */
    }
  : { data: T };

export type TEdgeEnd<Data = Def> = {
  node: string;
  connector?: string;
} & HasData<Data>;

export type TEdge<Data = Def, DataFrom = Def, DataTo = Def> = {
  from: TEdgeEnd<DataFrom>;
  to: TEdgeEnd<DataTo>;
  type: EEdgeType;
} & HasData<Data>;

export type TAnyEdge = TEdge & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: { data?: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: { data?: any };
};
