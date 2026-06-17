
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testAuth(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Logged in successfully!');
    const snapshot = await getDocs(collection(db, 'categories'));
    console.log('Success! Fetched ' + snapshot.docs.length + ' categories.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

// Check args
if (process.argv.length === 4) {
  testAuth(process.argv[2], process.argv[3]);
} else {
  console.log('Usage: node test_auth.mjs <email> <password>');
}

