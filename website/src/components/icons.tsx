import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  "aria-hidden": true,
  fill: "none",
  height: 18,
  viewBox: "0 0 24 24",
  width: 18,
} as const;

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.6" width="12" x="8" y="8" />
      <path
        d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function GithubIcon(props: IconProps) {
  return (
    <svg {...iconProps} fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .8a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.2.8-.5v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.7.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.6 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.1 1.2a10.7 10.7 0 0 1 5.7 0c2.2-1.5 3.1-1.2 3.1-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.3-5.4 5.6.5.4.9 1.1.9 2.2v3.1c0 .3.2.6.8.5A11.4 11.4 0 0 0 12 .8Z" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m8 5 11 7-11 7V5Z" fill="currentColor" />
    </svg>
  );
}
