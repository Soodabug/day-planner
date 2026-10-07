import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
        <input
            type={type}
            className={cn(
                'flex h-11 w-full min-w-0 rounded-md border-2 border-ink bg-paper px-3 text-base text-ink',
                'placeholder:text-quiet',
                'aria-invalid:border-alarm',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}
