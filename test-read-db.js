import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const usersQuery = await getDocs(collection(db, 'users'));
  console.log("Users:", usersQuery.docs.length);
  for (const docSnapshot of usersQuery.docs) {
    const data = docSnapshot.data();
    console.log("User email:", data.email, "uid:", docSnapshot.id);
    console.log("Fixtures length:", data.fixtures?.length);
    if (data.fixtures && data.fixtures.length > 0) {
      console.log("First fixture:", data.fixtures[0]);
    }
    // Is there any sabre score?
    console.log(JSON.stringify(data).substring(0, 500));
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
