import React, { useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
const Slide1: React.FC = () => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    s: 1,
    x: 0,
    y: 0
  });
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / 1280, h / 720);
      setLayout({
        s,
        x: (w - 1280 * s) / 2,
        y: (h - 720 * s) / 2
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div id="slide-1" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-1" style={{
      position: "absolute",
      width: "1280px",
      height: "720px",
      overflow: "hidden",
      transformOrigin: "top left",
      color: "#000000",
      backgroundColor: "#FFFFFF",
      transform: `scale(${layout.s})`,
      left: layout.x + "px",
      top: layout.y + "px"
    }}><div key={0} style={{
        position: "absolute",
        left: "43.2px",
        top: "19.2px",
        width: "1180.8px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos Display', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Balance Sheet \u2013 Assets as of Jun 2026"}</span></p></div><ReactECharts key={1} option={{
        animation: false,
        grid: {
          containLabel: true,
          left: "5%",
          right: "5%",
          top: 40,
          bottom: 30
        },
        legend: {
          show: true
        },
        color: ["#439798", "#BC4096"],
        xAxis: {
          type: "category",
          data: []
        },
        yAxis: {
          type: "value"
        },
        series: [{
          name: "Jun 2026",
          type: "bar",
          stack: null,
          data: [31987604548.010002, 14565878356.179998, 12020967187.35, 1391945670.4],
          itemStyle: {
            color: "#439798"
          }
        }, {
          name: "Mar 2026",
          type: "bar",
          stack: null,
          data: [33308487466.850002, 23799634457.98, 1560769284, 1714229923.4],
          itemStyle: {
            color: "#BC4096"
          }
        }]
      }} style={{
        position: "absolute",
        left: "43.2px",
        top: "91.2px",
        width: "532.8px",
        height: "302.4px"
      }} /><div key={2} style={{
        position: "absolute",
        left: "609.6px",
        top: "88.32px",
        width: "624px",
        height: "350.4px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0.04px 0.04px 0.04px 0.04px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Other current:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 31,987,604,548 USD at Jun 2026 vs 33,308,487,467 USD at Mar 2026: -1,320,882,919 (-4.0%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Trade receivables:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 14,565,878,356 USD at Jun 2026 vs 23,799,634,458 USD at Mar 2026: -9,233,756,102 (-38.8%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Main account movement: Trade receivables - K changed by -8,736,671,696 USD (-40.8%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Cash & equivalents:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 12,020,967,187 USD at Jun 2026 vs 1,560,769,284 USD at Mar 2026: +10,460,197,903 (+670.2%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Other non-current:"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 1,391,945,670 USD at Jun 2026 vs 1,714,229,923 USD at Mar 2026: -322,284,253 (-18.8%)."}</span></p></div><div key={3} style={{
        position: "absolute",
        left: "45.12px",
        top: "401.28px",
        width: "288px",
        height: "17.28px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(6.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"All figures in USD."}</span></p></div><div key={4} style={{
        position: "absolute",
        left: "45.12px",
        top: "433.92px",
        width: "528px",
        height: "19.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(9pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(9pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Key pointers on old balances:"}</span></p></div><div key={5} style={{
        position: "absolute",
        left: "45.12px",
        top: "458.88px",
        width: "1176px",
        height: "158.4px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0.03px 0.03px 0.03px 0.03px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Cash & equivalents remains 12,020,967,187 USD at Jun 2026 (20.0% of total assets); validate the underlying account mix and any reclassification behind the +10,460,197,903 USD movement."}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Trade receivables remains 14,565,878,356 USD at Jun 2026 (24.3% of total assets); validate the underlying account mix and any reclassification behind the -9,233,756,102 USD movement."}</span></p></div><div key={6} style={{
        position: "absolute",
        left: "45.12px",
        top: "689.28px",
        width: "1185.6px",
        height: "12.48px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "right",
          lineHeight: "1.2",
          fontSize: "calc(6.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#667085"
          }}>{"Source: bs \xB7 comparison uses the latest earlier loaded period"}</span></p></div></div></div>;
};
export default Slide1;
