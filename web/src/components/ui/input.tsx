import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
        <input
            type={type}
            className={cn(
                'flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base outline-none transition-colors sm:text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}
