import { useState } from 'react';
import type { AvatarConfig } from '../engine/types';
import { AvatarFace, BGS, HAIR_COLORS, PART_OPTIONS, type PartKey, SKINS, loadAvatar, randomAvatar, saveAvatar } from './avatar';

type Tab = { key: string; label: string; options: { label: string; patch: Partial<AvatarConfig> }[] };

const part = (key: PartKey) => PART_OPTIONS[key].map((o) => ({ label: o.label, patch: { [key]: o.id } as Partial<AvatarConfig> }));
const colors = (key: 'skin' | 'hairColor' | 'bg', list: string[]) => list.map((_, i) => ({ label: '', patch: { [key]: i } as Partial<AvatarConfig> }));

const TABS: Tab[] = [
  { key: 'skin', label: 'Gesicht', options: colors('skin', SKINS) },
  { key: 'eyes', label: 'Augen', options: part('eyes') },
  { key: 'mouth', label: 'Mund', options: part('mouth') },
  { key: 'hair', label: 'Frisur', options: part('hair') },
  { key: 'hairColor', label: 'Haarfarbe', options: colors('hairColor', HAIR_COLORS) },
  { key: 'beard', label: 'Bart', options: part('beard') },
  { key: 'hat', label: 'Hut', options: part('hat') },
  { key: 'glasses', label: 'Brille', options: part('glasses') },
  { key: 'extra', label: 'Extras', options: part('extra') },
  { key: 'bg', label: 'Hintergrund', options: colors('bg', BGS) },
];

const isActive = (a: AvatarConfig, patch: Partial<AvatarConfig>) =>
  (Object.keys(patch) as (keyof AvatarConfig)[]).every((k) => a[k] === patch[k]);

export function AvatarEditor({ onDone }: { onDone: () => void }) {
  const [avatar, setAvatar] = useState(loadAvatar);
  const [tab, setTab] = useState(0);
  const current = TABS[tab];

  const update = (next: AvatarConfig) => {
    setAvatar(next);
    saveAvatar(next);
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <div className="editor-preview">
          <AvatarFace config={avatar} />
        </div>
        <div className="editor-actions">
          <h1>Mein Charakter</h1>
          <button className="ghost" onClick={() => update(randomAvatar())}>
            🎲 Zufall
          </button>
          <button onClick={onDone}>✓ Fertig</button>
        </div>
      </div>

      <div className="editor-tabs">
        {TABS.map((t, i) => (
          <button key={t.key} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="editor-grid">
        {current.options.map((o, i) => {
          const preview = { ...avatar, ...o.patch };
          return (
            <button key={i} className={`option ${isActive(avatar, o.patch) ? 'on' : ''}`} onClick={() => update(preview)}>
              <span className="option-face">
                <AvatarFace config={preview} />
              </span>
              {o.label && <span className="option-label">{o.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
