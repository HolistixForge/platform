import React, {
  FC,
  ReactNode,
  useCallback,
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { PanelComponent, TPanel } from '../../frontend';
import { icons } from '@holistix-forge/ui-base';

// Panel Context
interface PanelContextValue {
  panels: TPanel[];
  openPanel: (panel: TPanel) => void;
  closePanel: (uuid: string) => void;
  closeTopPanel: () => void;
}

const PanelContext = createContext<PanelContextValue | undefined>(undefined);

// Hook to use panel context
export const usePanelContext = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error(
      'usePanelContext must be used within a RightPanels provider'
    );
  }
  return context;
};

// Props for the RightPanels component
interface RightPanelsProps {
  children: ReactNode;
  panelsDefs?: Record<string, PanelComponent>;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

// RightPanels component
export const RightPanels: FC<RightPanelsProps> = ({
  children,
  panelsDefs,
  initialWidth = 33,
  minWidth = 20,
  maxWidth = 80,
}) => {
  const [panels, setPanels] = useState<TPanel[]>([]);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(initialWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Panel operations
  const openPanel = useCallback((panel: TPanel) => {
    setPanels((prevPanels) => [...prevPanels, panel]);
  }, []);

  const closePanel = useCallback((uuid: string) => {
    setPanels((prevPanels) => prevPanels.filter((p) => p.uuid !== uuid));
  }, []);

  const closeTopPanel = useCallback(() => {
    setPanels((prevPanels) => prevPanels.slice(0, -1));
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const containerWidth = window.innerWidth;
      const newWidth = (e.clientX / containerWidth) * 100;

      // Clamp between minWidth and maxWidth
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      setRightPanelWidth(100 - clampedWidth);
    },
    [isResizing, minWidth, maxWidth]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Panel component rendering
  const UnknownPanel = ({ type }: { type: string }) => {
    return <div>Unknown Panel [{type}]</div>;
  };

  const Panel =
    panels.length > 0
      ? panelsDefs?.[panels[panels.length - 1].type] ??
        (() => <UnknownPanel type={panels[panels.length - 1].type} />)
      : () => <UnknownPanel type="unknown" />;

  // Context value
  const contextValue = useMemo(
    () => ({
      panels,
      openPanel,
      closePanel,
      closeTopPanel,
    }),
    [panels, openPanel, closePanel, closeTopPanel]
  );

  return (
    <PanelContext.Provider value={contextValue}>
      <div style={{ display: 'flex', height: '100%', width: '100%' }}>
        {/* Main content area */}
        <div
          style={{
            flex: 1,
            width: `${100 - rightPanelWidth}%`,
            height: '100%',
            position: 'relative',
          }}
        >
          {children}
        </div>

        {/* Right panels area */}
        {panels.length > 0 && (
          <>
            {/* Resize handle */}
            <div
              style={{
                width: '2px',
                backgroundColor: isResizing ? '#007acc' : 'var(--c-pink-4)',
                cursor: 'col-resize',
                position: 'relative',
                zIndex: 10,
              }}
              onMouseDown={handleResizeStart}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '2px',
                  height: '20px',
                  backgroundColor: isResizing ? '#007acc' : '#999',
                  borderRadius: '1px',
                }}
              />
            </div>

            {/* Panel container */}
            <div
              style={{
                width: `${rightPanelWidth}%`,
                height: '100%',
                overflow: 'auto',
                position: 'relative',
              }}
            >
              <Panel
                panel={panels[panels.length - 1]}
                closePanel={closePanel}
              />

              {/* Close button */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '20px',
                  height: '20px',
                  backgroundColor: 'var(--c-pink-4)',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={closeTopPanel}
              >
                <icons.Close style={{ width: '16px', height: '16px' }} />
              </div>
            </div>
          </>
        )}
      </div>
    </PanelContext.Provider>
  );
};
