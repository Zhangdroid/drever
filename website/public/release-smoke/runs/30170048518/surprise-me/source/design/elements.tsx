import { useId } from 'react'

export function LookbackDial() {
  const glowId = useId().replace(/:/g, '')
  return (
    <figure className="lookback-dial">
      <svg viewBox="0 0 560 440" role="img" aria-label="Every visible object is seen at a different lookback time">
        <title>Three concentric lookback rings centered on an observer</title>
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f3f7f5" stopOpacity="1" />
            <stop offset="45%" stopColor="#72e6e1" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#72e6e1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform="translate(280 220)">
          <circle r="174" className="dial-ring dial-ring--far" />
          <circle r="116" className="dial-ring" />
          <circle r="64" className="dial-ring" />
          <path d="M0 -174 L0 -193" className="dial-tick" />
          <path d="M116 0 L134 0" className="dial-tick" />
          <path d="M-64 0 L-80 0" className="dial-tick" />
          <circle r="46" fill={`url(#${glowId})`} />
          <circle r="7" className="observer-dot" />
          <text x="0" y="28" textAnchor="middle" className="dial-you">YOU · NOW</text>
          <g className="dial-label" transform="translate(-58 -54)">
            <text textAnchor="end">MOON</text>
            <text y="18" textAnchor="end" className="dial-value">1.3 sec ago</text>
          </g>
          <g className="dial-label" transform="translate(138 -8)">
            <text>SUN</text>
            <text y="18" className="dial-value">8 min 20 sec ago</text>
          </g>
          <g className="dial-label" transform="translate(-128 -144)">
            <text textAnchor="end">ANDROMEDA</text>
            <text y="18" textAnchor="end" className="dial-value">2.5 million years ago</text>
          </g>
        </g>
      </svg>
      <figcaption>Every ring is both a distance and a date.</figcaption>
    </figure>
  )
}

export function PhotonMessage() {
  const trailId = useId().replace(/:/g, '')
  return (
    <figure className="photon-message">
      <svg viewBox="0 0 720 300" role="img" aria-label="A photon carries an earlier image from a star to an observer">
        <title>A photon travels from a star to an observer, carrying an old image</title>
        <defs>
          <linearGradient id={trailId} x1="0" x2="1">
            <stop offset="0" stopColor="#ffc56e" stopOpacity="0.05" />
            <stop offset="0.55" stopColor="#ffc56e" stopOpacity="0.42" />
            <stop offset="1" stopColor="#72e6e1" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="112" y1="150" x2="606" y2="150" className="photon-axis" />
        <path d="M112 150 C132 110 152 190 172 150 S212 110 232 150 S272 190 292 150 S332 110 352 150 S392 190 412 150 S452 110 472 150 S512 190 532 150 S572 110 606 150" className="photon-wave" stroke={`url(#${trailId})`} />
        <g transform="translate(86 150)">
          <circle r="34" className="star-core" />
          <path d="M0 -58V-44M0 44V58M-58 0H-44M44 0H58M-41 -41L-31 -31M31 31L41 41M41 -41L31 -31M-31 31L-41 41" className="star-rays" />
        </g>
        <g transform="translate(634 150)">
          <circle r="42" className="eye-orbit" />
          <circle r="8" className="observer-dot" />
        </g>
        <text x="86" y="242" textAnchor="middle" className="svg-label">THEN</text>
        <text x="634" y="242" textAnchor="middle" className="svg-label">NOW</text>
        <text x="360" y="82" textAnchor="middle" className="svg-caption">THE MESSAGE CROSSES SPACE</text>
      </svg>
    </figure>
  )
}

const ladderRows = [
  { name: 'Moon', value: '1.3 seconds', width: 12 },
  { name: 'Sun', value: '8 min 20 sec', width: 29 },
  { name: 'Sirius', value: '8.6 years', width: 57 },
  { name: 'Andromeda', value: '2.5 million years', width: 96 },
]

export function DistanceLadder() {
  return (
    <figure className="distance-ladder" aria-label="Lookback times increase from the Moon to Andromeda">
      {ladderRows.map((row, index) => (
        <div className="ladder-row" key={row.name}>
          <span className="ladder-index">0{index + 1}</span>
          <span className="ladder-name">{row.name}</span>
          <span className="ladder-track" aria-hidden="true">
            <span className="ladder-fill" style={{ inlineSize: `${row.width}%` }} />
          </span>
          <strong>{row.value}</strong>
        </div>
      ))}
      <figcaption>Bars show order, not linear scale. Light-travel time is the useful measure.</figcaption>
    </figure>
  )
}

export function RedshiftInstrument() {
  const spectrumId = useId().replace(/:/g, '')
  const emitted = [92, 158, 214, 302, 382, 450, 512]
  const observed = [112, 190, 258, 356, 448, 530, 610]
  return (
    <figure className="redshift">
      <svg viewBox="0 0 760 380" role="img" aria-label="The same spectral fingerprint shifts toward longer wavelengths">
        <title>Spectral lines appear at longer wavelengths when space expands</title>
        <defs>
          <linearGradient id={spectrumId} x1="0" x2="1">
            <stop offset="0" stopColor="#7c8cff" />
            <stop offset="0.28" stopColor="#72e6e1" />
            <stop offset="0.56" stopColor="#bde56f" />
            <stop offset="0.78" stopColor="#ffc56e" />
            <stop offset="1" stopColor="#ff7d73" />
          </linearGradient>
        </defs>
        <text x="34" y="68" className="spectrum-label">EMITTED</text>
        <rect x="90" y="36" width="610" height="56" rx="8" fill={`url(#${spectrumId})`} opacity="0.8" />
        {emitted.map((x) => <line key={`e${x}`} x1={x} y1="36" x2={x} y2="92" className="spectral-line" />)}
        <text x="34" y="240" className="spectrum-label">OBSERVED</text>
        <rect x="90" y="208" width="610" height="56" rx="8" fill={`url(#${spectrumId})`} opacity="0.8" />
        {observed.map((x) => <line key={`o${x}`} x1={x} y1="208" x2={x} y2="264" className="spectral-line" />)}
        <path d="M90 142 H700" className="shift-axis" />
        <path d="M314 130 L346 142 L314 154" className="shift-arrow" />
        <text x="395" y="136" className="shift-copy">LONGER WAVELENGTH</text>
        <text x="90" y="316" className="axis-copy">blue</text>
        <text x="700" y="316" textAnchor="end" className="axis-copy axis-copy--red">red</text>
      </svg>
      <figcaption>The fingerprint remains recognizable while every line shifts toward red.</figcaption>
    </figure>
  )
}

export function CosmicTimeline() {
  const timelineId = useId().replace(/:/g, '')
  const afterglowId = useId().replace(/:/g, '')
  return (
    <figure className="cosmic-timeline">
      <svg viewBox="0 0 920 280" role="img" aria-label="The oldest observable light was released early in the universe's history">
        <title>Cosmic timeline from the Big Bang to today, highlighting the release of the cosmic microwave background</title>
        <defs>
          <linearGradient id={timelineId} x1="0" x2="1">
            <stop offset="0" stopColor="#ffc56e" />
            <stop offset="0.12" stopColor="#72e6e1" />
            <stop offset="1" stopColor="#86a0ad" />
          </linearGradient>
          <radialGradient id={afterglowId}>
            <stop offset="0" stopColor="#72e6e1" stopOpacity="0.75" />
            <stop offset="1" stopColor="#72e6e1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="86" y1="182" x2="842" y2="182" stroke={`url(#${timelineId})`} className="time-line" />
        <circle cx="86" cy="182" r="9" className="time-origin" />
        <circle cx="246" cy="182" r="60" fill={`url(#${afterglowId})`} />
        <circle cx="246" cy="182" r="11" className="time-cmb" />
        <circle cx="842" cy="182" r="9" className="time-now" />
        <path d="M246 165V98" className="time-marker" />
        <text x="86" y="232" textAnchor="middle" className="time-label">BIG BANG</text>
        <text x="246" y="76" textAnchor="middle" className="time-kicker">UNIVERSE BECOMES TRANSPARENT</text>
        <text x="246" y="118" textAnchor="middle" className="time-value">380,000 years</text>
        <text x="842" y="232" textAnchor="middle" className="time-label">TODAY</text>
        <text x="842" y="256" textAnchor="middle" className="time-value">13.8 billion years</text>
        <text x="464" y="256" textAnchor="middle" className="time-scale-note">CONCEPTUAL · NOT TO SCALE</text>
      </svg>
      <figcaption>That first free-traveling light still surrounds us as a faint microwave afterglow.</figcaption>
    </figure>
  )
}

export function NightPractice() {
  return (
    <ol className="night-practice" aria-label="A three-step observing ritual">
      <li><span>01</span><strong>Choose</strong><p>one point of light</p></li>
      <li><span>02</span><strong>Find</strong><p>its distance</p></li>
      <li><span>03</span><strong>Name</strong><p>the age arriving now</p></li>
    </ol>
  )
}
