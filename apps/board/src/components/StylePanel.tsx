export type StyleDraft = {
  primaryColor: string
  lineHierarchy: 'relative' | 'contrast' | 'uniform'
  fontCategory: 'sans' | 'serif' | 'mono'
  texture: 'none' | 'vellum' | 'grain'
  layoutNotes: string
}

interface StylePanelProps {
  profile: StyleDraft
  status: string
  onChange: (profile: StyleDraft) => void
  onSave: () => void | Promise<void>
  onClose: () => void
}

export function StylePanel({
  profile,
  status,
  onChange,
  onSave,
  onClose,
}: StylePanelProps) {
  return (
    <section className="floating-panel style-panel" role="dialog" aria-modal="true" aria-label="表达规范">
      <header className="panel-heading"><h2>表达规范</h2><button type="button" autoFocus onClick={onClose}>关闭表达规范</button></header>
      <label htmlFor="style-primary-color">主色</label>
      <input id="style-primary-color" type="color" value={profile.primaryColor} onChange={(event) => onChange({ ...profile, primaryColor: event.target.value })} />
      <label htmlFor="style-line-hierarchy">线宽层级</label>
      <select id="style-line-hierarchy" value={profile.lineHierarchy} onChange={(event) => onChange({ ...profile, lineHierarchy: event.target.value as StyleDraft['lineHierarchy'] })}>
        <option value="relative">相对层级</option><option value="contrast">强对比层级</option><option value="uniform">均一层级</option>
      </select>
      <label htmlFor="style-font-category">字体类别</label>
      <select id="style-font-category" value={profile.fontCategory} onChange={(event) => onChange({ ...profile, fontCategory: event.target.value as StyleDraft['fontCategory'] })}>
        <option value="sans">无衬线</option><option value="serif">衬线</option><option value="mono">等宽</option>
      </select>
      <label htmlFor="style-texture">纹理</label>
      <select id="style-texture" value={profile.texture} onChange={(event) => onChange({ ...profile, texture: event.target.value as StyleDraft['texture'] })}>
        <option value="none">无纹理</option><option value="vellum">硫酸纸颗粒</option><option value="grain">细颗粒纸张</option>
      </select>
      <label htmlFor="style-layout-notes">版式备注</label>
      <textarea id="style-layout-notes" value={profile.layoutNotes} onChange={(event) => onChange({ ...profile, layoutNotes: event.target.value })} placeholder="例如：证据栏靠右，图组留白更大" />
      <button type="button" onClick={() => void onSave()}>保存表达规范</button>
      {status && <p role="status">{status}</p>}
    </section>
  )
}
