/**
 * AccessibleListbox - A reusable, accessible listbox component
 *
 * Implements WAI-ARIA listbox pattern with:
 * - Keyboard navigation (Arrow keys, Home, End, Escape)
 * - Screen reader support via proper ARIA attributes
 * - Focus management with roving tabindex
 * - SolidJS best practices: context, signals, proper reactivity
 *
 * Usage:
 * <AccessibleListbox
 *   items={items()}
 *   activeId={selectedId()}
 *   onSelect={(item) => setSelectedId(item.id)}
 *   onEscape={() => inputRef?.focus()}
 *   label="My list"
 * >
 *   {(item, index, isActive) => <MyItemComponent item={item} active={isActive()} />}
 * </AccessibleListbox>
 */
import {
  createSignal,
  createContext,
  useContext,
  createEffect,
  onCleanup,
  For,
  JSX,
  Accessor,
  on,
} from 'solid-js';

// ============================================================================
// Types
// ============================================================================

export interface ListboxItem {
  id: string;
}

export interface AccessibleListboxProps<T extends ListboxItem> {
  /** Array of items to display */
  items: T[];
  /** ID of the currently selected/active item (for visual selection state) */
  activeId?: string | null;
  /** Called when an item is selected via click or Enter/Space */
  onSelect?: (item: T, index: number) => void;
  /** Called when Escape is pressed */
  onEscape?: () => void;
  /** Accessible label for the listbox */
  label: string;
  /** Unique ID prefix for this listbox instance */
  id?: string;
  /** Additional class for the container */
  class?: string;
  /** Whether to focus the last item initially (for message lists) */
  initialFocusLast?: boolean;
  /** Children render function: (item, index, isActive) => JSX */
  children: (item: T, index: Accessor<number>, isActive: Accessor<boolean>) => JSX.Element;
}

interface ListboxContextValue {
  focusedIndex: Accessor<number>;
  registerItem: (index: number, element: HTMLElement) => void;
  unregisterItem: (index: number) => void;
}

// ============================================================================
// Context
// ============================================================================

const ListboxContext = createContext<ListboxContextValue>();

export function useListboxContext() {
  const context = useContext(ListboxContext);
  if (!context) {
    throw new Error('useListboxContext must be used within AccessibleListbox');
  }
  return context;
}

// ============================================================================
// Component
// ============================================================================

export function AccessibleListbox<T extends ListboxItem>(props: AccessibleListboxProps<T>) {
  // Generate unique ID for this listbox instance
  const listboxId = props.id ?? `listbox-${Math.random().toString(36).slice(2, 9)}`;

  // State
  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [hasFocus, setHasFocus] = createSignal(false);

  // Refs storage using Map for proper cleanup
  const itemRefs = new Map<number, HTMLElement>();
  let containerRef: HTMLDivElement | undefined;

  // Register/unregister item refs
  const registerItem = (index: number, element: HTMLElement) => {
    itemRefs.set(index, element);
  };

  const unregisterItem = (index: number) => {
    itemRefs.delete(index);
  };

  // Focus an item by index
  const focusItem = (index: number) => {
    const element = itemRefs.get(index);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Get the index that should be tabbable (for roving tabindex)
  const getTabbableIndex = (): number => {
    const items = props.items;
    if (items.length === 0) return -1;

    // If currently focused, that item is tabbable
    const currentFocus = focusedIndex();
    if (currentFocus >= 0) return currentFocus;

    // If there's an active/selected item, that should be tabbable
    if (props.activeId) {
      const activeIndex = items.findIndex((item) => item.id === props.activeId);
      if (activeIndex >= 0) return activeIndex;
    }

    // Otherwise first (for contacts) or last (for messages) is tabbable
    return props.initialFocusLast ? items.length - 1 : 0;
  };

  // Handle when an item receives focus (via Tab or click)
  const handleItemFocus = (index: number) => {
    setHasFocus(true);
    setFocusedIndex(index);
  };

  // Handle blur - check if focus left the container entirely
  const handleContainerBlur = (e: FocusEvent) => {
    // Only reset if focus is leaving the container entirely
    if (!containerRef?.contains(e.relatedTarget as Node)) {
      setHasFocus(false);
      setFocusedIndex(-1);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = props.items;
    if (items.length === 0) return;

    const currentIndex = focusedIndex();
    let newIndex = currentIndex;
    let handled = true;

    switch (e.key) {
      case 'ArrowDown':
        if (currentIndex < items.length - 1) {
          newIndex = currentIndex + 1;
        } else if (currentIndex === -1) {
          newIndex = 0;
        }
        break;

      case 'ArrowUp':
        if (currentIndex > 0) {
          newIndex = currentIndex - 1;
        } else if (currentIndex === -1) {
          newIndex = items.length - 1;
        }
        break;

      case 'Home':
        newIndex = 0;
        break;

      case 'End':
        newIndex = items.length - 1;
        break;

      case 'Enter':
      case ' ':
        if (currentIndex >= 0 && currentIndex < items.length) {
          props.onSelect?.(items[currentIndex], currentIndex);
        }
        break;

      case 'Escape':
        setFocusedIndex(-1);
        setHasFocus(false);
        props.onEscape?.();
        if (!props.onEscape) {
          containerRef?.blur();
        }
        break;

      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      setFocusedIndex(newIndex);
      focusItem(newIndex);
    }
  };

  // Handle item click
  const handleItemClick = (item: T, index: number) => {
    setFocusedIndex(index);
    props.onSelect?.(item, index);
  };

  // Adjust focused index if items change
  createEffect(
    on(
      () => props.items.length,
      (newLength, prevLength) => {
        if (prevLength === undefined) return;

        const currentIndex = focusedIndex();
        if (hasFocus() && currentIndex >= newLength && newLength > 0) {
          setFocusedIndex(newLength - 1);
        }
      }
    )
  );

  // Context value
  const contextValue: ListboxContextValue = {
    focusedIndex,
    registerItem,
    unregisterItem,
  };

  return (
    <ListboxContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="listbox"
        tabIndex={-1}
        aria-label={props.label}
        aria-activedescendant={
          focusedIndex() >= 0 ? `${listboxId}-item-${focusedIndex()}` : undefined
        }
        class={`outline-none ${props.class ?? ''}`}
        onBlur={handleContainerBlur}
        onKeyDown={handleKeyDown}
      >
        <For each={props.items}>
          {(item, index) => {
            const isActive = () => focusedIndex() === index();
            const isSelected = () => props.activeId === item.id;
            // Roving tabindex: only the tabbable item has tabIndex 0
            const isTabbable = () => getTabbableIndex() === index();

            return (
              <ListboxItemWrapper
                id={`${listboxId}-item-${index()}`}
                index={index()}
                isActive={isActive}
                isSelected={isSelected}
                isTabbable={isTabbable}
                onClick={() => handleItemClick(item, index())}
                onFocus={() => handleItemFocus(index())}
                registerItem={registerItem}
                unregisterItem={unregisterItem}
              >
                {props.children(item, index, isActive)}
              </ListboxItemWrapper>
            );
          }}
        </For>
      </div>
    </ListboxContext.Provider>
  );
}

// ============================================================================
// ListboxItemWrapper - Internal wrapper for each item
// ============================================================================

interface ListboxItemWrapperProps {
  id: string;
  index: number;
  isActive: Accessor<boolean>;
  isSelected: Accessor<boolean>;
  isTabbable: Accessor<boolean>;
  onClick: () => void;
  onFocus: () => void;
  registerItem: (index: number, el: HTMLElement) => void;
  unregisterItem: (index: number) => void;
  children: JSX.Element;
}

function ListboxItemWrapper(props: ListboxItemWrapperProps) {
  let itemRef: HTMLDivElement | undefined;

  // Register ref on mount
  createEffect(() => {
    if (itemRef) {
      props.registerItem(props.index, itemRef);
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    props.unregisterItem(props.index);
  });

  return (
    <div
      ref={itemRef}
      id={props.id}
      role="option"
      aria-selected={props.isSelected()}
      tabIndex={props.isTabbable() ? 0 : -1}
      onClick={props.onClick}
      onKeyDown={() => {}} // Key events handled by parent listbox
      onFocus={props.onFocus}
      class="outline-none"
    >
      {props.children}
    </div>
  );
}

export default AccessibleListbox;
