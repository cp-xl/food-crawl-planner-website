const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIRESTORE_PROJECT_ID;

// In Cloud Run, Application Default Credentials are provided by the service account.
// Locally, use `gcloud auth application-default login`.
initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

module.exports = db;
