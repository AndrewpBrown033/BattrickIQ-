import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const usersQuery = await getDocs(collection(db, 'users'));
  for (const docSnapshot of usersQuery.docs) {
    const data = docSnapshot.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('sabre')) {
      console.log(`Found sabre in user ${docSnapshot.id}`);
      // find context
      const idx = str.indexOf('sabre');
      console.log(str.substring(Math.max(0, idx - 100), Math.min(str.length, idx + 100)));
    }
    if (str.includes('elo')) {
      console.log(`Found elo in user ${docSnapshot.id}`);
    }
    if (str.includes('bat score')) {
      console.log(`Found bat score in user ${docSnapshot.id}`);
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
