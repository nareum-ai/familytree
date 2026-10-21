/**
 * 선 아이콘 모음 (24px 격자, currentColor).
 * 크기는 글자 크기(1em)를 따르므로 감싸는 요소의 font-size로 조절한다.
 */
const PATHS = {
  tree:        <><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M5 16.5V14h14v2.5M12 11.5v2.5"/></>,
  user:        <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
  family:      <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8 0 5 2.2 5 5"/></>,
  hand:        <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4.3 15a1.5 1.5 0 0 1 2.4-1.8L8 15"/></>,
  search:      <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  plus:        <path d="M12 5v14M5 12h14"/>,
  edit:        <><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></>,
  trash:       <><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></>,
  camera:      <><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>,
  lock:        <><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></>,
  unlock:      <><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/></>,
  key:         <><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/></>,
  shield:      <><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></>,
  link:        <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>,
  mail:        <><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></>,
  inbox:       <><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></>,
  chat:        <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>,
  phone:       <><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></>,
  install:     <><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/></>,
  laptop:      <><rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/></>,
  ring:        <><circle cx="12" cy="14.5" r="6"/><path d="M9.5 4h5l1.5 2.5-4 3-4-3z"/></>,
  calendar:    <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  cake:        <><path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 12V8M12 5.5a1 1 0 0 0 0-2"/></>,
  candle:      <><rect x="9" y="10" width="6" height="11" rx="1"/><path d="M12 10V8M12 7c-1.2-1-1.2-2.6 0-4 1.2 1.4 1.2 3 0 4z"/></>,
  scroll:      <><path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11M9 9h4M9 13h4"/></>,
  sparkle:     <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></>,
  bell:        <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></>,
  'bell-off':  <><path d="M8.7 3.9A6 6 0 0 1 18 8c0 3.4.7 5.6 1.5 7M17 17H3s3-2 3-9c0-.6.1-1.1.2-1.6"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M3 3l18 18"/></>,
  help:        <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.1"/></>,
  bulb:        <><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></>,
  alert:       <><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.3v.1"/></>,
  check:       <><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></>,
  cancel:      <><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>,
  ban:         <><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></>,
  hourglass:   <><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/></>,
  book:        <><path d="M4 5a2 2 0 0 1 2-2h6v17H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/></>,
  globe:       <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/></>,
  gear:        <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></>,
  wrench:      <path d="M14.5 4a4.5 4.5 0 0 0-4.3 5.8L4 16v4h4l6.2-6.2A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-.5-.5-3L16.5 6A4.5 4.5 0 0 0 14.5 4z"/>,
  megaphone:   <><path d="M4 10v4h3l8 5V5L7 10z"/><path d="M18 9a4 4 0 0 1 0 6M7 14l1.5 6h3L10 15"/></>,
  note:        <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/></>,
  clipboard:   <><rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/></>,
  folder:      <path d="M3 6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  upload:      <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v5h16v-5"/></>,
  download:    <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4 15v5h16v-5"/></>,
  share:       <><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8 11H6v10h12V11h-2"/></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24" width="1em" height="1em"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
