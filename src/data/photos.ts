export type PhotoEntry = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

const u = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const local = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const PHOTOS: {
  about: PhotoEntry;
  services: PhotoEntry[];
  blog: PhotoEntry[];
} = {
  about: {
    src: u('photo-1559131397-f94da358f7ca', 800, 1000),
    alt: 'Parent reading a picture book with their young child in warm afternoon light',
    width: 800,
    height: 1000,
  },
  services: [
    {
      src: u('photo-1607453998774-d533f65dac99', 640, 360),
      alt: 'Young child stacking colorful wooden blocks on a living room rug',
      width: 640,
      height: 360,
    },
    {
      src: local('offer/learning-worksheet.webp'),
      alt: 'Adult guiding a child through a shape-recognition worksheet',
      width: 640,
      height: 360,
    },
    {
      src: local('offer/puzzle-heart-outdoor.webp'),
      alt: 'Child outdoors holding up a heart made of colorful puzzle pieces',
      width: 640,
      height: 360,
    },
    {
      src: local('offer/autism-awareness.webp'),
      alt: 'Rainbow handprint art celebrating autism awareness',
      width: 640,
      height: 360,
    },
    {
      src: local('offer/blocks-focused.webp'),
      alt: 'Child engaged in focused play with colorful stacking blocks',
      width: 640,
      height: 360,
    },
    {
      src: local('offer/puzzle-pieces.webp'),
      alt: 'Colorful puzzle pieces scattered, representing each child’s unique plan',
      width: 640,
      height: 360,
    },
  ],
  blog: [
    {
      src: u('photo-1517677208171-0bc6725a3e60', 640, 360),
      alt: 'Family preparing materials together before a learning session',
      width: 640,
      height: 360,
    },
    {
      src: u('photo-1606092195730-5d7b9af1efc5', 640, 360),
      alt: "Children's hands engaged together in shared, consent-based play",
      width: 640,
      height: 360,
    },
    {
      src: u('photo-1503676260728-1c00da094a0b', 640, 360),
      alt: 'Diverse hands of children and adults meeting in a circle of connection',
      width: 640,
      height: 360,
    },
  ],
};
