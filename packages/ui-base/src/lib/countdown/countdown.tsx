import { useEffect, useState } from 'react';
interface CountdownProps {
  targetDate: Date;
  onComplete: () => void;
}

const calculateTimeLeft = (targetDate: Date) => {
  const difference = +new Date(targetDate) - +new Date();
  let timeLeft = { minutes: 0, seconds: 0 };

  if (difference > 0) {
    timeLeft = {
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  return timeLeft;
};

export const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  onComplete,
}) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetDate));
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (timeLeft.minutes === 0 && timeLeft.seconds === 0) {
      if (!isCompleted) {
        onComplete();
        setIsCompleted(true);
      }
      return () => null;
    } else {
      const timer = setTimeout(() => {
        setTimeLeft(calculateTimeLeft(targetDate));
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [timeLeft, onComplete, isCompleted, targetDate]);

  const formatTime = (time: number) => (time < 10 ? `0${time}` : time);

  return (
    <div className="countdown">
      {formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
    </div>
  );
};
