import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                // Solid black block that presses down when clicked.
                default: 'bg-ink text-paper hover:-translate-y-0.5 active:translate-y-0.5',
                sun: 'border-2 border-ink bg-sun text-ink shadow-block-sm hover:-translate-y-0.5 hover:shadow-block active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                outline: 'border-2 border-ink bg-paper text-ink hover:bg-ink hover:text-paper',
                ghost: 'text-ink hover:bg-ink/10',
                link: 'h-auto px-0 text-ink underline decoration-2 underline-offset-4 hover:decoration-sun-deep',
            },
            size: {
                default: 'h-11 px-5',
                sm: 'h-9 px-3',
                lg: 'h-13 px-6 text-base',
                icon: 'size-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}
