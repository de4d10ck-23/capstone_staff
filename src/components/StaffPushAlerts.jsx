import { useEffect, useState } from 'react';

export async function unlinkStaffPush(apiUrl, token) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  try {
    await fetch(`${apiUrl}/notifications/unsubscribe`, {
      method: 'POST', signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } finally {
    await subscription.unsubscribe();
  }
}

export default function StaffPushAlerts({ apiUrl, token, userId }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function connect(requestPermission = false, signal) {
    if (!supported || !token) return;
    setBusy(true);
    setError('');
    try {
      const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') {
        if (requestPermission) throw new Error('Allow notifications in your browser settings to receive report alerts.');
        return;
      }
      await navigator.serviceWorker.register('/staff-sw.js');
      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch(`${apiUrl}/notifications/vapid-public-key`, { signal });
      const key = await keyResponse.json();
      if (!keyResponse.ok || !key.publicKey) throw new Error('Unable to load push settings.');
      const raw = atob(key.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
      const applicationServerKey = Uint8Array.from(raw, c => c.charCodeAt(0));
      let subscription = await registration.pushManager.getSubscription();
      if (subscription?.options.applicationServerKey &&
          String(new Uint8Array(subscription.options.applicationServerKey)) !== String(applicationServerKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const response = await fetch(`${apiUrl}/notifications/subscribe`, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error('Unable to register this device. Try enabling push alerts again.');
      if (!signal?.aborted) setEnabled(true);
    } catch (err) {
      if (err.name !== 'AbortError') { setEnabled(false); setError(err.message); }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setEnabled(false);
    connect(false, controller.signal);
    return () => controller.abort();
    // Re-register an existing subscription to the current authenticated account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, token, userId]);

  if (!supported) return <span className="text-xs text-slate-500">Push alerts unavailable in this browser</span>;
  return <div className="text-right max-w-xs">
    <button type="button" disabled={busy || enabled} onClick={() => connect(true)}
      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-70">
      {busy ? 'Connecting…' : enabled ? 'Push alerts enabled' : 'Enable push alerts'}
    </button>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
