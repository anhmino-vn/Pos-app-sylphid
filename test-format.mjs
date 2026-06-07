function formatDate(date) {
  if (!date) return '---';
  let d;
  if (date instanceof Date) {
    d = date;
  } else if (date && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date && date.seconds !== undefined) {
    d = new Date(date.seconds * 1000);
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return '---';

  const pad = (n) => n.toString().padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

const val = "2026-06-07T07:02:00.000Z";
const dateObj = { toDate: () => new Date(val) };
console.log('Test 1:', formatDate(dateObj));

const dateStr = "2026-06-07T14:02";
console.log('Test 2:', formatDate(new Date(dateStr)));

const dateRaw = "2026-06-07T14:02";
console.log('Test 3:', formatDate(dateRaw));
