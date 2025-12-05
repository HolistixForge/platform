// Frontend UI components
export const localRunnerFrontend = {
  icon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="2" y="18" width="20" height="2" rx="1" fill="currentColor" />
      <rect
        x="8"
        y="15"
        width="8"
        height="1.5"
        rx="0.75"
        fill="currentColor"
        opacity="0.25"
      />
    </svg>
  ),
  label: 'Local',
  UI: () => <div>Local</div>,
};
