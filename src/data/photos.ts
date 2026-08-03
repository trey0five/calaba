export type PhotoEntry = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

/** Every photo is served from `public/photos/`, never hotlinked.
 *
 *  Two reasons this file no longer points at a CDN:
 *  1. The previous build referenced `images.unsplash.com/photo-<id>` URLs whose
 *     ids did not match their alt text — the About portrait resolved to a phone
 *     scanning a QR code, one blog card to a stack of folded sweaters. A remote
 *     id is unverifiable at build time and can drift; a committed file cannot.
 *  2. Sizes are baked to what the layout actually renders, so no oversized
 *     original is downloaded and thrown away by `object-cover`.
 *
 *  Sources are Unsplash free-licence (commercial use, no attribution required),
 *  cropped to the aspect each slot needs with the subject kept in frame.
 */
const local = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const PHOTOS: {
  about: PhotoEntry;
  services: PhotoEntry[];
  blog: PhotoEntry[];
} = {
  about: {
    src: local('photos/about-teaching.webp'),
    alt: 'A clinician sitting beside a young child at a table, guiding them through a writing activity',
    width: 840,
    height: 1050,
  },
  // index-aligned with SERVICES in src/content/services.ts
  services: [
    {
      src: local('photos/svc-home.webp'),
      alt: 'A parent and child building together with colorful blocks on a living room table',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/svc-school.webp'),
      alt: 'A teacher leaning in to support children working at a classroom table',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/svc-community.webp'),
      alt: 'Children and adults sharing an activity at outdoor tables in a park',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/svc-family.webp'),
      alt: 'A father and daughter playing together with toys on the living room floor',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/svc-specialized.webp'),
      alt: 'An adult giving a child focused one-to-one support at a work table',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/svc-advocacy.webp'),
      alt: 'A group of people talking around a meeting table',
      width: 1000,
      height: 563,
    },
  ],
  // index-aligned with ARTICLES in src/content/articles.ts
  blog: [
    {
      src: local('photos/blog-intake.webp'),
      alt: 'A clinician reviewing a folder with a parent while their child works nearby',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/blog-assent.webp'),
      alt: 'A child choosing what to work on next while an adult follows their lead',
      width: 1000,
      height: 563,
    },
    {
      src: local('photos/blog-siblings.webp'),
      alt: 'An older sibling reaching back to help a younger one across a fallen log',
      width: 1000,
      height: 563,
    },
  ],
};
