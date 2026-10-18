import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type FC,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Table.module.css';

export interface Column<T> {
  title: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

interface TableContextValue<T = any> {
  data: T[];
  columns: Column<T>[];
}

const TableContext = createContext<TableContextValue | null>(null);

const TableContent: FC = () => {
  const context = useContext(TableContext);
  if (!context) return null;

  const { data, columns } = context;

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={styles.th}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className={styles.tr}>
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={styles.td}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.render(row, rowIdx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  children?: ReactNode;
}

export function Table<T>({ data, columns, children }: TableProps<T>) {
  return (
    <TableContext.Provider value={{ data, columns }}>
      {children ?? <TableContent />}
    </TableContext.Provider>
  );
}

Table.Content = TableContent;

/* ─── TableActionCell ─────────────────────────────────────────────── */
export interface TableAction {
  icon?: ReactNode;
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface TableActionCellProps {
  secondaryActions?: TableAction[];
  numOfVisibleSecondaryActions?: number;
  alwaysShowSecondaryActions?: boolean;
}

export const TableActionCell: FC<TableActionCellProps> = ({
  secondaryActions = [],
  numOfVisibleSecondaryActions = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const visibleActions = secondaryActions.slice(0, numOfVisibleSecondaryActions);
  const dropdownActions = secondaryActions.slice(numOfVisibleSecondaryActions);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
        return;
      }

      const dropdownHeight = dropdownActions.length * 36 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < dropdownHeight && rect.top > spaceBelow;

      setMenuStyle({
        position: 'fixed',
        right: `${Math.max(8, window.innerWidth - rect.right)}px`,
        top: openUpwards ? undefined : `${rect.bottom + 4}px`,
        bottom: openUpwards ? `${window.innerHeight - rect.top + 4}px` : undefined,
        zIndex: 9999,
      });
    };

    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, dropdownActions.length]);

  if (secondaryActions.length === 0) return null;

  return (
    <div className={styles.actionCell}>
      {visibleActions.map((action, idx) => (
        <button
          key={idx}
          type="button"
          className={styles.actionMenuBtn}
          onClick={action.onClick}
          title={action.text}
          disabled={action.disabled}
        >
          {action.icon}
        </button>
      ))}

      {dropdownActions.length > 0 && (
        <>
          <button
            ref={btnRef}
            type="button"
            className={styles.actionMenuBtn}
            onClick={() => setIsOpen((prev) => !prev)}
            title="More actions"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {isOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={dropdownRef}
                className={styles.actionDropdown}
                style={menuStyle}
              >
                {dropdownActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.actionItem}
                    onClick={() => {
                      setIsOpen(false);
                      action.onClick();
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon}
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
};


