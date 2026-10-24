import * as React from "react";
import { ToolcraftApp, type ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";
import { appComposition } from "../app/app-composition";
import { CITY_PRESETS } from "../app/app-schema";
import { SunPathCanvas } from "../components/SunPathCanvas";

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDayLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

interface SunData {
  sunrise: string;
  sunset: string;
  solar_noon: string;
  day_length: number;
  civil_twilight_begin: string;
  civil_twilight_end: string;
  isFallback: boolean;
}

const handlePanelAction: ToolcraftPanelActionHandler = ({ action, dispatch }) => {
  const city = CITY_PRESETS.find((preset) => preset.value === action.value);
  if (!city) return;
  dispatch({ type: "controls.setValue", target: "latitude", value: city.latitude, label: city.label });
  dispatch({ type: "controls.setValue", target: "longitude", value: city.longitude, label: city.label });
};

export function AppHome(): React.JSX.Element {
  const quietZoneRef = React.useRef<((data: any) => void) | null>(null);
  const [qzVisible, setQzVisible] = React.useState(false);
  const [qzData, setQzData] = React.useState<{
    sunrise: string;
    sunset: string;
    solarNoon: string;
    dayLength: string;
    civilTwilightBegin: string;
    civilTwilightEnd: string;
    source: string;
  } | null>(null);
  const qzTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hero and stamp state
  const [dayLengthDisplay, setDayLengthDisplay] = React.useState("--");
  const [stampText, setStampText] = React.useState(
    "Sunrise-Sunset API -- loading..."
  );

  // Shared data ref (canvas writes here, route reads for chrome)
  const sunDataRef = React.useRef<SunData | null>(null);

  const showQuietZone = React.useCallback((data: any) => {
    const dl = formatDayLength(data.day_length || 0);
    setQzData({
      sunrise: formatTime(data.sunrise),
      sunset: formatTime(data.sunset),
      solarNoon: formatTime(data.solar_noon),
      dayLength: dl,
      civilTwilightBegin: formatTime(data.civil_twilight_begin),
      civilTwilightEnd: formatTime(data.civil_twilight_end),
      source: data.isFallback ? "fallback (computed)" : "api.sunrise-sunset.org",
    });
    setQzVisible(true);
    if (qzTimerRef.current) clearTimeout(qzTimerRef.current);
    qzTimerRef.current = setTimeout(() => setQzVisible(false), 3000);
  }, []);

  React.useEffect(() => {
    quietZoneRef.current = showQuietZone;
    return () => {
      quietZoneRef.current = null;
    };
  }, [showQuietZone]);

  return (
    <div className="relative w-full h-full">
      <ToolcraftApp
        className="h-dvh min-h-dvh"
        schema={appComposition.schema}
        onPanelAction={handlePanelAction}
        canvasContent={
          <>
            <SunPathCanvas
              quietZoneRef={quietZoneRef}
              sunDataRef={sunDataRef}
              onDataUpdate={(data: SunData) => {
                const dl = formatDayLength(data.day_length);
                setDayLengthDisplay(dl);
                setStampText(
                  `Sunrise-Sunset API -- ${data.isFallback ? "computed" : "live"} -- ${dl}`
                );
              }}
            />

            {/* Chrome overlays: inside the output frame so they stay on the piece */}
            <div id="hero-stats">
              <div className="hero-value">{dayLengthDisplay}</div>
              <div className="hero-label">day length</div>
            </div>

            <div id="data-stamp">{stampText}</div>

            <div id="desc">
              Latitude and season shape the sun's arc across the sky -- drag sliders to explore
            </div>

            <div id="legend">
              <span style={{ color: "#4fc3f7" }}>daytime</span>
              <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
              <span style={{ color: "#ce93d8" }}>twilight</span>
              <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
              <span style={{ color: "#ffd54f" }}>sun</span>
              <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
              wider arc = longer day
            </div>

            <div id="quiet-zone" className={qzVisible ? "visible" : ""}>
              {qzData && (
                <div className="qz-card">
                  <div className="qz-title">Solar Times</div>
                  <div className="qz-row">
                    <span className="qz-label">Sunrise</span>
                    <span className="qz-value">{qzData.sunrise}</span>
                  </div>
                  <div className="qz-row">
                    <span className="qz-label">Solar Noon</span>
                    <span className="qz-value">{qzData.solarNoon}</span>
                  </div>
                  <div className="qz-row">
                    <span className="qz-label">Sunset</span>
                    <span className="qz-value">{qzData.sunset}</span>
                  </div>
                  <div className="qz-row">
                    <span className="qz-label">Day Length</span>
                    <span className="qz-value">{qzData.dayLength}</span>
                  </div>
                  <div className="qz-row">
                    <span className="qz-label">Twilight Start</span>
                    <span className="qz-value">{qzData.civilTwilightBegin}</span>
                  </div>
                  <div className="qz-row">
                    <span className="qz-label">Twilight End</span>
                    <span className="qz-value">{qzData.civilTwilightEnd}</span>
                  </div>
                  <a
                    className="qz-link"
                    href="https://sunrise-sunset.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Data: {qzData.source} &rarr;
                  </a>
                </div>
              )}
            </div>
          </>
        }
        renderDefaultCanvasMedia={false}
      />
    </div>
  );
}
