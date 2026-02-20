import { useId } from "react"

interface Props {
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: { icon: 32, gap: "gap-2", text: "text-lg" },
  md: { icon: 42, gap: "gap-3", text: "text-xl" },
  lg: { icon: 54, gap: "gap-3", text: "text-2xl" },
}

export default function PredictpyLogo({ size = "md" }: Props) {
  const { icon, gap, text } = SIZES[size]
  const uid = useId().replace(/:/g, "")

  return (
    <div className={`flex items-center ${gap}`}>
      {/* Icon */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${uid}-bg`}
            x1="0" y1="0" x2="40" y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#7c3aed" />
            <stop offset="0.5" stopColor="#a21caf" />
            <stop offset="1" stopColor="#db2777" />
          </linearGradient>
          <linearGradient
            id={`${uid}-glow`}
            x1="0" y1="0" x2="40" y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c4b5fd" stopOpacity="0.15" />
            <stop offset="1" stopColor="#f9a8d4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="40" height="40" rx="10" fill={`url(#${uid}-bg)`} />
        {/* Inner glow highlight */}
        <rect width="40" height="40" rx="10" fill={`url(#${uid}-glow)`} />

        {/* Dashed trend line */}
        <line
          x1="5" y1="34" x2="36" y2="6"
          stroke="white" strokeOpacity="0.28"
          strokeWidth="1.5" strokeDasharray="3 2.5"
          strokeLinecap="round"
        />

        {/* Data points — trending upward */}
        <circle cx="8"  cy="31" r="2.6" fill="white" fillOpacity="0.95" />
        <circle cx="15" cy="25" r="2.6" fill="white" fillOpacity="0.95" />
        <circle cx="22" cy="18" r="2.6" fill="white" fillOpacity="0.95" />
        <circle cx="29" cy="12" r="2.6" fill="white" fillOpacity="0.95" />

        {/* Predicted future point — hollow/ghost */}
        <circle
          cx="35" cy="7" r="2.4"
          stroke="white" strokeOpacity="0.7" strokeWidth="1.5"
          fill="white" fillOpacity="0.12"
        />

        {/* Arrow tip at prediction point */}
        <path
          d="M30.5 4.5 L35.5 7 L33 11.5"
          stroke="white" strokeOpacity="0.9"
          strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Wordmark */}
      <span className={`${text} font-bold tracking-tight leading-none`}>
        <span className="text-zinc-100">Predict</span>
        <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          Py
        </span>
      </span>
    </div>
  )
}
