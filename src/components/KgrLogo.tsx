import React from 'react';

const logo = `${import.meta.env.BASE_URL}kg-reddy-logo.png`;

export function KgrLogo({ variant = 'full', light = false }: { variant?: 'full' | 'compact' | 'mini'; light?: boolean }) {
  return <div className={'collegeLogo ' + (light ? 'light ' : '') + variant}>
    {logo && <img src={logo} alt="KG Reddy College of Engineering & Technology"/>}
    {variant !== 'mini' && <div><strong>KG REDDY</strong><span>College of Engineering &amp; Technology</span><small>Campus Library</small></div>}
  </div>;
}
