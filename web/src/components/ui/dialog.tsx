import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './button';

type Props = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
};

// Built on the native <dialog>: focus stays inside, Escape closes it.
export function Dialog({ open, onClose, title, description, children }: Props) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            onClose={onClose}
            onClick={(event) => {
                // A click on the dialog element itself is a click on the backdrop.
                if (event.target === ref.current) onClose();
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-visible bg-transparent p-0"
        >
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    className="rounded-lg border-2 border-ink bg-paper p-6 text-ink shadow-block"
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight">
                                {title}
                            </h2>
                            {description && (
                                <p className="mt-1 text-sm text-quiet">{description}</p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="-mt-1 -mr-2"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X aria-hidden="true" />
                        </Button>
                    </div>
                    {children}
                </motion.div>
            )}
        </dialog>
    );
}
