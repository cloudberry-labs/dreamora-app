import { issueSignedToken, presignUrl } from '@vercel/blob';
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
    return response.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return response.status(401).json({
        error: 'Unauthorized',
      });
    }

    const idToken = authorization.slice(7);

    const auth = getFirebaseAdmin();
    const user = await auth.verifyIdToken(idToken);

    const { filename, contentType, size } = request.body || {};

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];

    if (!filename || !allowedTypes.includes(contentType)) {
      return response.status(400).json({
        error: 'Unsupported image type',
      });
    }

    if (!size || size > 10 * 1024 * 1024) {
      return response.status(400).json({
        error: 'Image must be 10 MB or smaller',
      });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    const pathname =
      `dreamora/${user.uid}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const token = await issueSignedToken({
      operations: ['put'],
      allowedContentTypes: allowedTypes,
      maximumSizeInBytes: 10 * 1024 * 1024,
    });

    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: 'put',
      validUntil: Date.now() + 5 * 60 * 1000,
    });

    return response.status(200).json({
      uploadUrl: presignedUrl,
      pathname,
    });

  } catch (error) {
    console.error('Dreamora presign error:', error);

    return response.status(401).json({
      error: 'Upload could not be authorized.',
    });
  }
}
