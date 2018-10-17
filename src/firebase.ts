import admin from "firebase-admin";

const privateKey = process.env.FIREBASE_PRIVATE_KEY || " ";
export = admin.initializeApp({
    credential: admin.credential.cert({
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        projectId: process.env.FIREBASE_PROJECT_ID,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
});
