import { Dispatch, useCallback, useReducer, useState } from "react";
import { icons } from "../assets/icons";

import "./tabs.scss";

/**
 *
 */
export type TNestedTab = {
  title: string;
  children?: TNestedTab[];
};

/**
 *
 */
type TActions =
  | {
      type: "activate";
      id: string[];
    }
  | {
      type: "add";
      path: string[];
    }
  | {
      type: "remove";
      path: string[];
    }
  | {
      type: "set-title";
      path: string[];
      title: string;
    }
  | {
      type: "nest";
      path: string[];
    };

/**
 *
 */
type TState = {
  active: string[];
  tabs: TNestedTab[];
};

/*
 *
 */

const initialTabs: TState = {
  active: ["CI/CD"],
  tabs: [
    {
      title: "CI/CD",
    },
  ],
};

/**
 * return the tabs in the bar located at 'path' in the tabs tree if it exists.
 */

const gotoTab = (state: TState, path: string[]): TNestedTab[] | undefined => {
  let t: TNestedTab[] | undefined = state.tabs;
  for (let i = 0; i < path.length && t; i++)
    t = t.find((tab) => tab.title === path[i])?.children;
  return t;
};

//

const reducer = (state: TState, action: TActions): TState => {
  switch (action.type) {
    case "activate":
      state.active = action.id;
      return { ...state };

    case "add":
      {
        const t = gotoTab(state, action.path);
        if (t) t.push({ title: `new [${t.length + 1}]` });
      }
      return { ...state };

    case "remove":
      // TODO: delete children recursively before
      {
        const title = action.path.pop();
        const t = gotoTab(state, action.path);
        if (t) {
          const index = t.findIndex((t3) => t3.title === title);
          if (index !== -1) t.splice(index, 1);
          // TODO: change active if it was the deleted one
        }
      }
      return { ...state };

    case "set-title":
      {
        const title = action.path.pop();
        const t = gotoTab(state, action.path);
        if (t) {
          const tab = t.find((t3) => t3.title === title);
          if (tab) tab.title = action.title;
          // TODO: change active if it was this one
        }
      }
      return { ...state };

    case "nest":
      {
        const title = action.path.pop();
        const t = gotoTab(state, action.path);
        if (t) {
          const tab = t.find((t3) => t3.title === title);
          if (tab) tab.children = [];
        }
      }
      return { ...state };

    default:
      return state;
  }
};

/**
 *
 */
export const NestedTab = () => {
  const [state, dispatch] = useReducer(reducer, initialTabs);
  // we render the right amount of tabs
  // depending on the active one

  return Array(state.active.length + 1)
    .fill(1)
    .map((v, k) => {
      const path = state.active.slice(0, k);
      return <TabsBar key={k} state={state} dispatch={dispatch} path={path} />;
    });
};

/**
 *
 * @returns
 */
export const TabsBar = ({
  state,
  dispatch,
  path,
}: {
  state: TState;
  dispatch: Dispatch<TActions>;
  path: string[];
}) => {
  //
  const [editing, setEditing] = useState<string[] | undefined>(undefined);

  const [newTitle, setNewTitle] = useState<string>("");

  //

  const handleChange = useCallback((e: React.FormEvent) => {
    const value = (e.target as HTMLSpanElement).innerText;
    setNewTitle(value);
  }, []);

  //

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing && e.keyCode === 13) {
        e.preventDefault();
        dispatch({ type: "set-title", title: newTitle, path: editing });
        setNewTitle("");
        setEditing(undefined);
      }
    },
    [dispatch, editing, newTitle]
  );

  //

  // get the tabs located on this bar
  const bar = gotoTab(state, path);
  if (!bar) return null;

  return (
    <div className="tabs-container">
      <div className="tab main">
        <ul>
          {bar.map((tab) => {
            // make the path of this tab
            const tabPath = [...path, tab.title];
            // extract the same length from the active path
            const slicestate = state.active.slice(0, tabPath.length);
            // compare the two array to check if this tabs is in the active path
            const active =
              JSON.stringify(slicestate) === JSON.stringify(tabPath);

            const isEditing =
              JSON.stringify(editing) === JSON.stringify(tabPath);

            return (
              <li
                key={tab.title}
                onDoubleClick={() => setEditing(tabPath)}
                className={`tab-item`}
                onClick={() =>
                  !active && dispatch({ type: "activate", id: tabPath })
                }
              >
                <div className={active ? "bg-tab" : ""}>
                  {active && !tab.children && (
                    <div className="icon-add">
                      <icons.Plus
                        onClick={(e) => {
                          dispatch({ type: "nest", path: tabPath });
                          e.stopPropagation();
                        }}
                      />
                    </div>
                  )}
                  <span
                    id="tab-name"
                    role="textbox"
                    onInput={handleChange}
                    contentEditable={isEditing}
                    onKeyDown={handleKeyDown}
                  >
                    {tab.title}
                  </span>
                  {active && (
                    <icons.Close
                      onClick={(e) => {
                        dispatch({ type: "remove", path: tabPath });
                        e.stopPropagation();
                      }}
                      className="icon-close"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="line" />
        <icons.Plus
          className="add"
          onClick={() => dispatch({ type: "add", path })}
        />
      </div>
    </div>
  );
};
