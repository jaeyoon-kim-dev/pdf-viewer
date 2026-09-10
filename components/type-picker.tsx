'use client';
import { createId } from '@/lib/id';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLibrary } from '@/lib/store';
export function AddType({ onCreated }: { onCreated?: (id: string) => void }) {
  const { data, save } = useLibrary();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0d9488');
  const [error, setError] = useState('');
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        New collection type
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>New collection type</DialogTitle>
          <DialogDescription>
            Collect ideas, limitations, methods, or anything else. Every item
            keeps its source.
          </DialogDescription>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = name.trim();
              if (
                !clean ||
                data.types.some(
                  (t) => t.name.toLowerCase() === clean.toLowerCase(),
                )
              ) {
                setError('Choose a unique name.');
                return;
              }
              try {
                const id = createId();
                await save('types', { id, name: clean, color, revision: 0 });
                setOpen(false);
                setName('');
                onCreated?.(id);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <label>
              Name
              <input
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ideas or Limitations"
              />
            </label>
            <label className="button-row">
              Color
              <input
                aria-label="Collection color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary-button" type="submit">
              Create collection
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default function TypePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { data } = useLibrary();
  return (
    <div className="stack">
      <div className="field-label">Collect as</div>
      <div className="type-options">
        {data.types.map((type) => (
          <label className="type-option" key={type.id}>
            <Checkbox
              checked={value.includes(type.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, type.id]
                    : value.filter((t) => t !== type.id),
                )
              }
            />
            <span className="type-dot" style={{ background: type.color }} />
            {type.name}
          </label>
        ))}
      </div>
      <AddType onCreated={(id) => onChange([...value, id])} />
    </div>
  );
}
