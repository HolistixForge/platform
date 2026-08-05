// Frontend UI components
export const platformRunnerFrontend = {
  icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path
        d="M6.5 18.5a4 4 0 0 1-.4-7.98 5.5 5.5 0 0 1 10.66-1.9A3.75 3.75 0 0 1 17.5 18.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 11v5m0 0-2-2m2 2 2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  label: 'Platform',
  UI: () => <div>Runs on the platform</div>,
};
