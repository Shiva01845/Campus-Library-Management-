export function KgrLogo({ variant = 'full', light = false }: { variant?: 'full' | 'compact' | 'mini'; light?: boolean }) {
  return <div className={'collegeLogo ' + (light ? 'light ' : '') + variant}>
    <img src="/kg-reddy-logo.png" alt="KG Reddy College of Engineering & Technology"/>
    {variant !== 'mini' && <div><small>Campus Library</small></div>}
  </div>;
}
