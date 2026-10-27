import React, {
  useState,
  useRef,
  useEffect,
  type FC,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import styles from './MultiSelect.module.css';

export interface MultiSelectOption {
  id: string | number;
  value: string;
}

export interface MultiSelectTag {
  id: string | number;
  label: string;
}

export interface MultiSelectProps {
  options?: MultiSelectOption[];
  tags?: MultiSelectTag[];
  onSelect?: (option: MultiSelectOption) => void;
  onRemoveTag?: (id: string | number) => void;
  onManuallyInput?: (value: string | string[]) => void;
  onSearchChange?: (query: string) => void;
  remoteSearch?: boolean;
  loading?: boolean;
  /** Called when the user scrolls to the end of the options list. */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  delimiters?: string[];
  acceptOnBlur?: boolean;
  clearOnBlur?: boolean;
  placeholder?: string;
  emptyStateMessage?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const MultiSelect: FC<MultiSelectProps> = ({
  options = [],
  tags = [],
  onSelect,
  onRemoveTag,
  onManuallyInput,
  onSearchChange,
  remoteSearch = false,
  loading = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  delimiters = [',', ';'],
  acceptOnBlur = true,
  placeholder = 'Type or select...',
  emptyStateMessage = 'No options found.',
  disabled = false,
  className,
  style,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canLoadMore = isOpen && !loading && hasMore && Boolean(onLoadMore);

  // Observe a sentinel at the end of the list so the next page loads on scroll,
  // and also when the first page is too short to fill the dropdown.
  useEffect(() => {
    if (!canLoadMore || loadingMore) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current?.();
        }
      },
      { root: dropdownRef.current, rootMargin: '0px 0px 40px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadingMore, options.length]);

  const filteredOptions = options.filter(
    (opt) =>
      (remoteSearch || opt.value.toLowerCase().includes(query.toLowerCase())) &&
      !tags.some((tag) => String(tag.id) === String(opt.id)),
  );

  const handleCommitManual = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (onManuallyInput) {
      onManuallyInput(trimmed);
    }
    setQuery('');
    onSearchChange?.('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (options.length > 0 && filteredOptions.length > 0) {
        onSelect?.(filteredOptions[0]);
        setQuery('');
      } else {
        handleCommitManual(query);
      }
    } else if (delimiters.includes(e.key)) {
      e.preventDefault();
      handleCommitManual(query);
    } else if (e.key === 'Backspace' && query === '' && tags.length > 0) {
      const lastTag = tags[tags.length - 1];
      onRemoveTag?.(lastTag.id);
    }
  };

  const handleBlur = () => {
    if (acceptOnBlur && onManuallyInput && query.trim()) {
      handleCommitManual(query);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.container}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <div
        className={`${styles.box}${disabled ? ` ${styles.disabled}` : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag.id} className={styles.tag}>
            <span className={styles.tagLabel}>{tag.label}</span>
            {!disabled && (
              <button
                type="button"
                className={styles.tagRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTag?.(tag.id);
                }}
                aria-label="Remove tag"
              >
                ✕
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            onSearchChange?.(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className={styles.input}
        />
      </div>

      {isOpen && (
        <div ref={dropdownRef} className={styles.dropdown}>
          {loading ? (
            <div className={styles.emptyState}>Searching products...</div>
          ) : filteredOptions.length > 0 ? (
            <>
              {filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={styles.option}
                  onClick={() => {
                    onSelect?.(opt);
                    setQuery('');
                    onSearchChange?.('');
                    setIsOpen(false);
                  }}
                >
                  {opt.value}
                </button>
              ))}
              {canLoadMore || loadingMore ? (
                <div ref={loadMoreRef} className={styles.emptyState}>
                  {loadingMore ? 'Loading more...' : ''}
                </div>
              ) : null}
            </>
          ) : canLoadMore || loadingMore ? (
            <div ref={loadMoreRef} className={styles.emptyState}>
              Loading more...
            </div>
          ) : (
            <div className={styles.emptyState}>{emptyStateMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};
