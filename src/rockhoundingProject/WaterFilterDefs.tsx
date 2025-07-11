export const WaterFilterDefs = () => (
  <svg
    width={0}
    height={0}
    style={{ position: "absolute" }}>
    <defs>
      <filter
        id='water-displacement'
        x='-40%'
        y='-40%'
        width='180%'
        height='180%'>
        <feTurbulence
          type='turbulance'
          baseFrequency='0.1 0.1'
          numOctaves='2'
          seed='3'
          result='TURB'>
          <animate
            attributeName='baseFrequency'
            dur='15s'
            keyTimes='0;0.5;1'
            // values='0.02 0.035; 0.03 0.045; 0.015 0.03'
            values='0.015 0.03; 0.02 0.035; 0.015 0.03'
            repeatCount='indefinite'
          />
        </feTurbulence>

        <feDisplacementMap
          in='SourceGraphic'
          in2='TURB'
          scale='100'
          xChannelSelector='R'
          yChannelSelector='G'
        />
      </filter>
    </defs>
  </svg>
);
