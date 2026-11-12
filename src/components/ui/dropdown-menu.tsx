import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="z-50 min-w-52 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-md data-[state=open]:animate-fade-in"
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  icon: Icon,
  children,
  onSelect,
  tone = 'default',
  disabled,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-muted data-[disabled]:opacity-50',
        tone === 'danger' ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-foreground',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />;
}
