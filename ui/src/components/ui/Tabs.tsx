import {
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  type TabGroupProps,
} from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type TabsItem = {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabsItem[];
  selectedIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
  listClassName?: string;
} & Omit<TabGroupProps, 'children' | 'className' | 'onChange'>;

export function Tabs({
  items,
  selectedIndex,
  onChange,
  className,
  listClassName,
  ...props
}: TabsProps) {
  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={onChange}
      className={cn('w-full', className)}
      {...props}
    >
      <TabList
        className={cn(
          'flex gap-1 p-1 rounded-lg bg-surface-muted border border-subtle dark:border-default',
          listClassName,
        )}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            disabled={item.disabled}
            className={({ selected }) =>
              cn(
                'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                selected
                  ? 'bg-surface text-primary shadow-app-sm'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover',
                item.disabled && 'opacity-40 cursor-not-allowed',
              )
            }
          >
            {item.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-4">
        {items.map((item) => (
          <TabPanel key={item.id} className="focus-visible:outline-none">
            {item.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
