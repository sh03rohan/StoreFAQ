/**
 * Guide §B2/§C-Phase4 — nav and footer link lists, built from `routes`.
 * Never hardcode a URL in the header or footer component.
 */
import { routes, external, go } from '../lib/routes';

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export const primaryNav: NavItem[] = [
  { label: 'Home',      href: routes.home() },
  { label: 'Features',  href: routes.features() },
  { label: 'Docs',      href: routes.docs() },
  { label: 'Blog',      href: routes.blog() },
  { label: 'Changelog', href: routes.changelog() },
];

export const headerCta: NavItem = {
  label: 'Install Now',
  href: go.getStarted(),
};

export interface FooterColumn {
  heading: string;
  items: NavItem[];
}

export const footerColumns: FooterColumn[] = [
  {
    heading: 'Apps',
    items: [
      { label: 'StoreFAQ',   href: external.shopifyApp, external: true },
      { label: 'StoreSEO',   href: 'https://apps.shopify.com/storeseo', external: true },
      { label: 'BetterDocs', href: 'https://apps.shopify.com/betterdocs-knowledgebase', external: true },
      { label: 'TrustSync',  href: 'https://apps.shopify.com/customer-review-app', external: true },
      { label: 'EasyFlow',   href: 'https://apps.shopify.com/product-options-4', external: true },
    ],
  },
  {
    heading: 'Get Help',
    items: [
      { label: 'Documentation', href: routes.docs() },
      { label: 'Blog',          href: routes.blog() },
      { label: 'Changelog',     href: routes.changelog() },
      { label: 'Support',       href: external.support, external: true },
    ],
  },
  {
    heading: 'Company',
    items: [
      { label: 'Privacy Policy', href: routes.privacy() },
    ],
  },
];
