/**
 * Home feature content, transcribed from the live page.
 *
 * §B7 item 1: the subtitle marked `placeholder: true` is the same sentence
 * reused verbatim in three unrelated features. Reproduced for now so the
 * Phase 9 diff stays honest; rewrites belong in the content-fix pass.
 * §B7 item 5: "Frequently Answered Questions" should read "Asked".
 * §B7 item 8: every image on the original has an empty alt. Real alt text
 * is written here — invisible, so applied now.
 */
import type { ImageMetadata } from 'astro';

import component1 from '../assets/home/Component-1.png';
import instantAnswer from '../assets/home/Frame-2147239086.png';
import aiChatbot from '../assets/home/ai-chatbot-smart-help.webp';
import liveChat from '../assets/home/Group-2085665031.png';
import multilingual from '../assets/home/Frame-2147239082.png';
import designFaq from '../assets/home/Frame-11446.png';
import importExport from '../assets/home/img33.png';
import dragDrop from '../assets/home/Frame-11473.png';
import stunningPages from '../assets/home/Frame-11446e.png';

export interface Feature {
  title: string;
  /** Phrase inside `title` rendered in the accent green. */
  highlight?: string;
  sub: string;
  image: ImageMetadata;
  alt: string;
  placeholder?: boolean;
  /** Card background — set per card on the original, not alternating cleanly. */
  bg?: string;
  /** Gap between subtitle and image. 30px on six cards, bespoke on two. */
  gap?: number;
}

export const leadFeature: Feature = {
  title: 'Write Frequently Answered Questions With The Magic Of AI',
  highlight: 'Frequently Answered Questions',
  sub: 'Answer your common customer questions  faster than ever with the help of AI',
  image: component1,
  alt: 'Generating an FAQ answer with AI inside the StoreFAQ editor',
};

export const features: Feature[] = [
  {
    title: 'Add Instant Answer In A Few Clicks',
    bg: 'var(--color-sky)',
    sub: 'Help customers find their desired articles easily from any page on the store with Instant Answer.',
    image: instantAnswer,
    alt: 'Instant Answer panel open over a Shopify storefront',
  },
  {
    title: 'AI Chatbot for Smart Help Desk',
    bg: 'var(--color-sky)',
    gap: 20,
    sub: 'AI-powered assistant that automates live chat & delivers real‑time support using your store’s information.',
    image: aiChatbot,
    alt: 'StoreFAQ AI chatbot answering a customer question',
  },
  {
    title: 'Add Live Chat to Your Shopify Store',
    bg: 'var(--color-cream)',
    sub: 'Connect directly with customers, answer questions instantly, and style the chat interface to reflect your brand.',
    image: liveChat,
    alt: 'Live chat widget styled to match a storefront',
  },
  {
    title: 'Create FAQs In Any Language',
    bg: 'var(--color-cream)',
    gap: 16,
    sub: 'Display multilingual FAQs on your store to deliver clear, effective, and localized support to global customers.',
    image: multilingual,
    alt: 'FAQ group shown in several languages',
  },
  {
    title: 'Design FAQ Page With Flexibility',
    bg: 'var(--color-mint)',
    sub: 'Improve user experience by adding an advanced live search bar so your visitors can find helpful documentation articles easily.',
    image: designFaq,
    alt: 'FAQ page design settings in StoreFAQ',
    placeholder: true,
  },
  {
    title: 'Import & Export FAQs Easily',
    bg: 'var(--color-mint)',
    sub: 'Improve user experience by adding an advanced live search bar so your visitors can find helpful documentation articles easily.',
    image: importExport,
    alt: 'Importing and exporting FAQs as a CSV file',
    placeholder: true,
  },
  {
    title: 'Add FAQs With Drag‑&‑Drop',
    bg: 'var(--color-cream)',
    sub: 'Easily add FAQs on your store and smoothly move the accordions with drag‑and‑drop, without any hassle.',
    image: dragDrop,
    alt: 'Reordering FAQ items by dragging them',
  },
  {
    title: 'Create Stunning FAQ Pages',
    bg: 'var(--color-cream)',
    sub: 'Improve user experience by adding an advanced live search bar so your visitors can find helpful documentation articles easily.',
    image: stunningPages,
    alt: 'A finished FAQ page on a Shopify store',
    placeholder: true,
  },
];
