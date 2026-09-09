/**
 * Features page — the eleven feature cards and the lead block above them.
 *
 * §B7 item 8 again: every image on the live page has `alt=""`. Real alt text
 * is written here.
 *
 * "Learn More" links all point at /docs/<slug>/ and are regenerated through
 * `routes.doc()` rather than pasted (§B2).
 */
export interface FeatureCard {
  title: string;
  desc: string;
  /** Docs article the "Learn More" link resolves to. */
  slug: string;
  /** Tint behind the screenshot; three colours cycle in threes. */
  bg: string;
  /** Padding above the screenshot — 20px on two cards, 30px on the rest. */
  bandTop: number;
  /** Space under the description before the link; 22px except two cards. */
  descBottom: number;
  img: string;
  alt: string;
}

export const featureCards: FeatureCard[] = [
  {
    title: 'Add Instant Answer in few clicks',
    desc:
      'Help customers find their desired article easily from any page on the store with search suggestions.',
    slug: 'configure-instant-answer-with-storefaq',
    bg: 'var(--color-aqua)',
    bandTop: 20,
    descBottom: 22,
    img: 'Frame-21472390863.png',
    alt: 'The instant answer search suggestions panel on a storefront',
  },
  {
    title: 'Add Live Chat to Your Shopify Store',
    desc:
      'Connect directly with customers, answer questions instantly, and style the chat interface to reflect your brand.',
    slug: 'configure-live-chat-support-in-storefaq',
    bg: 'var(--color-aqua)',
    bandTop: 30,
    descBottom: 22,
    img: 'Frame-21472390864.png',
    alt: 'The live chat widget open on a Shopify storefront',
  },
  {
    title: 'AI Chatbot for Smart Help Desk',
    desc:
      'AI-powered assistant that automates live chat & delivers real‑time support using your store’s information.',
    slug: 'configure-ai-chatbot-in-storefaq',
    bg: 'var(--color-aqua)',
    bandTop: 30,
    descBottom: 22,
    img: 'aichat.png',
    alt: 'The AI chatbot answering a customer question',
  },
  {
    title: 'Create Shopify Live Chat Shortcuts',
    desc:
      'Message Shortcuts help you quickly send pre‑saved replies in Shopify live chat for faster, smoother support.',
    slug: 'configure-message-shortcuts-in-storefaq',
    bg: 'var(--color-cream)',
    bandTop: 30,
    descBottom: 22,
    img: 'Modal.png',
    alt: 'The message shortcuts panel in the live chat composer',
  },
  {
    title: 'Create FAQs In Any Language',
    desc:
      'Display multilingual FAQs on your store to deliver clear, effective, and localized support to global customers.',
    slug: 'configure-multilingual-faq-support-in-storefaq',
    bg: 'var(--color-cream)',
    bandTop: 30,
    descBottom: 34,
    img: 'Frame-2147239083.png',
    alt: 'A FAQ group shown in several languages',
  },
  {
    title: 'Sidekick Integration',
    desc:
      'Manage FAQs, FAQ Groups, helpdesk, live chat and StoreFAQ settings directly from Shopify Sidekick with simple commands.',
    slug: 'shopify-sidekick-integration-in-storefaq',
    bg: 'var(--color-cream)',
    bandTop: 30,
    descBottom: 32,
    img: 'Sidekick-integration-e1787146634174.webp',
    alt: 'StoreFAQ commands running inside Shopify Sidekick',
  },
  {
    title: 'Design FAQ Page With Flexibility',
    desc:
      'Get the ultimate freedom to design your FAQ page effortlessly with a visual builder and custom CSS styling.',
    slug: 'design-faq-page-of-your-shopify-store',
    bg: 'var(--color-mint)',
    bandTop: 30,
    descBottom: 22,
    img: 'Frame-214723908.png',
    alt: 'The visual FAQ page builder with styling controls',
  },
  {
    title: 'Import & Export FAQs Easily',
    desc:
      'Easily migrate all your FAQs from one store to another quickly, securely, and without any hassle.',
    slug: 'import-and-export-faqs-on-your-shopify-store',
    bg: 'var(--color-mint)',
    bandTop: 20,
    descBottom: 22,
    img: 'Frame-214723908611-1.png',
    alt: 'The import and export screen for moving FAQs between stores',
  },
  {
    title: 'Show Your FAQs On Any Page',
    desc:
      'Display FAQs effortlessly on any product or page and organize them quickly with intuitive drag-and-drop tools.',
    slug: 'embed-faq-groups-on-specific-pages-on-shopify',
    bg: 'var(--color-mint)',
    bandTop: 30,
    descBottom: 22,
    img: 'Frame-2147239451.png',
    alt: 'A FAQ group embedded on a product page',
  },
  {
    title: 'Create Stunning FAQ Pages',
    desc:
      'Convert your visitors into loyal customers by instantly answering their queries and enhancing their shopping experience.',
    slug: 'add-new-faq-on-your-shopify-store',
    bg: 'var(--color-aqua)',
    bandTop: 30,
    descBottom: 22,
    img: 'Frame-2147239452.png',
    alt: 'A finished FAQ page on a Shopify storefront',
  },
  {
    title: 'Add FAQs With Drag‑&‑Drop',
    desc:
      'Easily add FAQs on your store and smoothly move the accordions with drag‑and‑drop, without any hassle.',
    slug: 'add-new-faq-group-on-your-shopify-store',
    bg: 'var(--color-aqua)',
    bandTop: 30,
    descBottom: 22,
    img: 'Frame-2147239434.png',
    alt: 'FAQ accordions being reordered by drag and drop',
  },
];
