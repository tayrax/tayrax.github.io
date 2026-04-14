// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const currentPermission = (): NotificationPermissionState => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
};

export const requestPermission = async (): Promise<NotificationPermissionState> => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  const result = await Notification.requestPermission();
  return result;
};

export const notify = (title: string, body: string): void => {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/tayrax-logo.svg', tag: 'tayrax' });
  } catch {
    // Some browsers require notifications via ServiceWorkerRegistration — fall through silently.
  }
};
