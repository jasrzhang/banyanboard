interface ColorSwatch {
  name: string;
  hex: string;
}

const PALETTE: ColorSwatch[] = [
  { name: 'rose',    hex: '#be123c' },
  { name: 'emerald', hex: '#047857' },
  { name: 'sky',     hex: '#0369a1' },
  { name: 'violet',  hex: '#6d28d9' },
  { name: 'pink',    hex: '#9d174d' },
  { name: 'fuchsia', hex: '#86198f' },
  { name: 'indigo',  hex: '#3730a3' },
  { name: 'teal',    hex: '#0f766e' },
  { name: 'amber',   hex: '#92400e' },
  { name: 'orange',  hex: '#c2410c' },
  { name: 'brown',   hex: '#78350f' },
  { name: 'slate',   hex: '#334155' },
];

interface ColorSwatchGridProps {
  selectedHex: string | null;
  onSelect: (hex: string) => void;
}

export function ColorSwatchGrid({ selectedHex, onSelect }: ColorSwatchGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Color palette">
      {PALETTE.map((swatch) => {
        const isSelected = swatch.hex === selectedHex;
        return (
          <button
            key={swatch.hex}
            type="button"
            aria-label={swatch.name}
            aria-pressed={isSelected}
            onClick={() => onSelect(swatch.hex)}
            className="w-6 h-6 rounded-full flex items-center justify-center
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                       transition-transform duration-100 hover:scale-110"
            style={{ backgroundColor: swatch.hex }}
          >
            {isSelected && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
