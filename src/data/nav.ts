/**
 * Guide §B2 — nav and footer link lists, built from `routes`.
 * Never hardcode a URL in the header or footer component.
 *
 * Structure read from reference/html/home.html, not assumed:
 * Home / Features / Documentation / Blog / Support(+Changelog submenu).
 * "Support" points off-site to storeware.io; "Changelog" is its only child.
 */
import { routes, external } from '../lib/routes';

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
  children?: NavItem[];
}

export const primaryNav: NavItem[] = [
  { label: 'Home',          href: routes.home() },
  { label: 'Features',      href: routes.features() },
  { label: 'Documentation', href: routes.docs() },
  { label: 'Blog',          href: routes.blog() },
  {
    label: 'Support',
    href: external.support,
    external: true,
    children: [{ label: 'Changelog', href: routes.changelog() }],
  },
];

/** Header CTA — links straight to the app listing, as on the original. */
export const headerCta: NavItem = {
  label: 'Install Now',
  href: external.shopifyApp,
  external: true,
};

export interface FooterColumn {
  heading: string;
  items: NavItem[];
}

/** Read from the live footer, not assumed. */
export const footerColumns: FooterColumn[] = [
  {
    heading: 'Apps',
    items: [
      { label: 'StoreSEO',               href: 'https://storeseo.com/',        external: true },
      { label: 'BetterDocs for Shopify', href: 'https://betterdocs.co/shopify/', external: true },
      { label: 'Trust.Sync',             href: 'https://trustsync.io/',        external: true },
      { label: 'EasyFlow',               href: 'https://easy-flow.app/',       external: true },
    ],
  },
  {
    heading: 'Get Help',
    items: [
      { label: 'Support',        href: external.support, external: true },
      { label: 'Documentation',  href: routes.docs() },
      { label: 'Changelog',      href: routes.changelog() },
      { label: 'Privacy Policy', href: routes.privacy() },
    ],
  },
];

export interface SocialLink {
  label: string;
  href: string;
  icon: 'facebook' | 'linkedin';
}

/** The original labels both of these "social link"; naming them is an
 *  accessibility fix that changes nothing visually (guide §B7 item 11). */
export const socialLinks: SocialLink[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/StorewareApps',           icon: 'facebook' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/storewareapps/',  icon: 'linkedin' },
];
