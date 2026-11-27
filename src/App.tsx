import React from 'react';
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, Phone, Truck, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://nath-vintage-api.onrender.com';
const WHATSAPP = '233206394909';
const PHONE = '+233 591 986 831';
const EMAIL = 'nyamedeenterprise@gmail.com';
const FALLBACK_COLLECTIONS = [
  { name: 'Vintage & Retro Jerseys', tag: 'LEGENDS NEVER FADE', image: 'https://imagedelivery.net/8UvgnujKc71BuSRDtL99OQ/84b8e8fc-ac14-4ee6-3bc4-574f6979e600/2x2desktop' },
  { name: 'Current Jerseys', tag: 'MATCH DAY READY', image: 'https://store.acmilan.com/cdn/shop/files/1500x1000_5_2_c3b2d958-efd7-47a7-843e-6d94a698fb7e.jpg?v=1716444381' },
  { name: 'Sneakers', tag: 'STEP INTO YOUR STYLE', image: 'https://nubiantokyo.com/cdn/shop/files/25AW_BR_ASAP-Rocky_October_032_RGB_1800x.jpg?v=1759406224' },
  { name: 'Birkenstock & Slides', tag: 'OFF-DUTY COMFORT', image: 'https://thh2.ca/cdn/shop/files/25SS_Timeless_Favourites_PI_1011074_4918-medium.jpg?v=1770142927&width=1800' },
  { name: 'Hoodies', tag: 'LAYER UP', image: 'https://vandal-style.com/cdn/shop/files/ChatGPT_Image_Feb_7_2026_03_18_50_PM.png?v=1770474586' },
  { name: 'Football Boots', tag: 'BUILT FOR THE GAME', image: 'https://thumblr.uniid.it/images/1768398525-index-puma-whitengold-pack.jpegquality-100.png?format=webp&q=85&width=1800' },
  { name: 'Leather Shoes', tag: 'POLISHED EVERYDAY STYLE', image: 'https://stanleyandcooper.com/cdn/shop/files/20260126_1655_ImageGeneration_remix_01kfy4tz5bf9x9ajsx5nvhwm6y_1.png?v=1769465212&width=1800' },
  { name: 'Timberland Boots', tag: 'BUILT TO STAND OUT', image: 'https://www.tradeinn.com/f/14009/140096520/timberland-bottes-6-premium.webp' },
  { name: 'Vintage Denim', tag: 'CLASSIC DENIM. FRESH LOOK.', image: 'https://cameleonpunch.com/web/product/big/202303/4db8a26a1febca606d86c1e5b1a26418.jpg' }
];
type Product = {
  id: string | number; name: string; category: string; description?: string; price?: number | string | null;
  image_url?: string; image_urls?: string[]; is_available?: boolean | string; is_published?: boolean | string;
};
const transitionImages = FALLBACK_COLLECTIONS.slice(0, 6).map(item => item.image);
const normalize = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const money = (value: Product['price']) => value === null || value === undefined || value === '' ? '' : 'GH₵ ' + Number(value).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const photos = (p: Product) => p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : [];
const wa = (message = 'Hello Nath Vintage Hub, I would like to make an enquiry.') => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);

function OpeningGrid() {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2450);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="opening-grid" aria-label="Nath Vintage Hub opening transition">
    <div className="opening-grid-cells">{Array.from({ length: 20 }, (_, i) => <span key={i} style={{ '--tile-image': `url("${transitionImages[i % transitionImages.length]}")`, animationDelay: `${.78 + i * .035}s` } as React.CSSProperties} />)}</div>
    <div className="opening-grid-brand"><span className="opening-monogram">NVH</span><span>NATH VINTAGE HUB</span><small>THE CULTURE. THE CLASSICS. THE FIT.</small></div>
    <div className="opening-grid-index">ACCRA · GHANA <b> / </b> EST. FOR THE CULTURE</div>
  </div>;
}

type CollectionCard = { name: string; tag: string; image: string };

function CollectionTile({ item, index, onSelect }: { item: CollectionCard; index: number; onSelect: () => void }) {
  const tileRef = React.useRef<HTMLButtonElement>(null);
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    const node = tileRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) { setRevealed(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); }
    }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <button ref={tileRef} className={revealed ? 'collection-tile is-visible' : 'collection-tile'} style={{ '--tile-index': index } as React.CSSProperties} onClick={onSelect}>
    <div className="collection-photo"><img src={item.image} loading="lazy" alt={item.name}/><span className="collection-number">{String(index + 1).padStart(2, '0')}</span><span className="collection-arrow"><ArrowUpRight/></span><span className="collection-image-wash"/></div>
    <div className="collection-meta"><small>{item.tag}</small><strong>{item.name}</strong><span>EXPLORE <b>↗</b></span></div>
  </button>;
}

export default function App() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('ALL');
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [mobileMenu, setMobileMenu] = React.useState(false);

  const loadProducts = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(API + '/api/products', { cache: 'no-store' });
      if (!response.ok) throw new Error('The product service returned ' + response.status + '.');
      const data = await response.json();
      if (!Array.isArray(data?.products)) throw new Error('The product catalogue returned an unexpected response.');
      setProducts(data.products.filter((p: Product) => p.is_published !== false && p.is_published !== 'false'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the product catalogue.');
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { loadProducts(); }, [loadProducts]);

  const categories = React.useMemo(() => {
    const live = [...new Set(products.filter(p => p.is_available !== false && p.is_available !== 'false').map(p => p.category).filter(Boolean))];
    return live.length ? live : FALLBACK_COLLECTIONS.map(c => c.name);
  }, [products]);
  const collectionCards = React.useMemo(() => categories.map((name, i) => {
    const match = products.find(p => normalize(p.category) === normalize(name) && photos(p)[0]);
    const fallback = FALLBACK_COLLECTIONS.find(c => normalize(c.name) === normalize(name));
    return { name, tag: fallback?.tag || 'THE NVH SELECTION', image: fallback?.image || photos(match || {} as Product)[0] || FALLBACK_COLLECTIONS[i % FALLBACK_COLLECTIONS.length].image };
  }), [categories, products]);
  const visibleProducts = products.filter(p =>
    p.is_available !== false && p.is_available !== 'false' &&
    (activeCategory === 'ALL' || normalize(p.category) === normalize(activeCategory))
  );

  const openCollection = (name: string) => {
    setActiveCategory(name);
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openProduct = (product: Product) => { setSelectedProduct(product); setPhotoIndex(0); };
  const productPhotos = selectedProduct ? photos(selectedProduct) : [];

  return <div className="nvh-onepage">
    <OpeningGrid />
    <div className="topline"><span>QUALITY FINDS. WORLDWIDE DELIVERY.</span><span>ACCRA, GHANA <i>✳</i> SHIPPING EVERYWHERE</span></div>
    <header className="site-nav">
      <a className="brand" href="#home" aria-label="Nath Vintage Hub home"><span className="brand-mark">NVH</span><span className="brand-name">NATH VINTAGE HUB<small>SURE TO DELIVER.</small></span></a>
      <button className="mobile-menu-toggle" onClick={() => setMobileMenu(v => !v)} aria-label="Toggle navigation">{mobileMenu ? <X/> : <span>☰</span>}</button>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}>
        <a href="#collections" onClick={() => setMobileMenu(false)}>Collections</a><a href="#shop" onClick={() => setMobileMenu(false)}>Shop all</a><a href="#story" onClick={() => setMobileMenu(false)}>Our standard</a><a href="#contact" onClick={() => setMobileMenu(false)}>Contact</a>
      </nav>
      <a className="nav-cta" href={wa()} target="_blank" rel="noreferrer">SHOP WITH US <ArrowUpRight size={16}/></a>
    </header>

    <main id="home">
      <section className="hero-onepage">
        <div className="hero-backdrop-word">VINTAGE</div>
        <div className="hero-copy">
          <div className="eyebrow"><span/> THE CULTURE. THE CLASSICS. THE FIT.</div>
          <h1>BUY QUALITY.<br/><em>WEAR THE</em><br/>DIFFERENCE<span>.</span></h1>
          <p>From timeless football classics to everyday streetwear essentials — find your next favourite fit at Nath Vintage Hub.</p>
          <div className="hero-actions"><a className="button-red" href="#collections">EXPLORE THE COLLECTIONS <ArrowUpRight size={17}/></a><a className="hero-text-link" href={wa()} target="_blank" rel="noreferrer">TALK TO US <ArrowUpRight size={15}/></a></div>
          <div className="hero-meta"><span>01 — THE NVH EDIT</span><span>CURATED FOR YOUR CULTURE</span></div>
        </div>
        <div className="hero-image-wrap">
          <div className="hero-image-main"><img src="https://raw.githubusercontent.com/mrallotey/NATH-VINTAGE-HUB/main/nath%20flyer.jfif" alt="Nath Vintage Hub fashion collection" fetchPriority="high"/></div>
          <div className="hero-image-label"><b>NVH</b><span>EST. FOR THE CULTURE</span></div>
          <div className="hero-image-index">GH <b>•</b> 001</div>
          <div className="hero-image-caption">VINTAGE ENERGY / EVERYDAY STYLE</div>
        </div>
        <a className="scroll-cue" href="#collections"><span>SCROLL TO EXPLORE</span><ArrowDown size={15}/></a>
      </section>

      <section className="collections-onepage" id="collections">
        <div className="section-heading"><div><span className="eyebrow"><i/> THE LINE-UP</span><h2>FIND YOUR <em>ROTATION.</em></h2></div><p>Pieces with character. Everyday essentials.<br/>A little something for every side of you.</p></div>
        <div className="collection-grid">{collectionCards.map((item, i) => <CollectionTile item={item} index={i} key={item.name} onSelect={() => openCollection(item.name)} />)}</div>
      </section>

      <section className="shop-onepage" id="shop">
        <div className="shop-heading"><div><span className="eyebrow"><i/> SHOP THE DROP</span><h2>{activeCategory === 'ALL' ? <>THE LATEST <em>FINDS.</em></> : <>{activeCategory.toUpperCase()} <em>EDIT.</em></>}</h2></div><div className="shop-controls"><button className={activeCategory === 'ALL' ? 'filter active' : 'filter'} onClick={() => setActiveCategory('ALL')}>ALL ITEMS</button>{categories.map(c => <button key={c} className={activeCategory === c ? 'filter active' : 'filter'} onClick={() => setActiveCategory(c)}>{c}</button>)}</div></div>
        {loading && <div className="catalogue-state">LOADING THE LINE-UP<span>...</span></div>}
        {!loading && error && <div className="catalogue-state"><p>We couldn't load the live catalogue. Your products have not been removed.</p><small>{error}</small><button className="button-red" onClick={loadProducts}>TRY AGAIN</button></div>}
        {!loading && !error && visibleProducts.length === 0 && <div className="catalogue-state">No available products in this collection just yet. Check back soon.</div>}
        {!loading && !error && visibleProducts.length > 0 && <div className="live-product-grid">{visibleProducts.map((p, i) => <button className="live-product-card" key={p.id} onClick={() => openProduct(p)}><div className="live-product-photo">{photos(p)[0] ? <img src={photos(p)[0]} alt={p.name} loading="lazy"/> : <div className="no-photo">NVH</div>}<span className="live-product-index">0{i + 1}</span><span className="live-product-open"><ArrowUpRight/></span></div><div className="live-product-info"><small>{p.category}</small><strong>{p.name}</strong><div><b>{money(p.price)}</b><span>VIEW DETAILS ↗</span></div></div></button>)}</div>}
      </section>

      <section className="story-onepage" id="story"><div className="story-image"><img src="https://raw.githubusercontent.com/mrallotey/NATH-VINTAGE-HUB/main/nath%20flyer.jfif" alt="Nath Vintage Hub edit" loading="lazy"/></div><div className="story-copy"><span className="eyebrow"><i/> THE NVH STANDARD</span><h2>GOOD FINDS.<br/><em>GOOD FEELING.</em></h2><p>We bring together jerseys, footwear and sportswear for people who know what they like. Whether you are chasing a classic shirt or refreshing your everyday rotation, we are here to help you find it.</p><ul><li>QUALITY-FOCUSED SELECTION</li><li>CUSTOMISATION AVAILABLE</li><li>WORLDWIDE DELIVERY</li><li>PERSONAL SERVICE, EVERY TIME</li></ul><a href={wa('Hello Nath Vintage Hub, I would like to ask about your collections.')} target="_blank" rel="noreferrer" className="story-link">GET IN TOUCH <ArrowUpRight/></a></div></section>

      <section className="contact-onepage" id="contact"><div className="contact-copy"><span className="eyebrow"><i/> READY WHEN YOU ARE</span><h2>LET'S GET YOU<br/><em>THE RIGHT FIT.</em></h2><p>Found something you love? Have a question? Reach out and let's make it happen.</p><a className="button-red" href={wa()} target="_blank" rel="noreferrer"><MessageCircle size={18}/> CHAT ON WHATSAPP <ArrowUpRight size={17}/></a></div><div className="contact-details"><div><small>CALL US</small><a href="tel:+233591986831"><Phone/>{PHONE}</a></div><div><small>WHATSAPP</small><a href={wa()} target="_blank" rel="noreferrer"><MessageCircle/>+233 206 394 909</a></div><div><small>EMAIL US</small><a href={'mailto:' + EMAIL}>{EMAIL}</a></div><div><small>DELIVERY</small><span><Truck/> WORLDWIDE DELIVERY</span></div></div></section>
    </main>
    <footer className="site-footer"><a className="footer-brand" href="#home">NVH <span>NATH VINTAGE HUB</span></a><span>BUY QUALITY. WEAR THE DIFFERENCE.</span><span>© {new Date().getFullYear()} NATH VINTAGE HUB</span><a href="/privacy-policy.html">PRIVACY</a><a href="/terms-and-conditions.html">TERMS</a><a href="#home">BACK TO TOP ↑</a></footer>
    <a className="floating-whatsapp" href={wa()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><MessageCircle/></a>

    {selectedProduct && <div className="product-modal" role="dialog" aria-modal="true" aria-label={selectedProduct.name} onMouseDown={e => { if (e.target === e.currentTarget) setSelectedProduct(null); }}><section className="product-modal-panel"><button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Close product details"><X/></button><div className="modal-gallery">{productPhotos[photoIndex] ? <img className="modal-main-photo" src={productPhotos[photoIndex]} alt={selectedProduct.name}/> : <div className="no-photo">NVH</div>}{productPhotos.length > 1 && <div className="modal-thumbs">{productPhotos.map((src, i) => <button className={i === photoIndex ? 'selected' : ''} key={src} onClick={() => setPhotoIndex(i)}><img src={src} alt={selectedProduct.name + ' view ' + (i + 1)}/></button>)}</div>}</div><div className="modal-product-copy"><small>{selectedProduct.category}</small><h2>{selectedProduct.name}</h2>{money(selectedProduct.price) && <strong>{money(selectedProduct.price)}</strong>}<p>{selectedProduct.description || 'Contact Nath Vintage Hub for more details about this item.'}</p><a className="button-red" href={wa('Hello Nath Vintage Hub, I am interested in ' + selectedProduct.name + (money(selectedProduct.price) ? ' (' + money(selectedProduct.price) + ')' : '') + '. Is it available?')} target="_blank" rel="noreferrer"><MessageCircle/> ENQUIRE ON WHATSAPP <ArrowUpRight/></a><span className="availability">{selectedProduct.is_available === false || selectedProduct.is_available === 'false' ? 'CURRENTLY UNAVAILABLE' : 'AVAILABLE NOW'}</span>{productPhotos.length > 1 && <div className="modal-arrows"><button onClick={() => setPhotoIndex(i => (i - 1 + productPhotos.length) % productPhotos.length)}><ChevronLeft/></button><button onClick={() => setPhotoIndex(i => (i + 1) % productPhotos.length)}><ChevronRight/></button></div>}</div></section></div>}
  </div>;
}
