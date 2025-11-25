export const Logo = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => (
  <svg
    width={props.width ?? 40}
    height={props.height ?? 40}
    viewBox="0 0 67.734 67.734"
    xmlSpace="preserve"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      style={{
        fill: "none",
        fillOpacity: 1,
        stroke: fill ?? "#1a7ef6",
        strokeWidth: 7.44375,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: 4,
        strokeDasharray: "none",
        strokeOpacity: 1,
      }}
      d="m10.805 22.263 14.196 11.604L10.805 45.47"
      transform="translate(2.472 2.472)scale(.927)"
    />
    <path
      style={{
        fill: "none",
        fillOpacity: 1,
        stroke: fill ?? "#ffd806",
        strokeWidth: 7.44375,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: 4,
        strokeDasharray: "none",
        strokeOpacity: 1,
      }}
      d="m27.263 22.263 7.465 6.222m.07 10.616-7.535 6.369"
      transform="translate(2.472 2.472)scale(.927)"
    />
    <path
      style={{
        fill: "none",
        fillOpacity: 1,
        stroke: fill ?? "#ff2e55",
        strokeWidth: 7.44375,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: 4,
        strokeDasharray: "none",
        strokeOpacity: 1,
      }}
      d="m42.733 22.263 14.195 11.604L42.733 45.47"
      transform="translate(2.472 2.472)scale(.927)"
    />
  </svg>
);
