'use client';

interface EnvVar {
  key: string;
  value: string;
}

interface Props {
  value: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
  suggestedKeys?: string[];
}

export default function EnvVarEditor({ value, onChange, suggestedKeys = [] }: Props) {
  function add() {
    onChange([...value, { key: '', value: '' }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function update(index: number, field: 'key' | 'value', newVal: string) {
    onChange(value.map((v, i) => (i === index ? { ...v, [field]: newVal } : v)));
  }

  return (
    <div className="space-y-2">
      {value.map((envVar, i) => (
        <div key={i} className="flex gap-2">
          <input
            list="suggested-keys"
            type="text"
            placeholder="KEY"
            value={envVar.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            className="w-2/5 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <datalist id="suggested-keys">
            {suggestedKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <input
            type="text"
            placeholder="value"
            value={envVar.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-md px-2 text-gray-400 hover:text-red-500"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        + Add variable
      </button>
    </div>
  );
}
