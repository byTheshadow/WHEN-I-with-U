const NOTIFICATION_TITLE = 'WHEN I with U';

export const isNotificationSupported = () => (
  typeof window !== 'undefined'
  && 'Notification' in window
);

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
};

export const requestCompanionshipNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.warn(
      '[Companionship] 无法请求浏览器通知权限：',
      error,
    );

    return 'denied';
  }
};

export const notifyCompanionship = ({
  title = NOTIFICATION_TITLE,
  body = '陪伴模式有新的动态。',
  tag = 'when-i-with-u-companionship',
  onClick = null,
} = {}) => {
  if (
    !isNotificationSupported()
    || Notification.permission !== 'granted'
  ) {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag,
      renotify: true,
      silent: false,
    });

    if (typeof onClick === 'function') {
      notification.onclick = onClick;
    }

    return notification;
  } catch (error) {
    console.warn(
      '[Companionship] 浏览器通知发送失败：',
      error,
    );

    return null;
  }
};
