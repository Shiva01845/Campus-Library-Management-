import React from 'react';

// When the official image is supplied in assets/, use that file unchanged.
const images = import.meta.glob('../assets/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const logo = Object.entries(images).find(([path]) => /logo|kgr|kg[-_ ]?reddy/i.test(path))?.[1] || Object.values(images)[0];

export function KgrLogo({ variant = 'full', light = false }: { variant?: 'full' | 'compact' | 'mini'; light?: boolean }) {
  return <div className={'collegeLogo ' + (light ? 'light ' : '') + variant}>
    {logo && <img src={logo} alt="KG Reddy College of Engineering & Technology"/>}
    {variant !== 'mini' && <div><strong>KG REDDY</strong><span>College of Engineering &amp; Technology</span><small>Campus Library</small></div>}
  </div>;
}
