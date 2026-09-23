import React, { useState, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
const Slide2: React.FC = () => {
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
  return <div id="slide-2" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-2" style={{
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
          }}>{"Balance Sheet \u2013 Liabilities as of Jun 2026"}</span></p></div><ReactECharts key={1} option={{
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
          data: [11445239046.46, 11411061921.81, 9535713154.77, 8867083914.68, 41597800],
          itemStyle: {
            color: "#439798"
          }
        }, {
          name: "Mar 2026",
          type: "bar",
          stack: null,
          data: [14098180791.07, 9117488259.56, 10070854973.89, 10983517308.660002, 41597800],
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
          }}>{"Provisions:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 11,445,239,046 USD at Jun 2026 vs 14,098,180,791 USD at Mar 2026: -2,652,941,745 (-18.8%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Trade payables:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 11,411,061,922 USD at Jun 2026 vs 9,117,488,260 USD at Mar 2026: +2,293,573,662 (+25.2%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Main account movement: Trade payables  - 3rd, B-c, B-f changed by +1,458,788,894 USD (+28.9%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Lease liabilities:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 9,535,713,155 USD at Jun 2026 vs 10,070,854,974 USD at Mar 2026: -535,141,819 (-5.3%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Other liabilities:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 8,867,083,915 USD at Jun 2026 vs 10,983,517,309 USD at Mar 2026: -2,116,433,394 (-19.3%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Main account movement: Liabil. to board members, employees \u2264 1 y changed by -624,618,379 USD (-44.5%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "3pt",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Equity & reserves:"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.7pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 41,597,800 USD at Jun 2026 vs 41,597,800 USD at Mar 2026: +0 (+0.0%)."}</span></p></div><div key={3} style={{
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
          }}>{"\u2022 Provisions remains 11,445,239,046 USD at Jun 2026 (19.1% of total assets); validate the underlying account mix and any reclassification behind the -2,652,941,745 USD movement."}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.4pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"\u2022 Trade payables remains 11,411,061,922 USD at Jun 2026 (19.0% of total assets); validate the underlying account mix and any reclassification behind the +2,293,573,662 USD movement."}</span></p></div><div key={6} style={{
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
export default Slide2;
