import { handleUpload } from '@vercel/blob/client';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  return getAuth();
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authorization.slice(7);
    const auth = getFirebaseAdmin();
    const decodedToken = await auth.verifyIdToken(idToken);

    const body = request.body;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            uid: decodedToken.uid,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Dreamora image uploaded:', blob.url);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Dreamora upload error:', error);
    return response.status(400).json({
      error: 'Upload could not be authorized.',
    });
  }
}
