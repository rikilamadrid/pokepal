interface PokeballProps {
  className?: string;
}

/** Glossy Pokéball glyph used in the wordmark and the Scan tab puck. */
export function Pokeball({ className }: PokeballProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Pokéball"
    >
      <defs>
        <radialGradient id="pb-gloss" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#111318" strokeWidth="5" />
      <path
        d="M3 50a47 47 0 0 1 94 0Z"
        fill="#ff4655"
        stroke="#111318"
        strokeWidth="5"
      />
      <line x1="4" y1="50" x2="96" y2="50" stroke="#111318" strokeWidth="5" />
      <circle cx="50" cy="50" r="14" fill="#ffffff" stroke="#111318" strokeWidth="5" />
      <circle cx="50" cy="50" r="6" fill="#ffffff" stroke="#111318" strokeWidth="3" />
      <circle cx="50" cy="50" r="49" fill="url(#pb-gloss)" />
    </svg>
  );
}
