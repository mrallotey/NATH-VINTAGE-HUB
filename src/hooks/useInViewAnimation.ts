import { useEffect } from 'react';

export function useInViewAnimation(selector = '.hero-copy,.hero-visual,.section-head,.product-card,.promise-image,.promise-copy,.custom-banner,.contact-top,.contact-details,.nvh-editorial,.nvh-shop-path,.nvh-featured,.nvh-partner') {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    nodes.forEach((node) => {
      node.classList.add('reveal-up');
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, [selector]);
}
