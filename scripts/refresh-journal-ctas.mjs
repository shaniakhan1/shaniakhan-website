import fs from 'node:fs';
import path from 'node:path';

const root = '/home/ubuntu/shaniakhan-website-source/blog';
const modules = {
  'frequency-planner': {
    title: 'Put the practice on the page.',
    copy: 'The Soft60 Guide is a practical companion for building a softer, more intentional rhythm—one page at a time.',
    cta: 'Explore the Soft60 Guide',
    href: 'https://payhip.com/b/yxfnl',
  },
  'goodbye-theory-explained': {
    title: 'Keep reading when the ending asks more of you.',
    copy: 'The digital edition of The Goodbye Theory gives these ideas a place to live beyond the page you are on now.',
    cta: 'Read The Goodbye Theory',
    href: 'https://payhip.com/b/shZLD',
  },
  'luxury-nervous-system': {
    title: 'Start with the state you are living from.',
    copy: 'Soft60 is a 60-day practice for creating more room in your nervous system before asking more of yourself.',
    cta: 'Take the Soft60 Assessment',
    href: 'https://app.frequencyplanner.com/frequency',
  },
  'nervous-system-and-money': {
    title: 'Let your money practice have a place to land.',
    copy: 'The Wealth Is a Frequency planner turns the work of standards, pricing, and capacity into a practice you can return to.',
    cta: 'Explore the Wealth Planner',
    href: 'https://payhip.com/b/xlAZk',
  },
  'rich-grandma-energy': {
    title: 'Bring the idea home with you.',
    copy: 'Rich Grandma Energy is available as a digital edition for the moments when you want to return to your standards and your own voice.',
    cta: 'Read Rich Grandma Energy',
    href: 'https://payhip.com/b/nutLQ',
  },
  'soft60-app': {
    title: 'Begin with the practice, not another promise.',
    copy: 'The Soft60 assessment will help you choose a starting point inside the existing 60-day experience.',
    cta: 'Take the Soft60 Assessment',
    href: 'https://app.frequencyplanner.com/frequency',
  },
  'wealth-identity': {
    title: 'Give your wealth identity somewhere to become visible.',
    copy: 'The Wealth Is a Frequency planner is a set of prompts and practical pages for the money conversation you want to have with yourself.',
    cta: 'Explore the Wealth Planner',
    href: 'https://payhip.com/b/xlAZk',
  },
  'what-is-soft-power': {
    title: 'Put soft power into practice.',
    copy: 'Explore the collection for books, guides, and planners that make the ideas on this page useful in an ordinary day.',
    cta: 'Shop the Collection',
    href: '/shop/',
  },
  'why-i-stopped-hustling': {
    title: 'Build a different relationship with your day.',
    copy: 'Soft60 is a calm place to begin when you are ready to move out of urgency and into a more sustainable practice.',
    cta: 'Explore Soft60',
    href: '/soft60/',
  },
  'womens-mastermind-2026': {
    title: 'Looking for a more personal room?',
    copy: 'Private Advisory is the current way to bring a real decision, brand shift, or next chapter into a focused conversation with Shania.',
    cta: 'Explore Private Advisory',
    href: '/consult/',
  },
};

const nav = `<div class="nav-links">\n    <a href="/shop/">Shop</a>\n    <a href="/soft60/">Soft60</a>\n    <a href="/blog/">Journal</a>\n  </div>`;
const footer = `<span><a href="/shop/">Shop the Collection</a> &nbsp;&middot;&nbsp; <a href="/soft60/">Soft60</a> &nbsp;&middot;&nbsp; <a href="https://substack.com/@iamshaniakhan" target="_blank" rel="noopener">Substack</a></span>`;

let changed = 0;
for (const [slug, module] of Object.entries(modules)) {
  const file = path.join(root, slug, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const cta = `<div class="post-cta">\n  <p>${module.title} ${module.copy}</p>\n  <a href="${module.href}" class="btn"${module.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${module.cta}</a>\n</div>`;

  html = html.replace(/<div class="nav-links">[\s\S]*?<\/div>/, nav);
  html = html.replace(/<div class="post-cta">[\s\S]*?<\/div>/, cta);
  html = html.replace(/<span><a href="\/mastermind\/">[\s\S]*?<\/span>/, footer);
  html = html.replace(/<p>If you want to go deeper, the Soft Power Mastermind[\s\S]*?<\/p>/, '<p>If you want a guided place to begin, take the Soft60 assessment. It will give you a clear starting point inside the existing experience.</p>');

  fs.writeFileSync(file, html);
  changed += 1;
}
console.log(`Updated ${changed} Journal article templates.`);
