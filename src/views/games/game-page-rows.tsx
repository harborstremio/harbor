import { Children, isValidElement, useEffect, type ReactNode } from "react";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { RowControls } from "@/views/home/row-controls";
import { hasPageRowChanges, movePageRow, orderedRowKeys, resetPageRows, togglePageRowHidden, usePageRows } from "@/lib/page-rows";
import { LazyMount } from "@/components/lazy-mount";
import "./game-page-rows.css";


/** Matches the home rows: the first couple mount with the page, the rest wait. */
const EAGER_ROWS = 2;

type RowProps = { id: string; title: string; children: ReactNode };
export function GamePageRow({ children }: RowProps) { return <>{children}</>; }

/** Heterogeneous discovery sections share the catalog pages' saved row preferences. */
export function GamePageRows(props: { page: string; active: boolean; inset?: boolean; children: ReactNode; onVisibilityChange?: (hidden: string[]) => void; intro?: (hidden: string[]) => ReactNode }) {
  return <SavedRows key={props.page} {...props}/>;
}

function SavedRows({ page, active, inset, children, intro, onVisibilityChange }: Parameters<typeof GamePageRows>[0]) {
  const { custom, editMode, setEditMode, persist } = usePageRows(page);
  const rows = Children.toArray(children).filter(isValidElement<RowProps>);
  const keys = rows.map(row => row.props.id);
  const order = orderedRowKeys(keys, custom);
  const editing = active && editMode;
  useEffect(() => { if (!active) setEditMode(false); }, [active, setEditMode]);
  useEffect(() => { onVisibilityChange?.(custom.hidden); }, [custom.hidden, onVisibilityChange]);
  return <>
    {intro?.(custom.hidden)}
    <div className={`games-page-customize${inset ? " games-inset" : ""}`}>
      <CatalogCustomizeBar editMode={editing} hasChanges={hasPageRowChanges(custom)} onToggleEdit={() => setEditMode(value => !value)} onReset={() => persist(resetPageRows())}/>
    </div>
    {order.map((id, index) => {
      const row = rows.find(row => row.props.id === id)!;
      const hidden = custom.hidden.includes(id);
      return <div key={id} className="games-custom-row" data-page-row={id}>
        {editing && <div className={`games-row-controls${inset ? " games-inset" : ""}`}>
          <RowControls name={row.props.title} hidden={hidden} canMoveUp={index > 0} canMoveDown={index < order.length - 1}
            onMoveUp={() => persist(movePageRow(custom, keys, id, -1))} onMoveDown={() => persist(movePageRow(custom, keys, id, 1))}
            onToggleHidden={() => persist(togglePageRowHidden(custom, id))} canRename={false} isRenamed={false} onRename={() => {}} onResetName={() => {}}/>
        </div>}
        {!hidden && (index < EAGER_ROWS ? row : <LazyMount minHeight={340}>{row}</LazyMount>)}
      </div>;
    })}
  </>;
}
