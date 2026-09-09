/**
 * Home — "Here's What Our Users Say".
 *
 * The original renders these twice: three columns of two for >=768, and a
 * second, hidden row holding copies of the lower three for <768 (the two
 * copies are byte-identical, verified against reference/html/home.html).
 * One list is enough here — `order` reproduces the stacked sequence, which
 * reads across the columns rather than down them.
 */
export interface Testimonial {
  name: string;
  place: string;
  quote: string;
  /** Position in the single-column stack below 768. */
  order: number;
  /**
   * The original spaces the columns with a 24px bottom margin on each card
   * — including the last one, where it escapes the column and lifts the row.
   * Exactly one card (this one) has it zeroed, which is why the row is 24px
   * shorter than it looks like it should be whenever this column is tallest.
   */
  flush?: true;
  /** Each card carries its own tint; measured on the live section. */
  bg: string;
}

/** Three columns of two, in the order they are painted from 768 up. */
export const testimonialColumns: Testimonial[][] = [
  [
    {
      name: 'Vegas Custom Creations',
      bg: 'var(--color-ice)',
      place: 'United States',
      order: 1,
      quote:
        'App is easy to set up and customize to match the feel of your site. Tried a couple of other FAQ apps before this one and this one beats them hands down!',
    },
    {
      name: 'Plentiful Earth | Spiritual Store',
      bg: 'var(--color-ice-periwinkle)',
      place: 'United States',
      order: 4,
      flush: true,
      quote:
        'I’m very impressed! The speed of implementation, the turnkey look, and the quality of support are awesome. He’s literally creating a custom fix for something I need, right now! Definitely one of the best plugins I’ve ever used.',
    },
  ],
  [
    {
      name: 'Moore Notary Service',
      bg: 'var(--color-ice-cyan)',
      place: 'United States',
      order: 2,
      quote:
        'This app perfectly displays my FAQ’s in a clean and simple format that is easy to read and navigate. No extra unnecessary gimmicks, just a simple and easy-to-use FAQ app.',
    },
    {
      name: 'SitnStand',
      bg: 'var(--color-ice-peach)',
      place: 'United States',
      order: 5,
      quote:
        'Awesome customer service. I needed changes that I could not do on my own. They took a lot of time to make the app look perfect for me on my website. Highly recommend it!',
    },
  ],
  [
    {
      name: 'Vida Pura',
      bg: 'var(--color-ice-lilac)',
      place: 'Australia',
      order: 3,
      quote:
        'Loren was an amazing help in customising my FAQ block on my home page. Very responsive and went out of her way to assist me!',
    },
    {
      name: 'PK Automaten GmbH',
      bg: 'var(--color-ice-leaf)',
      place: 'Germany',
      order: 6,
      quote:
        'Santos solved a problem for me in just a few minutes that I had been trying to solve for hours. Now the FAQs are neatly integrated into our website and we can refer our customers to them. Great!',
    },
  ],
];
