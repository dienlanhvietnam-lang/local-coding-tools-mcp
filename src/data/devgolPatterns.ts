export type ProductType = "web" | "saas" | "dashboard" | "mobile" | "automation" | "wordpress";
export type Tone = "safe" | "modern" | "distinct";

export interface PatternSuggestion {
  tone: Tone;
  title: string;
  description: string;
  components: string[];
  benchmark: string;
}

const PATTERNS: Record<ProductType, PatternSuggestion[]> = {
  web: [
    {
      tone: "safe",
      title: "Landing an toàn",
      description: "Hero rõ ràng, CTA một màu, social proof, footer đầy đủ.",
      components: ["Hero", "FeatureGrid", "Testimonials", "CTA", "Footer"],
      benchmark: "Stripe / Linear marketing pages",
    },
    {
      tone: "modern",
      title: "SaaS quốc tế",
      description: "Typography lớn, spacing rộng, gradient nhẹ, dark mode sẵn.",
      components: ["HeroGlass", "BentoGrid", "Pricing", "FAQ"],
      benchmark: "Vercel / Raycast",
    },
    {
      tone: "distinct",
      title: "Bản sắc riêng",
      description: "Màu brand mạnh, illustration custom, layout bất đối xứng có chủ đích.",
      components: ["BrandHero", "StorySection", "CustomCards"],
      benchmark: "Notion / Arc (tone riêng)",
    },
  ],
  saas: [
    {
      tone: "safe",
      title: "Dashboard quen thuộc",
      description: "Sidebar + topbar, bảng dữ liệu, filter rõ ràng.",
      components: ["Sidebar", "DataTable", "FilterBar", "EmptyState"],
      benchmark: "GitHub / GitLab",
    },
    {
      tone: "modern",
      title: "Command-first",
      description: "Cmd+K, dense UI, keyboard shortcuts, toast gọn.",
      components: ["CommandPalette", "CompactTable", "ShortcutHints"],
      benchmark: "Linear / Height",
    },
    {
      tone: "distinct",
      title: "Workflow canvas",
      description: "Node-based hoặc timeline visual cho automation.",
      components: ["FlowCanvas", "NodeInspector", "RunLog"],
      benchmark: "n8n / Retool (visual)",
    },
  ],
  dashboard: [
    {
      tone: "safe",
      title: "Admin cổ điển",
      description: "Card KPI, chart đơn giản, table CRUD.",
      components: ["KpiCards", "LineChart", "CrudTable"],
      benchmark: "AdminLTE / Ant Design Pro",
    },
    {
      tone: "modern",
      title: "Analytics glass",
      description: "Glass cards, real-time badges, responsive grid.",
      components: ["MetricCard", "SparkChart", "ActivityFeed"],
      benchmark: "Vercel Analytics / Plausible",
    },
    {
      tone: "distinct",
      title: "Ops war room",
      description: "Dark theme, alert-first, status màu semantic.",
      components: ["AlertStack", "StatusMap", "IncidentTimeline"],
      benchmark: "Datadog / Grafana",
    },
  ],
  mobile: [
    {
      tone: "safe",
      title: "Mobile chuẩn",
      description: "Bottom nav, thumb zone, list + detail.",
      components: ["BottomNav", "ListItem", "DetailSheet"],
      benchmark: "iOS HIG patterns",
    },
    {
      tone: "modern",
      title: "Gesture-rich",
      description: "Swipe actions, bottom sheet, haptic feedback cues.",
      components: ["SwipeRow", "BottomSheet", "FloatingAction"],
      benchmark: "Apple Music / Things 3",
    },
    {
      tone: "distinct",
      title: "Brand mobile",
      description: "Custom tab bar, illustration onboarding, micro-animation.",
      components: ["OnboardingCarousel", "CustomTabBar"],
      benchmark: "Duolingo / Headspace",
    },
  ],
  automation: [
    {
      tone: "safe",
      title: "Tool form-based",
      description: "Wizard steps, log panel, progress bar.",
      components: ["StepWizard", "LogPanel", "ProgressBar"],
      benchmark: "Windows Settings / installer wizards",
    },
    {
      tone: "modern",
      title: "IDE-style tool",
      description: "Split pane, status bar, command palette.",
      components: ["SplitPane", "StatusBar", "OutputPanel"],
      benchmark: "VS Code / Cursor",
    },
    {
      tone: "distinct",
      title: "Visual automation",
      description: "Drag-drop blocks, live preview, run history.",
      components: ["BlockCanvas", "LivePreview", "RunHistory"],
      benchmark: "Zapier / Make",
    },
  ],
  wordpress: [
    {
      tone: "safe",
      title: "WP admin native",
      description: "Metabox, settings tabs, WP color palette.",
      components: ["Metabox", "SettingsTabs", "Notice"],
      benchmark: "WooCommerce admin",
    },
    {
      tone: "modern",
      title: "Plugin SaaS-like",
      description: "Card settings, toggle switches, inline help.",
      components: ["SettingsCard", "Toggle", "InlineHelp"],
      benchmark: "RankMath / Elementor settings",
    },
    {
      tone: "distinct",
      title: "Visual builder admin",
      description: "Live preview pane, component library sidebar.",
      components: ["PreviewPane", "ComponentLibrary"],
      benchmark: "Elementor / Bricks",
    },
  ],
};

export function getPatternSuggestions(
  productType: ProductType,
  tone?: Tone
): PatternSuggestion[] {
  const list = PATTERNS[productType] ?? PATTERNS.web;
  if (tone) return list.filter((p) => p.tone === tone);
  return list;
}

export function normalizeProductType(input?: string): ProductType {
  const k = (input ?? "web").toLowerCase();
  if (k in PATTERNS) return k as ProductType;
  if (k.includes("dashboard") || k.includes("admin")) return "dashboard";
  if (k.includes("mobile")) return "mobile";
  if (k.includes("saas")) return "saas";
  if (k.includes("auto")) return "automation";
  if (k.includes("wordpress") || k.includes("wp")) return "wordpress";
  return "web";
}
