import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
}

const BASE_URL = 'https://thunder-ai-mu.vercel.app';
const DEFAULT_TITLE = 'Thunder AI // Conversational Intelligence & Compute Platform';
const DEFAULT_DESC =
  'Next-generation conversational AI platform powered by OpenRouter multi-model synthesis, Redis sliding-window token governance, and Google Gemini chat architecture.';

export function updatePageSEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonical,
  ogType = 'website',
}: SEOProps) {
  if (typeof document === 'undefined') return;

  // Update Title only if changed
  const formattedTitle = title.includes('Thunder AI') ? title : `${title} // Thunder AI`;
  if (document.title !== formattedTitle) {
    document.title = formattedTitle;
  }

  // Update or create Meta Tags helper only if content differs
  const setMeta = (attrName: string, attrVal: string, contentVal: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    if (el.getAttribute('content') !== contentVal) {
      el.setAttribute('content', contentVal);
    }
  };

  setMeta('name', 'description', description);
  setMeta('property', 'og:title', formattedTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:type', ogType);
  setMeta('name', 'twitter:title', formattedTitle);
  setMeta('name', 'twitter:description', description);

  // Update Canonical only if changed
  const fullCanonical = canonical
    ? (canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`)
    : window.location.origin + window.location.pathname;

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  if (linkCanonical.getAttribute('href') !== fullCanonical) {
    linkCanonical.setAttribute('href', fullCanonical);
  }
}

export function usePageSEO({ title, description, canonical, ogType }: SEOProps) {
  useEffect(() => {
    updatePageSEO({ title, description, canonical, ogType });
  }, [title, description, canonical, ogType]);
}

export const PageSEO: React.FC<SEOProps> = (props) => {
  usePageSEO(props);
  return null;
};
