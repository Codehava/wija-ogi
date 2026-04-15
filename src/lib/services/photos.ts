// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Photo Upload Service (S3/MinIO)
// Handles photo upload with compression via presigned URLs
// ═══════════════════════════════════════════════════════════════════════════════

import {
    uploadFile,
    deleteFile,
    getFileUrl,
    getPersonPhotoKey,
    getPersonThumbnailKey,
} from '@/lib/storage';

// Max file size after compression (500KB)
const MAX_FILE_SIZE = 500 * 1024;
// Max dimensions for photos
const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
// JPEG quality (0-1)
const JPEG_QUALITY = 0.8;

/**
 * Compress and resize image before upload
 */
async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;

            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                },
                'image/jpeg',
                JPEG_QUALITY
            );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Convert Blob to Uint8Array for S3 upload
 */
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

/**
 * Upload person photo to S3/MinIO
 * @param familyId - Family/Tree ID
 * @param personId - Person ID
 * @param file - Image file to upload
 * @returns URL to access the uploaded photo
 */
export async function uploadPersonPhoto(
    familyId: string,
    personId: string,
    file: File
): Promise<string> {

    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar');
    }

    // Validate original file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('Ukuran foto maksimal 10MB');
    }


    // Compress the image
    const compressedBlob = await compressImage(file);

    // Check compressed size
    if (compressedBlob.size > MAX_FILE_SIZE) {
        console.warn(`Compressed size: ${(compressedBlob.size / 1024).toFixed(0)}KB (target: ${MAX_FILE_SIZE / 1024}KB)`);
    }

    // Create storage key
    const key = getPersonPhotoKey(familyId, personId, file.name);

    try {
        // Convert blob to Uint8Array and upload
        const data = await blobToUint8Array(compressedBlob);
        await uploadFile(key, data, 'image/jpeg');

        // Get download URL
        const downloadURL = await getFileUrl(key);
        return downloadURL;
    } catch (error: any) {
        console.error('[Photo Upload] FAILED:', error.message);
        throw new Error('Gagal mengupload foto. Coba lagi.');
    }
}

/**
 * Delete person photo from S3/MinIO
 */
export async function deletePersonPhoto(
    familyId: string,
    personId: string
): Promise<void> {
    const key = getPersonPhotoKey(familyId, personId, 'photo.jpg');
    const thumbnailKey = getPersonThumbnailKey(familyId, personId);

    try {
        await deleteFile(key);
    } catch {
        // Ignore if file doesn't exist
        console.warn('[Photo Delete] Photo not found, skipping:', key);
    }

    try {
        await deleteFile(thumbnailKey);
    } catch {
        // Ignore if thumbnail doesn't exist
    }
}

/**
 * Get the current photo URL for a person
 */
export async function getPersonPhotoUrl(
    familyId: string,
    personId: string
): Promise<string | null> {
    const key = getPersonPhotoKey(familyId, personId, 'photo.jpg');
    try {
        return await getFileUrl(key);
    } catch {
        return null;
    }
}

/**
 * Validate and preview image before upload
 * Returns base64 data URL for preview
 */
export async function previewImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('File harus berupa gambar'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
    });
}
