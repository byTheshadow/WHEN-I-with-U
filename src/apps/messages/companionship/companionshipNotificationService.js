const canNotify = () => (
  typeof window !== 'undefined'
  && 'Notification' in window
);

export const requestCompanionshipNotificationPermission = async () => {
  if (!canNotify()) return 'unsupported';

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const notifyCompanionship = ({
  title = '长期陪伴',
  body = '陪伴空间有新的动静。',
  icon = '',
}) => {
  if (!canNotify() || Notification.permission !== 'granted') {
    return false;
  }

  if (
    typeof document !== 'undefined'
    && document.visibilityState === 'visible'
  ) {
    return false;
  }

  try {
    new Notification(title, {
      body,
      icon: icon || undefined,
      tag: 'when-i-with-u-companionship',
      renotify: true,
    });

    return true;
  } catch (error) {
    console.warn('[Companionship] notification failed:', error);
    return false;
  }
};
