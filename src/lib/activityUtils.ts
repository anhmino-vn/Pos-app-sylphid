import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function logActivity(
  user: { uid: string; email: string; name?: string } | null,
  module: string,
  action: string,
  details: string
) {
  if (!user) return;
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.name || user.email,
      module,
      action,
      details,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
