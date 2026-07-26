/* ============================================
   reminders.js — Appointment reminder notifications
   Works only while the app/tab is open (no push
   server) — checks every 60s for appointments
   starting within the next 30 minutes.
   ============================================ */

const REMINDER_WINDOW_MIN = 30;
const REMINDER_CHECK_MS = 60 * 1000;

async function checkReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const appts = await DB.getAll('appointments');
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60 * 1000);

  const due = appts.filter(a =>
    !a.reminderSent &&
    ['Booked', 'Arrived'].includes(a.status) &&
    a.scheduledAt &&
    new Date(a.scheduledAt) >= now &&
    new Date(a.scheduledAt) <= windowEnd
  );

  if (!due.length) return;

  const customers = await DB.getAll('customers');
  for (const appt of due) {
    const cust = customers.find(c => c.id === appt.customerId);
    const time = new Date(appt.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    try {
      new Notification('Upcoming Appointment', {
        body: `${cust ? cust.name : 'Customer'} at ${time}${appt.beautician ? ' with ' + appt.beautician : ''}`,
        tag: appt.id,
      });
    } catch (e) { /* notification failed silently — non-critical */ }
    await DB.update('appointments', appt.id, { reminderSent: true });
  }
}

async function requestReminderPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

setInterval(checkReminders, REMINDER_CHECK_MS);
checkReminders();

window.Reminders = { requestPermission: requestReminderPermission };
