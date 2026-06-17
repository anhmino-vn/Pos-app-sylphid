import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testFetch() {
  try {
    const snapshot = await getDocs(collection(db, 'categories'));
    console.log(`Success! Fetched ${snapshot.docs.length} categories.`);
  } catch (err) {
    console.error('Error fetching:', err.message);
  }
}
testFetch();
