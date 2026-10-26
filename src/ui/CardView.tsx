import { isRed, JOKER, rankLabel, SUIT_SYMBOL } from '../engine/cards';
import type { Card } from '../engine/types';

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CardView({ card, faceDown, selected, small, onClick, className = '', style }: Props) {
  const classes = ['card', small ? 'small' : '', selected ? 'selected' : '', onClick ? 'clickable' : '', className];
  if (faceDown || !card) {
    return <div className={[...classes, 'back'].join(' ')} style={style} onClick={onClick} />;
  }
  if (card.rank === JOKER) {
    return (
      <div className={[...classes, 'joker'].join(' ')} style={style} onClick={onClick}>
        <span className="corner">
          ★
          <br />J
        </span>
        <span className="pip">🃏</span>
      </div>
    );
  }
  const suit = SUIT_SYMBOL[card.suit!];
  return (
    <div className={[...classes, isRed(card) ? 'red' : 'black'].join(' ')} style={style} onClick={onClick}>
      <span className="corner">
        {rankLabel(card.rank)}
        <br />
        {suit}
      </span>
      <span className="pip">{suit}</span>
    </div>
  );
}
