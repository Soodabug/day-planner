import type { ComponentProps } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

// Error message box. role="alert" makes screen readers announce it when it appears.
export function ErrorAlert({ className, children, ...props }: ComponentProps<'div'>) {
    return (
        <div
            role="alert"
            className={cn(
                'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive',
                className,
            )}
            {...props}
        >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                {children}
            </div>
        </div>
    );
}
