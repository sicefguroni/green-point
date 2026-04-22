import { useState } from "react";
import {
  Eye,
  EyeOff,
  Droplets,
  Waves,
  Thermometer,
  Wind,
  Map,
  Info,
  ChevronDown,
  Palette,
  Leaf,
  TreeDeciduous,
  Gauge,
} from "lucide-react";
import { LayerId } from "@/types/maplayers";

interface LayerVisibility {
  [layerId: string]: boolean;
}

interface HazardLayersProps {
  layerVisibility: LayerVisibility;
  onToggle: (layerId: LayerId) => void;
  onColorChange: (layerId: LayerId, colors: string[]) => void;
  selectedFloodPeriod: string;
  onFloodPeriodChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedStormAdvisory: string;
  onStormAdvisoryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const COLOR_PALETTES = [
  { name: "Blue", colors: ["#48CAE4", "#0096C7", "#023E8A"] },
  { name: "Green", colors: ["#63DF6D", "#31C438", "#0F8519"] },
  { name: "Amber", colors: ["#F0C954", "#E7BC10", "#CC8315"] },
  { name: "Red", colors: ["#F04C4C", "#D82828", "#60100b"] },
  { name: "Purple", colors: ["#AA5EF1", "#8531D3", "#6014A3"] },
  { name: "Teal", colors: ["#5EEAD4", "#14B8A6", "#0F766E"] },
];

const SEVERITY_TIERS = ["Low", "Medium", "High"];

const FLOOD_INFO: Record<string, { label: string; desc: string }> = {
  floodLayer5Yr: {
    label: "5-Year Return",
    desc: "Flood extent expected once every 5 years on average ΓÇö a relatively frequent event.",
  },
  floodLayer25Yr: {
    label: "25-Year Return",
    desc: "Flood extent expected once every 25 years ΓÇö a moderately rare but significant event.",
  },
  floodLayer100Yr: {
    label: "100-Year Return",
    desc: "Flood extent expected once every 100 years ΓÇö a rare, high-impact event used for worst-case planning.",
  },
};

const STORM_INFO: Record<string, { label: string; desc: string }> = {
  stormLayerAdv1: {
    label: "Advisory 1",
    desc: "Storm surge up to 1ΓÇô2m. Minor coastal flooding expected in low-lying areas.",
  },
  stormLayerAdv2: {
    label: "Advisory 2",
    desc: "Storm surge of 2ΓÇô3m. Significant flooding in coastal zones; evacuation may be needed.",
  },
  stormLayerAdv3: {
    label: "Advisory 3",
    desc: "Storm surge of 3ΓÇô5m. Severe inundation expected; mandatory evacuation in hazard zones.",
  },
  stormLayerAdv4: {
    label: "Advisory 4",
    desc: "Storm surge exceeding 5m. Life-threatening conditions; total evacuation required.",
  },
};

interface HazardLayerConfig {
  id: LayerId;
  label: string;
  description: string;
  source: string;
  icon: React.ReactNode;
  defaultPalette: string;
  expandable: boolean;
}

const HAZARD_LAYERS: HazardLayerConfig[] = [
  {
    id: "floodLayer",
    label: "Flood Hazard",
    description: "Rainfall-driven flood susceptibility zones",
    source: "UP NOAH",
    icon: <Droplets size={18} />,
    defaultPalette: "Blue",
    expandable: true,
  },
  {
    id: "stormLayer",
    label: "Storm Surge",
    description: "Coastal storm surge inundation zones",
    source: "UP NOAH",
    icon: <Waves size={18} />,
    defaultPalette: "Purple",
    expandable: true,
  },
  {
    id: "airLayer",
    label: "Air Quality",
    description: "Real-time AQI with pollutant breakdown (hourly)",
    source: "WAQI / AQICN",
    icon: <Wind size={18} />,
    defaultPalette: "Green",
    expandable: false,
  },
  {
    id: "heatLayer",
    label: "Surface Temperature",
    description: "NASA POWER satellite surface temperature (daily)",
    source: "NASA POWER",
    icon: <Thermometer size={18} />,
    defaultPalette: "Red",
    expandable: false,
  },
];

const ENVIRONMENTAL_LAYERS: HazardLayerConfig[] = [
  {
    id: "ndviLayer",
    label: "Vegetation (NDVI)",
    description: "Normalized Difference Vegetation Index from satellite data",
    source: "NASA GIBS",
    icon: <Leaf size={18} />,
    defaultPalette: "Green",
    expandable: false,
  },
  {
    id: "canopyLayer",
    label: "Tree Canopy",
    description: "Estimated tree canopy coverage derived from NDVI & LST",
    source: "Derived",
    icon: <TreeDeciduous size={18} />,
    defaultPalette: "Green",
    expandable: false,
  },
  {
    id: "greeneryIndexLayer",
    label: "Greenery Index",
    description: "Composite greenery score (NDVI, LST, Canopy, Green Area)",
    source: "System",
    icon: <Gauge size={18} />,
    defaultPalette: "Green",
    expandable: false,
  },
];

function GradientSwatch({
  colors,
  selected,
  onClick,
  label,
}: {
  colors: string[];
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative flex h-6 w-10 rounded-md overflow-hidden border-2 transition-all duration-200
        ${
          selected
            ? "border-neutral-800 ring-2 ring-neutral-800/20 scale-110 dark:border-neutral-200 dark:ring-neutral-200/20"
            : "border-neutral-300 hover:border-neutral-500 hover:scale-105 dark:border-neutral-700 dark:hover:border-neutral-500"
        }
      `}
    >
      {colors.map((c, i) => (
        <div key={i} className="flex-1" style={{ backgroundColor: c }} />
      ))}
    </button>
  );
}

function CustomColorPickers({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
}) {
  return (
    <div className="flex items-center gap-3 mt-1.5">
      {SEVERITY_TIERS.map((tier, i) => (
        <div key={tier} className="flex items-center gap-1.5">
          <span className="text-[9px] text-neutral-400 font-poppins font-medium uppercase tracking-wider dark:text-neutral-500">
            {tier}
          </span>
          <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-md border border-neutral-300 transition-all group hover:scale-110 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500">
            <div
              className="w-full h-full"
              style={{ backgroundColor: colors[i] }}
            />
            <input
              type="color"
              value={colors[i]}
              onChange={(e) => {
                const newColors = [...colors];
                newColors[i] = e.target.value;
                onChange(newColors);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShow(!show);
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        <Info size={13} />
      </button>
      {show && (
        <span
          className="
            absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
            w-52 px-3 py-2 rounded-lg
            bg-neutral-800 text-white text-xs leading-relaxed
            shadow-lg pointer-events-none
            animate-in fade-in-0 zoom-in-95 duration-150
          "
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral-800" />
        </span>
      )}
    </span>
  );
}

function SubLayerRadio({
  id,
  name,
  value,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`
        flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer
        transition-all duration-150 group
        ${
          checked
            ? "bg-primary-green/8 border border-primary-green/20 dark:bg-primary-green/15 dark:border-primary-green/30"
            : "hover:bg-neutral-50 border border-transparent dark:hover:bg-neutral-900/70"
        }
      `}
    >
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="
          w-3.5 h-3.5 shrink-0
          appearance-none rounded-full
          border-2 border-neutral-300
          checked:border-primary-green checked:bg-primary-green
          checked:shadow-[inset_0_0_0_2px_white]
          dark:border-neutral-600 dark:checked:shadow-[inset_0_0_0_2px_theme(colors.neutral.950)]
          transition-all duration-200
        "
      />
      <span className="flex items-center gap-1.5 text-[11px] font-poppins font-medium text-neutral-700 dark:text-neutral-300">
        {label}
        <InfoTooltip text={description} />
      </span>
    </label>
  );
}

function ExpandableLayerCard({
  config,
  isVisible,
  onToggle,
  onColorChange,
  children,
}: {
  config: HazardLayerConfig;
  isVisible: boolean;
  onToggle: () => void;
  onColorChange: (colors: string[]) => void;
  children?: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(config.defaultPalette);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const defaultColors = COLOR_PALETTES.find(
    (p) => p.name === config.defaultPalette,
  )?.colors ?? ["#888888", "#555555", "#333333"];
  const [currentColors, setCurrentColors] = useState(defaultColors);

  const handlePaletteSelect = (palette: (typeof COLOR_PALETTES)[0]) => {
    setSelectedPalette(palette.name);
    setCurrentColors(palette.colors);
    setShowCustomPicker(false);
    onColorChange(palette.colors);
  };

  const handleCustomColorChange = (colors: string[]) => {
    setSelectedPalette(""); // deselect presets
    setCurrentColors(colors);
    onColorChange(colors);
  };

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${
          isVisible
            ? "bg-white border-neutral-200 shadow-sm dark:bg-neutral-900/80 dark:border-neutral-800 dark:shadow-black/20"
            : "bg-neutral-50 border-neutral-100 dark:bg-neutral-950/50 dark:border-neutral-800"
        }
      `}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className={`
            shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200
            ${
              isVisible
                ? "bg-primary-green/10 text-primary-green hover:bg-primary-green/20 dark:bg-primary-green/20 dark:text-primary-green/80 dark:hover:bg-primary-green/30"
                : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            }
          `}
          title={isVisible ? "Hide layer" : "Show layer"}
        >
          {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span
            className={`shrink-0 transition-colors duration-200 ${
              isVisible ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
            }`}
          >
            {config.icon}
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`text-xs font-medium font-poppins transition-colors duration-200 ${
                  isVisible ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {config.label}
              </span>
              <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {config.source}
              </span>
            </div>
            <span className="mt-0.5 truncate text-[10px] leading-tight text-neutral-400 font-roboto dark:text-neutral-500">
              {config.description}
            </span>
          </div>
        </button>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 rounded-md p-1 text-neutral-400 transition-all duration-200 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div
        className={`
          grid transition-all duration-300 ease-in-out
          ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
        `}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-neutral-100 px-3 pb-3 pt-1 dark:border-neutral-800">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
                  Color Palette
                </span>
                <button
                  onClick={() => setShowCustomPicker(!showCustomPicker)}
                  className={`
                    flex items-center gap-1 text-[10px] font-medium font-roboto px-2 py-0.5 rounded-md
                    transition-all duration-200
                    ${
                      showCustomPicker
                        ? "bg-primary-green/10 text-primary-green dark:bg-primary-green/20 dark:text-primary-green/80"
                        : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-300"
                    }
                  `}
                  title="Pick custom colors"
                >
                  <Palette size={11} />
                  Custom
                </button>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-2">
                {COLOR_PALETTES.map((palette) => (
                  <GradientSwatch
                    key={palette.name}
                    colors={palette.colors}
                    label={palette.name}
                    selected={selectedPalette === palette.name}
                    onClick={() => handlePaletteSelect(palette)}
                  />
                ))}
              </div>

              {showCustomPicker && (
                <div className="mt-2 border-t border-neutral-100/80 pt-2 dark:border-neutral-800">
                  <span className="text-[10px] text-neutral-400 font-roboto dark:text-neutral-500">
                    Pick a color for each severity level:
                  </span>
                  <CustomColorPickers
                    colors={currentColors}
                    onChange={handleCustomColorChange}
                  />
                </div>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleLayerCard({
  config,
  isVisible,
  onToggle,
}: {
  config: HazardLayerConfig;
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200
        ${
          isVisible
            ? "bg-white border-neutral-200 shadow-sm dark:bg-neutral-900/80 dark:border-neutral-800 dark:shadow-black/20"
            : "bg-neutral-50 border-neutral-100 dark:bg-neutral-950/50 dark:border-neutral-800"
        }
      `}
    >
      <button
        onClick={onToggle}
        className={`
          shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200
          ${
            isVisible
                ? "bg-primary-green/10 text-primary-green hover:bg-primary-green/20 dark:bg-primary-green/20 dark:text-primary-green/80 dark:hover:bg-primary-green/30"
                : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          }
        `}
        title={isVisible ? "Hide layer" : "Show layer"}
      >
        {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>

      <span
        className={`shrink-0 transition-colors duration-200 ${
          isVisible ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
        }`}
      >
        {config.icon}
      </span>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`text-xs font-medium font-poppins transition-colors duration-200 ${
              isVisible ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {config.label}
          </span>
          <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {config.source}
          </span>
        </div>
        <span className="mt-0.5 truncate text-[10px] leading-tight text-neutral-400 font-roboto dark:text-neutral-500">
          {config.description}
        </span>
      </div>
    </div>
  );
}

function BarangayLayerToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200
        ${
          isVisible
            ? "bg-white border-neutral-200 shadow-sm dark:bg-neutral-900/80 dark:border-neutral-800 dark:shadow-black/20"
            : "bg-neutral-50 border-neutral-100 dark:bg-neutral-950/50 dark:border-neutral-800"
        }
      `}
    >
      <button
        onClick={onToggle}
        className={`
          shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200
          ${
            isVisible
              ? "bg-primary-green/10 text-primary-green hover:bg-primary-green/20 dark:bg-primary-green/20 dark:text-primary-green/80 dark:hover:bg-primary-green/30"
              : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          }
        `}
        title={isVisible ? "Hide boundaries" : "Show boundaries"}
      >
        {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Map
          size={18}
          className={`shrink-0 transition-colors duration-200 ${
            isVisible ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
          }`}
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={`text-xs font-medium font-poppins transition-colors duration-200 ${
                isVisible ? "text-neutral-800 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              Barangay Boundaries
            </span>
            <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              PSA / NAMRIA
            </span>
          </div>
          <span className="mt-0.5 text-[10px] leading-tight text-neutral-400 font-roboto dark:text-neutral-500">
            Administrative boundary outlines
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HazardLayers({
  layerVisibility,
  onToggle,
  onColorChange,
  selectedFloodPeriod,
  onFloodPeriodChange,
  selectedStormAdvisory,
  onStormAdvisoryChange,
}: HazardLayersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block px-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
          Hazard Layers
        </span>
        <div className="flex flex-col gap-2">
          {HAZARD_LAYERS.map((config) =>
            config.expandable ? (
              <ExpandableLayerCard
                key={config.id}
                config={config}
                isVisible={layerVisibility[config.id] ?? false}
                onToggle={() => onToggle(config.id)}
                onColorChange={(colors) => onColorChange(config.id, colors)}
              >
                {config.id === "floodLayer" && (
                  <div>
                    <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
                      Rain Return Period
                      <InfoTooltip text="A return period estimates how often a flood of a given magnitude is statistically expected. Longer periods = rarer but more severe events." />
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {Object.entries(FLOOD_INFO).map(([id, info]) => (
                        <SubLayerRadio
                          key={id}
                          id={id}
                          name="floodRadioGroup"
                          value={id}
                          label={info.label}
                          description={info.desc}
                          checked={selectedFloodPeriod === id}
                          onChange={onFloodPeriodChange}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {config.id === "stormLayer" && (
                  <div>
                    <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
                      Advisory Level
                      <InfoTooltip text="PAGASA storm surge advisories indicate expected wave heights from tropical cyclones. Higher levels indicate greater coastal inundation." />
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {Object.entries(STORM_INFO).map(([id, info]) => (
                        <SubLayerRadio
                          key={id}
                          id={id}
                          name="stormRadioGroup"
                          value={id}
                          label={info.label}
                          description={info.desc}
                          checked={selectedStormAdvisory === id}
                          onChange={onStormAdvisoryChange}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </ExpandableLayerCard>
            ) : (
              <SimpleLayerCard
                key={config.id}
                config={config}
                isVisible={layerVisibility[config.id] ?? false}
                onToggle={() => onToggle(config.id)}
              />
            ),
          )}
        </div>
      </div>

      <div>
        <span className="mb-2 block px-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
          Environmental Layers
        </span>
        <div className="flex flex-col gap-2">
          {ENVIRONMENTAL_LAYERS.map((config) => (
            <SimpleLayerCard
              key={config.id}
              config={config}
              isVisible={layerVisibility[config.id] ?? false}
              onToggle={() => onToggle(config.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block px-1 text-[9px] font-medium uppercase tracking-wider text-neutral-400 font-poppins dark:text-neutral-500">
          Reference Layers
        </span>
        <BarangayLayerToggle
          isVisible={layerVisibility.barangayBoundsLayer ?? false}
          onToggle={() => onToggle("barangayBoundsLayer")}
        />
      </div>
    </div>
  );
}
