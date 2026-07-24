/**
 * One consistent line-icon set (1.6px strokes, 24px grid, rounded joins).
 * Replaces the emoji that were standing in for icons — emoji render
 * differently on every platform and read as placeholder art.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);

export const FilmIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="M7 4.5v15M17 4.5v15M2.5 12h19M2.5 8.2h4.5M2.5 15.8h4.5M17 8.2h4.5M17 15.8h4.5" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="M15.5 10.5 21.5 7v10l-6-3.5" />
  </Icon>
);

export const ScreenIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
    <path d="M8.5 21h7M12 17v4" />
  </Icon>
);

export const DevicesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="12" height="10" rx="2" />
    <rect x="16" y="9" width="5.5" height="10.5" rx="1.8" />
    <path d="M6 18.5h5" />
  </Icon>
);

export const GamepadIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="7" width="20" height="10.5" rx="4.5" />
    <path d="M7 10.75v3M5.5 12.25h3M15.6 11.4h.01M18.2 13.4h.01" />
  </Icon>
);

export const ChessIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a2.4 2.4 0 0 0-2.4 2.4c0 .9.5 1.7 1.2 2.1L9 12h6l-1.8-4.5c.7-.4 1.2-1.2 1.2-2.1A2.4 2.4 0 0 0 12 3Z" />
    <path d="M8.5 12h7l-.8 5h-5.4l-.8-5ZM7 21h10l-.6-4H7.6L7 21Z" />
  </Icon>
);

export const DiceIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8.4 8.4h.01M15.6 8.4h.01M12 12h.01M8.4 15.6h.01M15.6 15.6h.01" strokeWidth={2.4} />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.4 1.4" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0L5.5 13.3a4 4 0 1 0 5.7 5.7l1.4-1.4" />
  </Icon>
);

export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5ZM18.5 16l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
  </Icon>
);
