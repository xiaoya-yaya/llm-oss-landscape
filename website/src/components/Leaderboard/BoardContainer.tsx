import { getStaticImageUrl } from '@site/src/utils/useData';
import styles from './styles.module.css';

export const BoardContainer = ({ children, title }): JSX.Element => {
  return (
    <div className={styles.boardContainer}>
      <div className={styles.boardTitle}>
        <img src={getStaticImageUrl('leaderboard/earth-animation.gif')} alt="" className={styles.boardTitleIcon} />
        <span className={styles.boardTitleText}>{title}</span>
      </div>
      {children}
    </div>
  );
}
