/**
 * Pricing table content, transcribed from the live page.
 *
 * Layout note (guide §B3): at 1280+ this is a comparison table with a
 * separate label column. Below 1280 that column is hidden and the four
 * plans stack, each repeating its own row labels — which is why every
 * cell carries its label.
 *
 * §B7 item 12: only Enterprise shows a yearly price, and Free's
 * "Additional View" reads "Not Applicable" with no context.
 */

export interface PlanCell {
  /** Text value, or undefined when the cell is an icon. */
  text?: string;
  icon?: 'check' | 'x';
  /** Shows the info glyph after the value (Additional View row). */
  tip?: boolean;
}

export interface PricingRow {
  label: string;
  /**
   * Row heights the pricing plugin computes in JavaScript and writes as
   * inline styles. They are not derivable from the content (a row whose
   * tallest child is 25.6px is set to 59px), so they are measured and stored.
   * Applied as *min*-heights, which lets rows still grow where text wraps at
   * narrower widths — reproducing the 360 and 480 layouts without a
   * separate table for each.
   */
  height: number;      // 1280+
  heightMd: number;    // below 1280
  tip?: string;
  /** Purple label with a sparkle glyph. */
  accent?: boolean;
  /** Purple gradient-filled label with a sparkle glyph (AI Chatbot). */
  gradient?: boolean;
  cells: PlanCell[];
}

export interface Plan {
  name: string;
  currency: string;
  price: string;
  period: string;
  yearly?: string;
  popular?: boolean;
}

export const plans: Plan[] = [
  {
    name: 'Free',
    currency: '$',
    price: '0.00',
    period: '/mo',
  },
  {
    name: 'Professional',
    currency: '$',
    price: '7.99',
    period: '/mo',
  },
  {
    name: 'Growth',
    currency: '$',
    price: '14.99',
    period: '/mo',
    popular: true,
  },
  {
    name: 'Enterprise',
    currency: '$',
    price: '49.99',
    period: '/mo',
    yearly: '$479.90 yearly (Save 20%)',
  },
];

export const pricingRows: PricingRow[] = [
  {
    label: 'FAQ Page Views',
    height: 57,
    heightMd: 59,
    cells: [{ text: 'Up to 100 FAQ Page Views' }, { text: 'Up to 500 FAQ Page Views' }, { text: 'Up to 2000 FAQ Page Views' }, { text: 'Unlimited FAQ Page Views' }],
  },
  {
    label: 'Additional View',
    height: 57,
    heightMd: 59,
    tip: 'Extra charges apply if you exceed your monthly FAQ page view limit, based on your plan.',
    cells: [{ text: 'Not Applicable' }, { text: '$0.0159/FAQ Page View', tip: true }, { text: '$0.0075/FAQ Page View', tip: true }, { text: 'No Charge', tip: true }],
  },
  {
    label: 'Unlimited FAQs & FAQ Groups',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'AI Chatbot',
    height: 82,
    heightMd: 59,
    gradient: true,
    tip: 'Extra charges apply for each conversation after the limit.',
    cells: [{ text: 'AI Conversations 25(Lifetime)' }, { text: 'AI Conversations 50/mo' }, { text: 'AI Conversations 100/ mo' }, { text: 'AI Conversations 500/ mo' }],
  },
  {
    label: 'Train on AI',
    height: 57,
    heightMd: 59,
    cells: [{ text: 'Products Up to 50' }, { text: 'Products Up to 150' }, { text: 'Products Up to 300' }, { text: 'Products Up to 2000' }],
  },
  {
    label: 'Write with AI',
    height: 54,
    heightMd: 56,
    accent: true,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Shopify Sidekick Integration',
    height: 54,
    heightMd: 56,
    accent: true,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Live Chat',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Message Shortcuts',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Multilingual FAQ',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'x' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Design',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Instant Answer',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Custom CSS',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Import/Export',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Trademark Free',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Embed On Any Page',
    height: 54,
    heightMd: 56,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { icon: 'check' }],
  },
  {
    label: 'Dedicated Support',
    height: 56,
    heightMd: 59,
    cells: [{ icon: 'check' }, { icon: 'check' }, { icon: 'check' }, { text: 'Priority Support' }],
  },
];
