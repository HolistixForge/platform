import { ReadWriteTree, TreeElement } from '@monorepo/demiurge-types';
import { PanelProps, TabsRadix } from './tabs-radix';
import { FC, useMemo, useState } from 'react';

//

type TabsRadixLogicProps<T> = {
  initialTree: TreeElement<T>;
  PanelComponent: FC<PanelProps & T>;
  newTabPayload: () => T;
  convertToGroupPayload: () => T;
  maxRow: number;
  hidden?: boolean;
};

//

export const TabsRadixLogic = <
  T extends {
    /**/
  }
>({
  initialTree,
  PanelComponent,
  newTabPayload,
  convertToGroupPayload,
  maxRow,
  hidden,
}: TabsRadixLogicProps<T>) => {
  //

  const [active, setActive] = useState<string[]>([
    initialTree.children[0].title,
  ]);

  const tree = useMemo(() => {
    const t = new ReadWriteTree<T>(initialTree);
    // t.addListener(() => update({}));
    return t;
  }, [initialTree]);

  //

  const handleTabChange = (path: string[]) => {
    setActive(path);
  };

  //

  const handleTabAdd = (path: string[]) => {
    const e = tree.get(path, path.length);
    if (e) {
      const l = e.children.length;
      const title = `New ${l}`;
      tree.insert([...path, title], newTabPayload());
      return title;
    }
    return undefined;
  };

  //

  const handleTabDelete = (path: string[]) => {
    const newSelected = tree.delete(path);
    if (newSelected) setActive(newSelected);
  };

  //

  const handleTabRowAdd = (path: string[]) => {
    if (path.length < maxRow) {
      tree.update(path, { payload: convertToGroupPayload() });
      const title = handleTabAdd(path);
      if (title) setActive([...path, title]);
    }
  };

  //

  const handleTabRename = (path: string[], newName: string) => {
    tree.update(path, { title: newName });
    path[path.length - 1] = newName;
    setActive(path);
  };

  //

  return (
    <TabsRadix
      tree={tree}
      active={active}
      maxRow={maxRow}
      onTabChange={handleTabChange}
      onTabAdd={handleTabAdd}
      onTabDelete={handleTabDelete}
      onTabRowAdd={handleTabRowAdd}
      onTabRename={handleTabRename}
      hidden={hidden}
    >
      {tree.flat().map((panel) => (
        <PanelComponent
          key={panel.path.join('.')}
          tabPath={panel.path}
          {...panel}
        />
      ))}
    </TabsRadix>
  );
};
