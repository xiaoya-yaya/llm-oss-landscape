import styles from './styles.module.css';
import { getStaticImageUrl } from '@site/src/utils/useData';

const formatNumber = (num: number) => {
  return +num.toFixed(2);
}

export const NumberWithDelta = ({ number, delta }): JSX.Element => {
  if (delta === 0 || delta === undefined || delta === null) {
    return (
      <div className={styles.numberContainer}>
        <span className={styles.number}>{formatNumber(number)}</span>
      </div>
    );
  }
  if (delta === '-') {
    return (
      <div className={styles.numberContainer}>
        <span className={styles.number}>{formatNumber(number)}</span>
        <img className={styles.tag} src={getStaticImageUrl('leaderboard/new.svg')}  alt='new' />
      </div>
    );
  }
  return (
    <div className={styles.numberContainer}>
      <span>{formatNumber(number)}</span>
      <img className={styles.tag} src={delta > 0 ? getStaticImageUrl('leaderboard/increase.svg') : getStaticImageUrl('leaderboard/decrease.svg')} alt='increase/decrease' />
      <span>{formatNumber(Math.abs(delta))}</span>
    </div>
  );
}
