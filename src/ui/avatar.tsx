import type { ReactNode } from 'react';
import type { AvatarConfig } from '../engine/types';

// ---------------------------------------------------------------- Auswahl

export const SKINS = ['#ffd43b', '#ffe0bd', '#f1c27d', '#d9a066', '#a8703f', '#6b4226', '#8bd36b', '#b38be0'];
export const HAIR_COLORS = ['#2b2b2b', '#6b3e1e', '#e8c35a', '#c0502b', '#9e9e9e', '#f2f2f2', '#3d7bd9', '#e86aa8', '#3fb56a'];
export const BGS = ['#4f9c62', '#3d7bd9', '#e86a5a', '#f2a93b', '#8e6ad8', '#2bb3b1', '#e86aa8', '#5a5a6e'];

export type PartKey = 'eyes' | 'mouth' | 'hair' | 'beard' | 'glasses' | 'hat' | 'extra';

export const PART_OPTIONS: Record<PartKey, { id: string; label: string }[]> = {
  eyes: [
    { id: 'dots', label: 'Normal' },
    { id: 'happy', label: 'Fröhlich' },
    { id: 'wink', label: 'Zwinkern' },
    { id: 'big', label: 'Große Augen' },
    { id: 'sleepy', label: 'Müde' },
    { id: 'angry', label: 'Grimmig' },
    { id: 'hearts', label: 'Verliebt' },
    { id: 'stars', label: 'Sterne' },
  ],
  mouth: [
    { id: 'smile', label: 'Lächeln' },
    { id: 'grin', label: 'Grinsen' },
    { id: 'laugh', label: 'Lachen' },
    { id: 'tongue', label: 'Zunge' },
    { id: 'smirk', label: 'Schmunzeln' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'o', label: 'Staunen' },
    { id: 'sad', label: 'Traurig' },
  ],
  hair: [
    { id: 'none', label: 'Glatze' },
    { id: 'short', label: 'Kurz' },
    { id: 'side', label: 'Seitenscheitel' },
    { id: 'spiky', label: 'Stachelig' },
    { id: 'mohawk', label: 'Irokese' },
    { id: 'curly', label: 'Locken' },
    { id: 'long', label: 'Lang' },
    { id: 'bob', label: 'Bob' },
    { id: 'ponytail', label: 'Zopf' },
    { id: 'bun', label: 'Dutt' },
  ],
  beard: [
    { id: 'none', label: 'Ohne' },
    { id: 'stubble', label: 'Stoppeln' },
    { id: 'mustache', label: 'Schnurrbart' },
    { id: 'handlebar', label: 'Zwirbelbart' },
    { id: 'goatee', label: 'Kinnbart' },
    { id: 'full', label: 'Vollbart' },
    { id: 'long', label: 'Rauschebart' },
  ],
  glasses: [
    { id: 'none', label: 'Ohne' },
    { id: 'round', label: 'Rund' },
    { id: 'nerd', label: 'Eckig' },
    { id: 'sun', label: 'Sonnenbrille' },
    { id: 'heart', label: 'Herzbrille' },
    { id: 'monocle', label: 'Monokel' },
  ],
  hat: [
    { id: 'none', label: 'Ohne' },
    { id: 'cap', label: 'Cap' },
    { id: 'beanie', label: 'Mütze' },
    { id: 'tophat', label: 'Zylinder' },
    { id: 'cowboy', label: 'Cowboyhut' },
    { id: 'crown', label: 'Krone' },
    { id: 'party', label: 'Partyhut' },
    { id: 'wizard', label: 'Zauberhut' },
    { id: 'bandana', label: 'Piratentuch' },
    { id: 'headphones', label: 'Kopfhörer' },
  ],
  extra: [
    { id: 'none', label: 'Ohne' },
    { id: 'blush', label: 'Rote Bäckchen' },
    { id: 'freckles', label: 'Sommersprossen' },
  ],
};

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 0,
  eyes: 'dots',
  mouth: 'smile',
  hair: 'none',
  hairColor: 1,
  beard: 'none',
  glasses: 'none',
  hat: 'none',
  extra: 'none',
  bg: 0,
};

/** Feste Charaktere für die Computer-Gegner. */
export const BOT_AVATARS: AvatarConfig[] = [
  DEFAULT_AVATAR,
  { skin: 1, eyes: 'happy', mouth: 'smile', hair: 'long', hairColor: 2, beard: 'none', glasses: 'none', hat: 'none', extra: 'blush', bg: 6 },
  { skin: 2, eyes: 'dots', mouth: 'grin', hair: 'short', hairColor: 1, beard: 'full', glasses: 'none', hat: 'cap', extra: 'none', bg: 1 },
  { skin: 4, eyes: 'dots', mouth: 'smirk', hair: 'curly', hairColor: 0, beard: 'stubble', glasses: 'round', hat: 'none', extra: 'none', bg: 3 },
];

export function randomAvatar(): AvatarConfig {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const part = (k: PartKey, noneWeight = 0) =>
    Math.random() < noneWeight ? 'none' : pick(PART_OPTIONS[k]).id;
  return {
    skin: Math.floor(Math.random() * SKINS.length),
    eyes: part('eyes'),
    mouth: part('mouth'),
    hair: part('hair'),
    hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
    beard: part('beard', 0.5),
    glasses: part('glasses', 0.5),
    hat: part('hat', 0.4),
    extra: part('extra', 0.4),
    bg: Math.floor(Math.random() * BGS.length),
  };
}

const AVATAR_KEY = 'canasta.avatar.v1';

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    return raw ? { ...DEFAULT_AVATAR, ...JSON.parse(raw) } : DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function saveAvatar(a: AvatarConfig) {
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(a));
  } catch {
    // Speicher gesperrt – Avatar gilt dann nur für diese Sitzung.
  }
}

// ---------------------------------------------------------------- Zeichnen

const INK = '#2b2b2b';

function eyes(id: string): ReactNode {
  const dot = (x: number) => <circle cx={x} cy={54} r={3.4} fill={INK} />;
  const arc = (x: number) => <path d={`M${x - 4.5},56 Q${x},49 ${x + 4.5},56`} stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round" />;
  switch (id) {
    case 'happy':
      return [arc(40), arc(60)];
    case 'wink':
      return [dot(40), arc(60)];
    case 'big':
      return [40, 60].map((x) => (
        <g key={x}>
          <circle cx={x} cy={53} r={6.5} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <circle cx={x + 1} cy={54} r={3.4} fill={INK} />
          <circle cx={x + 2.2} cy={52.6} r={1.1} fill="#fff" />
        </g>
      ));
    case 'sleepy':
      return [40, 60].map((x) => (
        <path key={x} d={`M${x - 5},54 Q${x},58 ${x + 5},54`} stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      ));
    case 'angry':
      return (
        <>
          {dot(40)}
          {dot(60)}
          <path d="M34,46 L45,49 M66,46 L55,49" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
        </>
      );
    case 'hearts':
      return [40, 60].map((x) => (
        <path
          key={x}
          d={`M${x},58 C${x - 9},51 ${x - 4},45 ${x},50 C${x + 4},45 ${x + 9},51 ${x},58 Z`}
          fill="#e53950"
        />
      ));
    case 'stars':
      return [40, 60].map((x) => (
        <polygon
          key={x}
          points={star(x, 54, 6.5, 2.8)}
          fill="#ffb400"
          stroke="#c77d00"
          strokeWidth={0.8}
        />
      ));
    default:
      return [dot(40), dot(60)];
  }
}

function star(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function mouth(id: string): ReactNode {
  const stroke = { stroke: INK, strokeWidth: 2.8, fill: 'none', strokeLinecap: 'round' as const };
  switch (id) {
    case 'grin':
      return (
        <>
          <path d="M38,66 Q50,82 62,66 Z" fill={INK} />
          <path d="M40,67 L60,67 L58.5,70 L41.5,70 Z" fill="#fff" />
        </>
      );
    case 'laugh':
      return (
        <>
          <path d="M37,65 Q50,86 63,65 Z" fill={INK} />
          <path d="M43,75 Q50,70 57,75 Q50,82 43,75 Z" fill="#e35d6a" />
        </>
      );
    case 'tongue':
      return (
        <>
          <path d="M53,70 Q53,80 58,79 Q62,78 60,69 Z" fill="#e35d6a" stroke={INK} strokeWidth={1.2} />
          <path d="M40,68 Q50,76 61,67" {...stroke} />
        </>
      );
    case 'smirk':
      return <path d="M42,71 Q53,74 60,66" {...stroke} />;
    case 'neutral':
      return <path d="M42,70 L58,70" {...stroke} />;
    case 'o':
      return <ellipse cx={50} cy={71} rx={4.5} ry={5.5} fill={INK} />;
    case 'sad':
      return <path d="M41,74 Q50,65 59,74" {...stroke} />;
    default:
      return <path d="M40,67 Q50,77 60,67" {...stroke} />;
  }
}

/** Haare hinter dem Kopf (lange Frisuren). */
function hairBack(id: string, c: string): ReactNode {
  switch (id) {
    case 'long':
      return <path d="M21,52 C20,26 36,22 50,22 C64,22 80,26 79,52 L82,90 C70,95 30,95 18,90 Z" fill={c} />;
    case 'bob':
      return <path d="M20,56 C19,28 34,23 50,23 C66,23 81,28 80,56 L81,76 C75,79 70,75 70,68 L30,68 C30,75 25,79 19,76 Z" fill={c} />;
    case 'curly':
      return (
        <g fill={c}>
          {[
            [26, 44],
            [32, 32],
            [43, 25],
            [57, 25],
            [68, 32],
            [74, 44],
            [22, 56],
            [78, 56],
            [24, 67],
            [76, 67],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={11} />
          ))}
        </g>
      );
    case 'ponytail':
      return <ellipse cx={80} cy={52} rx={8} ry={17} transform="rotate(18 80 52)" fill={c} />;
    case 'bun':
      return <circle cx={50} cy={24} r={10} fill={c} />;
    default:
      return null;
  }
}

/** Haare vor dem Kopf (Pony, Scheitel, Stacheln). */
function hairFront(id: string, c: string): ReactNode {
  switch (id) {
    case 'short':
    case 'ponytail':
    case 'bun':
      return <path d="M23,56 C22,32 36,28 50,28 C64,28 78,32 77,56 C74,44 66,40 50,40 C34,40 26,44 23,56 Z" fill={c} />;
    case 'side':
      return <path d="M23,55 C22,31 40,26 56,28 C70,30 78,38 77,55 C72,42 62,36 46,38 C36,40 28,46 23,55 Z" fill={c} />;
    case 'spiky':
      return <path d="M24,53 L25,35 L32,41 L35,26 L42,36 L50,21 L58,36 L65,26 L68,41 L75,35 L76,53 C70,43 60,39 50,39 C40,39 30,43 24,53 Z" fill={c} />;
    case 'mohawk':
      return <path d="M44,40 L43,16 C46,11 54,11 57,16 L56,40 C52,38 48,38 44,40 Z" fill={c} />;
    case 'long':
      return <path d="M24,54 C24,34 36,29 50,29 C64,29 76,34 76,54 C70,42 62,37 52,40 C46,36 34,40 24,54 Z" fill={c} />;
    case 'bob':
      return <path d="M25,48 C27,33 39,29 50,29 C61,29 73,33 75,48 C66,43 34,43 25,48 Z" fill={c} />;
    case 'curly':
      return (
        <g fill={c}>
          {[34, 42, 50, 58, 66].map((x, i) => (
            <circle key={x} cx={x} cy={i % 2 ? 34 : 37} r={6.5} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function beard(id: string, c: string): ReactNode {
  switch (id) {
    case 'stubble':
      return <path d="M27,62 C29,85 71,85 73,62 C66,77 34,77 27,62 Z" fill={c} opacity={0.35} />;
    case 'mustache':
      return <path d="M37,66 C41,60 48,62 50,64 C52,62 59,60 63,66 C57,65 53,67 50,66 C47,67 43,65 37,66 Z" fill={c} />;
    case 'handlebar':
      return <path d="M32,60 C33,67 43,61 50,64 C57,61 67,67 68,60 C69,68 58,69 50,67 C42,69 31,68 32,60 Z" fill={c} />;
    case 'goatee':
      return <path d="M43,76 C43,88 57,88 57,76 C54,78 46,78 43,76 Z" fill={c} />;
    case 'full':
      return <path d="M23,56 C22,92 78,92 77,56 C73,66 67,68 62,66 C58,76 42,76 38,66 C33,68 27,66 23,56 Z" fill={c} />;
    case 'long':
      return <path d="M25,58 C24,98 42,104 50,104 C58,104 76,98 75,58 C71,68 65,70 60,67 C56,76 44,76 40,67 C35,70 29,68 25,58 Z" fill={c} />;
    default:
      return null;
  }
}

function glasses(id: string): ReactNode {
  switch (id) {
    case 'round':
      return (
        <g stroke={INK} strokeWidth={2} fill="rgba(255,255,255,0.25)">
          <circle cx={40} cy={54} r={7.5} />
          <circle cx={60} cy={54} r={7.5} />
          <path d="M47.5,54 L52.5,54" fill="none" />
        </g>
      );
    case 'nerd':
      return (
        <g stroke={INK} strokeWidth={3} fill="rgba(255,255,255,0.25)">
          <rect x={31} y={48} width={17} height={12} rx={2} />
          <rect x={52} y={48} width={17} height={12} rx={2} />
          <path d="M48,53 L52,53" fill="none" />
        </g>
      );
    case 'sun':
      return (
        <g fill="#141414">
          <path d="M30,48 L48,48 L46,60 C44,63 34,63 32,60 Z" />
          <path d="M52,48 L70,48 L68,60 C66,63 56,63 54,60 Z" />
          <rect x={46} y={48} width={8} height={2.5} />
          <path d="M34,51 L38,51" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        </g>
      );
    case 'heart':
      return (
        <g fill="#ff5d8f" stroke="#b5174a" strokeWidth={1.2} opacity={0.92}>
          {[40, 60].map((x) => (
            <path key={x} d={`M${x},61 C${x - 12},52 ${x - 6},43 ${x},49 C${x + 6},43 ${x + 12},52 ${x},61 Z`} />
          ))}
          <path d="M47,51 L53,51" fill="none" />
        </g>
      );
    case 'monocle':
      return (
        <g stroke="#c8922a" strokeWidth={2} fill="rgba(255,255,255,0.3)">
          <circle cx={60} cy={54} r={8} />
          <path d="M66,59 Q72,72 66,84" fill="none" strokeWidth={1.2} />
        </g>
      );
    default:
      return null;
  }
}

function hat(id: string): ReactNode {
  switch (id) {
    case 'cap':
      return (
        <g>
          <path d="M24,44 C23,20 77,20 76,44 Z" fill="#d93a3a" />
          <path d="M48,41 C62,40 82,40 90,45 C82,48 62,47 48,46 Z" fill="#b02626" />
          <circle cx={50} cy={22} r={2.5} fill="#b02626" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M22,46 C21,16 79,16 78,46 Z" fill="#2f8ad1" />
          <rect x={20} y={38} width={60} height={10} rx={4} fill="#1f6aa5" />
          <circle cx={50} cy={14} r={7} fill="#f2f2f2" />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <rect x={31} y={4} width={38} height={34} rx={2} fill="#1d1d1d" />
          <rect x={31} y={28} width={38} height={6} fill="#c62828" />
          <ellipse cx={50} cy={38} rx={30} ry={5} fill="#1d1d1d" />
        </g>
      );
    case 'cowboy':
      return (
        <g fill="#8a5530">
          <ellipse cx={50} cy={38} rx={42} ry={8} />
          <path d="M30,38 C28,16 40,12 50,18 C60,12 72,16 70,38 Z" />
          <rect x={30} y={30} width={40} height={4} fill="#5e3519" />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M27,40 L29,16 L39,28 L50,11 L61,28 L71,16 L73,40 Z" fill="#f4c430" stroke="#c8922a" strokeWidth={1.5} />
          <circle cx={50} cy={32} r={3} fill="#d32f2f" />
          <circle cx={38} cy={34} r={2.2} fill="#2f8ad1" />
          <circle cx={62} cy={34} r={2.2} fill="#3fb56a" />
        </g>
      );
    case 'party':
      return (
        <g>
          <path d="M35,40 L50,4 L65,40 Z" fill="#8e6ad8" />
          <path d="M39,31 L61,31 L58,24 L42,24 Z" fill="#f4c430" />
          <path d="M45,16 L55,16 L52.5,10 L47.5,10 Z" fill="#f4c430" />
          <circle cx={50} cy={4} r={4} fill="#e86aa8" />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <ellipse cx={50} cy={38} rx={34} ry={6} fill="#3b2a8c" />
          <path d="M30,38 L56,0 L70,38 Z" fill="#4a35a8" />
          <polygon points={star(52, 24, 5, 2.2)} fill="#f4c430" />
        </g>
      );
    case 'bandana':
      return (
        <g>
          <path d="M22,45 C22,22 78,22 78,45 C64,40 36,40 22,45 Z" fill="#d32f2f" />
          <path d="M76,42 L88,36 L86,48 Z" fill="#b02626" />
          {[
            [36, 34],
            [50, 30],
            [64, 34],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={2.2} fill="#fff" />
          ))}
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M20,56 C18,18 82,18 80,56" stroke="#333" strokeWidth={5} fill="none" />
          <rect x={14} y={48} width={12} height={20} rx={5} fill="#e53950" />
          <rect x={74} y={48} width={12} height={20} rx={5} fill="#e53950" />
        </g>
      );
    default:
      return null;
  }
}

function extra(id: string): ReactNode {
  switch (id) {
    case 'blush':
      return (
        <g fill="#ff7b9c" opacity={0.55}>
          <ellipse cx={32} cy={64} rx={5.5} ry={3.5} />
          <ellipse cx={68} cy={64} rx={5.5} ry={3.5} />
        </g>
      );
    case 'freckles':
      return (
        <g fill="#a0522d" opacity={0.7}>
          {[
            [31, 62],
            [35, 65],
            [29, 66],
            [69, 62],
            [65, 65],
            [71, 66],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

/** Zeichnet einen Charakter als SVG; füllt seinen Container (rund zuschneiden per CSS). */
export function AvatarFace({ config, className }: { config?: AvatarConfig; className?: string }) {
  const a = { ...DEFAULT_AVATAR, ...config };
  const skin = SKINS[a.skin] ?? SKINS[0];
  const hairC = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const shade = 'rgba(0,0,0,0.12)';
  return (
    <svg className={`avatar-svg ${className ?? ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <rect width={100} height={100} fill={BGS[a.bg] ?? BGS[0]} />
      {hairBack(a.hair, hairC)}
      <circle cx={23} cy={58} r={5.5} fill={skin} stroke={shade} strokeWidth={1} />
      <circle cx={77} cy={58} r={5.5} fill={skin} stroke={shade} strokeWidth={1} />
      <circle cx={50} cy={58} r={27} fill={skin} stroke={shade} strokeWidth={1.5} />
      {extra(a.extra)}
      {beard(a.beard, hairC)}
      {mouth(a.mouth)}
      {eyes(a.eyes)}
      {glasses(a.glasses)}
      {hairFront(a.hair, hairC)}
      {hat(a.hat)}
    </svg>
  );
}
