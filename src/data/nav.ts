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
