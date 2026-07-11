export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Naruhodo!"
    >
      <rect width="64" height="64" rx="18" fill="#3b82f6" />
      <path
        d="M20 24c0-4.4 3.6-8 8-8h8c4.4 0 8 3.6 8 8v6c0 4.4-3.6 8-8 8h-9l-6 6v-6c-.6 0-1-.4-1-1v-13Z"
        fill="white"
      />
      <circle cx="27" cy="27" r="2.2" fill="#3b82f6" />
      <circle cx="37" cy="27" r="2.2" fill="#3b82f6" />
      <path
        d="M46 14c1.2 2 1.2 4.4 0 6.4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M50.5 11c2 3.4 2 7.6 0 11"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
