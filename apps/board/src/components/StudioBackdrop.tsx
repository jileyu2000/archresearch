type StudioBackdropProps = {
  view: 'home' | 'results'
}

export function StudioBackdrop({ view }: StudioBackdropProps) {
  return (
    <div
      className="studio-backdrop"
      data-testid="studio-backdrop"
      data-view={view}
      aria-hidden="true"
    >
      <span className="studio-crop-mark studio-crop-mark--start" />
      <span className="studio-crop-mark studio-crop-mark--end" />

      <svg className="studio-diagram studio-diagram--plan" viewBox="0 0 320 220" fill="none">
        <path className="studio-diagram-line" d="M24 28H232V70H296V196H170V152H84V196H24Z" />
        <path className="studio-diagram-line" d="M84 28V152M170 28V196M232 70V152M24 108H170" />
        <path className="studio-diagram-strong" d="M76 68H92M162 108H178M224 108H240" />
        <path className="studio-diagram-route" d="M8 174C62 174 72 132 118 132S184 164 220 126 262 92 310 92" />
        <circle className="studio-diagram-node" cx="118" cy="132" r="5" />
        <circle className="studio-diagram-node" cx="220" cy="126" r="5" />
        <circle className="studio-diagram-marker" cx="280" cy="92" r="7" />
      </svg>

      <svg className="studio-diagram studio-diagram--section" viewBox="0 0 340 220" fill="none">
        <path className="studio-diagram-line" d="M16 194H324M34 194V142H98V98H166V150H230V62H294V194" />
        <path className="studio-diagram-line" d="M34 142H98M98 98H166M166 150H230M230 62H294" />
        <rect className="studio-diagram-fill" x="48" y="156" width="38" height="38" />
        <rect className="studio-diagram-fill" x="112" y="112" width="40" height="82" />
        <rect className="studio-diagram-fill" x="244" y="76" width="36" height="118" />
        <path className="studio-diagram-route" d="M16 178C82 178 106 156 144 156S204 116 252 116 290 92 328 92" />
        <path className="studio-diagram-strong" d="M144 162V150M252 122V110M322 86L330 92 322 98" />
      </svg>
    </div>
  )
}
