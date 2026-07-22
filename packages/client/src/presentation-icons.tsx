import type { ReactElement, ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> &
  Readonly<{
    children: ReactNode;
  }>;

const Icon = ({ children, ...props }: IconProps): ReactElement => (
  <svg
    aria-hidden="true"
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
    {...props}
  >
    {children}
  </svg>
);

export const PreviousIcon = (): ReactElement => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const NextIcon = (): ReactElement => (
  <Icon>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const OverviewIcon = (): ReactElement => (
  <Icon>
    <rect height="5" rx="1" width="7" x="3" y="4" />
    <rect height="5" rx="1" width="7" x="14" y="4" />
    <rect height="5" rx="1" width="7" x="3" y="15" />
    <rect height="5" rx="1" width="7" x="14" y="15" />
  </Icon>
);

export const SpeakerIcon = (): ReactElement => (
  <Icon>
    <path d="M5 19h14M8 19v-4h8v4M6 5h12v10H6z" />
    <path d="m10 8 4 2-4 2z" fill="currentColor" stroke="none" />
  </Icon>
);

export const DocumentIcon = (): ReactElement => (
  <Icon>
    <path d="M6 3h9l3 3v15H6zM15 3v4h3M9 11h6M9 15h6" />
  </Icon>
);

export const ShareIcon = (): ReactElement => (
  <Icon>
    <rect height="11" rx="2" width="11" x="9" y="4" />
    <path d="M15 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </Icon>
);

export const FullscreenIcon = ({ active }: Readonly<{ active: boolean }>): ReactElement => (
  <Icon>
    {active ? (
      <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" />
    ) : (
      <path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" />
    )}
  </Icon>
);

export const HelpIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.8 9.2a2.35 2.35 0 1 1 3.04 2.24c-.84.3-.84.9-.84 1.56" />
    <circle cx="12" cy="16.5" fill="currentColor" r="1" stroke="none" />
  </Icon>
);

export const FocusIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" fill="currentColor" r="2.6" stroke="none" />
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

export const LaserIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" fill="currentColor" r="3" stroke="none" />
    <circle cx="12" cy="12" r="7" />
  </Icon>
);

export const PenIcon = (): ReactElement => (
  <Icon>
    <path d="m5 19 1.2-4.4L15.8 5a2.1 2.1 0 0 1 3 3l-9.6 9.6L5 19Z" />
    <path d="m14.4 6.4 3.2 3.2" />
  </Icon>
);

export const HighlighterIcon = (): ReactElement => (
  <Icon>
    <path d="m7 15 8.8-10 3.2 3.2L9 17H7v-2Z" />
    <path d="M5 20h14M11 13l3 3" />
  </Icon>
);

export const UndoIcon = (): ReactElement => (
  <Icon>
    <path d="M9 7 5 11l4 4M6 11h7a5 5 0 0 1 5 5v1" />
  </Icon>
);

export const ClearIcon = (): ReactElement => (
  <Icon>
    <path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5" />
  </Icon>
);

export const CloseIcon = (): ReactElement => (
  <Icon>
    <path d="m7 7 10 10M17 7 7 17" />
  </Icon>
);

export const ClockIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const PauseIcon = (): ReactElement => (
  <Icon>
    <path d="M9 7v10M15 7v10" />
  </Icon>
);

export const PlayIcon = (): ReactElement => (
  <Icon>
    <path d="m9 7 8 5-8 5Z" />
  </Icon>
);

export const ResetIcon = (): ReactElement => (
  <Icon>
    <path d="M4 10a8 8 0 1 1 2 7M4 10V5m0 5h5" />
  </Icon>
);

export const AudienceIcon = (): ReactElement => (
  <Icon>
    <rect height="13" rx="2" width="18" x="3" y="4" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
);

export const ExternalIcon = (): ReactElement => (
  <Icon>
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);
