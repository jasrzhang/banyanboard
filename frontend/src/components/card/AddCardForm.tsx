import { useState, useRef } from 'react';

interface AddCardFormProps {
  columnId: string;
  onAdd: (columnId: string, title: string) => Promise<void>;
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function AddCardForm({ columnId, onAdd }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpen = () => {
    setIsOpen(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAdd(columnId, title.trim());
      setTitle('');
      setIsOpen(false);
    } catch {
      // Error handled by the caller (mutation's onError shows toast); form stays open for retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
    if (e.key === 'Escape') {
      setIsOpen(false);
      setTitle('');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setTitle('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-md
                   text-sm text-text-secondary hover:text-text-primary hover:bg-nav-hover
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                   transition-colors duration-100"
        aria-label="Add a card"
      >
        <PlusIcon />
        Add a card
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface-card rounded-lg border border-border shadow-sm">
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Card title"
        rows={3}
        className="w-full resize-none rounded-md border border-border p-2 text-sm text-text-primary
                   bg-surface-card placeholder:text-text-disabled
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        aria-label="New card title"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || isSubmitting}
          className="bg-primary hover:bg-primary-hover text-primary-foreground
                     text-sm font-medium px-3 py-1.5 rounded-md
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-colors duration-100"
        >
          Add Card
        </button>
        <button
          onClick={handleCancel}
          className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md
                     hover:bg-nav-hover
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-colors duration-100"
          aria-label="Cancel add card"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
