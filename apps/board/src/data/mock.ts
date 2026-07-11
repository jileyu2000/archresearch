export type ResultTier = 'verified' | 'partial' | 'visual_lead'
export type AssetType =
  | 'plan'
  | 'section'
  | 'elevation'
  | 'site_plan'
  | 'axonometric'
  | 'circulation'
  | 'analysis_diagram'
  | 'render'
  | 'photograph'
  | 'diagram'

export interface EvidenceResult {
  id: string
  title: string
  project: string
  location: string
  year: string
  assetType: AssetType
  tier: ResultTier
  relevance: 0 | 1 | 2 | 3 | 4
  publicationTier: 'primary' | 'trusted_secondary' | 'aggregator' | 'unknown'
  projectIdentity: 'confirmed' | 'probable' | 'unknown' | 'conflict'
  assetAssociation: 'confirmed' | 'probable' | 'unknown' | 'conflict'
  primarySource: 'confirmed' | 'candidate' | 'unknown'
  rightsStatus: 'user_owned' | 'open_license' | 'permissioned' | 'unknown' | 'restricted'
  sourceName: string
  sourceUrl: string
  imageUrl?: string | null
  fact: string
  observation: string
  inference: string
  limitation: string
  accent: string
  drawing: 'courtyard' | 'section-steps' | 'circulation' | 'facade' | 'axon' | 'landscape' | 'grid'
}

export interface WorkspaceSummary {
  id: string
  code: string
  title: string
  subtitle: string
  resultCount: number
  active?: boolean
}

export interface TraceItem {
  id: string
  stage: string
  tool: string
  summary: string
  duration: string
  cost: string
  status: 'done' | 'active' | 'queued'
}

export const workspaces: WorkspaceSummary[] = [
  {
    id: 'adaptive-reuse',
    code: 'AR–04',
    title: '旧厂房复合更新',
    subtitle: '新旧空间组织 / 人车分流',
    resultCount: 7,
    active: true,
  },
  {
    id: 'section-depth',
    code: 'ST–12',
    title: '垂直校园剖面',
    subtitle: '公共层次 / 中庭采光',
    resultCount: 18,
  },
  {
    id: 'competition-layout',
    code: 'BR–02',
    title: '竞赛图纸语言',
    subtitle: '线型 / 版式 / 色彩',
    resultCount: 11,
  },
]

export const evidenceResults: EvidenceResult[] = [
  {
    id: 'result-kamala',
    title: '双院落与柱网的对称组织',
    project: 'Kamala Narayana Temple Survey',
    location: 'Degaon, India',
    year: 'n.d.',
    assetType: 'plan',
    tier: 'verified',
    relevance: 4,
    publicationTier: 'trusted_secondary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'candidate',
    rightsStatus: 'open_license',
    sourceName: 'Wikimedia Commons · Sarah Welch · CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Architectural_floor_plan_of_the_Kamala_Narayana_temple,_Degaon_Karnataka.jpg',
    imageUrl: '/demo/kamala-plan.jpg',
    fact: 'Commons 文件页将该测绘平面标记为作者自有作品，并以 CC0 发布。',
    observation: '两个院落沿中轴串联，柱网与厚墙共同限定出清晰的公共序列。',
    inference: '面对复杂旧建筑时，可先用院落和主轴确定公共层级，再把次要房间挂接到两侧。',
    limitation: '这是历史寺庙测绘图，功能、疏散和无障碍条件不能直接套用于当代公共建筑。',
    accent: '#315CF4',
    drawing: 'courtyard',
  },
  {
    id: 'result-bungalow',
    title: '居住空间与服务带的双层组织',
    project: 'Bungalow Floor Plan / MET DP804276',
    location: 'The Metropolitan Museum of Art',
    year: 'n.d.',
    assetType: 'plan',
    tier: 'verified',
    relevance: 4,
    publicationTier: 'trusted_secondary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'candidate',
    rightsStatus: 'open_license',
    sourceName: 'The Met Open Access / Wikimedia Commons · CC0',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Bungalow_drawing_--_Floor_Plan_MET_DP804276.jpg',
    imageUrl: '/demo/bungalow-plan.jpg',
    fact: 'The Met 开放获取记录通过 Wikimedia Commons 提供该住宅平面，并标记为 CC0。',
    observation: '卧室沿一侧连续布置，厨房、浴室和储藏形成紧凑服务带，中央走道承担分配。',
    inference: '可把后勤功能压缩成连续带状系统，让公共房间获得更完整的外墙和采光面。',
    limitation: '历史住宅尺度和家庭结构与公共项目差异明显，只适合研究分区和服务核的表达。',
    accent: '#2D846B',
    drawing: 'grid',
  },
  {
    id: 'result-foundry-replay',
    title: '保留厂房中的独立功能盒',
    project: 'Foundry Commons Replay',
    location: 'ArchResearch local fixture',
    year: '2026',
    assetType: 'plan',
    tier: 'verified',
    relevance: 3,
    publicationTier: 'primary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'user_owned',
    sourceName: 'ArchResearch replay fixture',
    sourceUrl: '/demo/source-index.html#foundry-plan',
    imageUrl: '/demo/reuse-plan.png',
    fact: '该图是随项目发布的确定性回放夹具，用于验证旧结构、新体量和公共路径的识别与编排。',
    observation: '两个新增盒子脱离原柱网边界，公共路径沿厂房长向穿过并在中部汇合。',
    inference: '新功能可作为结构独立的房中房植入，保留旧厂房连续尺度并减少对原构件的改动。',
    limitation: '这是测试图，不代表建成项目，也不提供结构、防火或造价依据。',
    accent: '#E4583E',
    drawing: 'courtyard',
  },
  {
    id: 'result-section-replay',
    title: '三段公共平台与集中服务核',
    project: 'Section Layers Replay',
    location: 'ArchResearch local fixture',
    year: '2026',
    assetType: 'section',
    tier: 'partial',
    relevance: 3,
    publicationTier: 'primary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'user_owned',
    sourceName: 'ArchResearch replay fixture',
    sourceUrl: '/demo/source-index.html#section-layers',
    imageUrl: '/demo/section-layers.png',
    fact: '本地来源页确认该图为用于剖面层次识别的项目自有测试资产。',
    observation: '三个平台逐级抬升，服务核贯穿全高，公共路径绕开服务核连续上升。',
    inference: '剖面缺少层次时，可先建立连续公共序列，再把电梯、设备和后勤压缩为稳定竖核。',
    limitation: '测试图没有真实层高、坡度和疏散距离，方法转译前仍需工程校核。',
    accent: '#8C6752',
    drawing: 'section-steps',
  },
  {
    id: 'result-circulation-replay',
    title: '公共与后勤路径只保留一个受控交叉',
    project: 'Circulation Split Replay',
    location: 'ArchResearch local fixture',
    year: '2026',
    assetType: 'circulation',
    tier: 'partial',
    relevance: 3,
    publicationTier: 'primary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'user_owned',
    sourceName: 'ArchResearch replay fixture',
    sourceUrl: '/demo/source-index.html#circulation',
    imageUrl: '/demo/circulation.png',
    fact: '本地来源页确认该图为用于流线冲突分类和安全回放的项目自有测试资产。',
    observation: '绿色公共路径穿过主要空间，红色后勤路径沿边界进入，两者只在一个节点接触。',
    inference: '先把两套流线分别做成连续系统，再把不可避免的交叉集中到可管理节点。',
    limitation: '图中没有车辆转弯半径、峰值人数与时段信息，不能替代交通计算。',
    accent: '#657B86',
    drawing: 'circulation',
  },
  {
    id: 'result-axon-replay',
    title: '保留基座、公共层与采光顶分层表达',
    project: 'Layered Axon Replay',
    location: 'ArchResearch local fixture',
    year: '2026',
    assetType: 'axonometric',
    tier: 'visual_lead',
    relevance: 2,
    publicationTier: 'primary',
    projectIdentity: 'unknown',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'user_owned',
    sourceName: 'ArchResearch replay fixture',
    sourceUrl: '/demo/source-index.html#layered-axon',
    imageUrl: '/demo/layered-axon.png',
    fact: '来源仅确认这是项目自有的视觉分类夹具，不对应真实项目身份。',
    observation: '三块错位板片分别表示保留基座、公共层和采光层，竖向构件贯穿三层。',
    inference: '轴测表达可把新旧、公共与环境系统拆成不同层级，帮助统一整套分析图语言。',
    limitation: '只承诺图形表达相似，不代表完整空间拓扑或真实构造关系。',
    accent: '#7D817E',
    drawing: 'axon',
  },
  {
    id: 'result-facade-replay',
    title: '沿原有开间插入连续新界面',
    project: 'Facade Rhythm Replay',
    location: 'ArchResearch local fixture',
    year: '2026',
    assetType: 'elevation',
    tier: 'visual_lead',
    relevance: 2,
    publicationTier: 'primary',
    projectIdentity: 'unknown',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'user_owned',
    sourceName: 'ArchResearch replay fixture',
    sourceUrl: '/demo/source-index.html#facade-rhythm',
    imageUrl: '/demo/facade-rhythm.png',
    fact: '来源仅确认这是项目自有的立面视觉分类夹具，不对应真实建成项目。',
    observation: '新增开口占据两个原有开间，其他分格继续沿用旧立面的测量节奏。',
    inference: '旧建筑立面更新可先服从既有模数，再用少量连续开口表达新的公共性。',
    limitation: '只用于研究线型、模数和色块表达，不提供围护构造或历史保护依据。',
    accent: '#6E9585',
    drawing: 'facade',
  },
]

export const traceItems: TraceItem[] = [
  {
    id: 'trace-plan',
    stage: '规划',
    tool: 'research_spec',
    summary: '拆分为旧建筑植入、首层人车分流、剖面层次三项证据缺口。',
    duration: '0.8 s',
    cost: '¥0.02',
    status: 'done',
  },
  {
    id: 'trace-search',
    stage: '搜索',
    tool: 'web_search',
    summary: '执行 6 条中英文查询，保留 18 个候选项目页。',
    duration: '12.4 s',
    cost: '¥0.18',
    status: 'done',
  },
  {
    id: 'trace-inspect',
    stage: '检视',
    tool: 'browser',
    summary: '打开 12 个页面，枚举 74 个媒体节点，留下 21 张候选图纸。',
    duration: '38.6 s',
    cost: '—',
    status: 'done',
  },
  {
    id: 'trace-verify',
    stage: '核验',
    tool: 'source_verifier',
    summary: '7 张进入画板，3 张已核验，2 张部分核验。',
    duration: '16.2 s',
    cost: '¥0.11',
    status: 'active',
  },
]
