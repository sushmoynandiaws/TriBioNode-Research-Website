const shapes = {
  replay: <path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  plus: <path d="M12 4v16M4 12h16" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  pause: <path d="M8 4v16M16 4v16" />,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  up: <path d="M12 20V4m-6 6 6-6 6 6" />,
  molecule: <><path d="m6 7 11 3-6 9-5-12" /><circle cx="6" cy="7" r="3" /><circle cx="17" cy="10" r="3" /><circle cx="11" cy="19" r="2" /></>,
  geometry: <><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10" /></>,
  sparkles: <><path d="m12 3 1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3Z" /><path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" /></>,
}

export default function Icon({ name, size = 18 }: { name: keyof typeof shapes; size?: number }) {
  return <svg className="ui-icon" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>
}
