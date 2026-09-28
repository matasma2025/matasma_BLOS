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
      const s = Math.min(w / 1279.68, h / 720);
      setLayout({
        s,
        x: (w - 1279.68 * s) / 2,
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
      width: "1279.68px",
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
        left: "26.88px",
        top: "27.84px",
        width: "1097.28px",
        height: "41.28px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(28pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(28pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos Display', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Balance Sheet \u2013 Assets as of Jun-26"}</span></p></div><div key={1} style={{
        position: "absolute",
        left: "624.96px",
        top: "87.36px",
        width: "616.32px",
        height: "544.32px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Cash & Cash equivalents:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Cash & cash equivalents increased from 16,078 mINR (Mar-26) to 23,630 mINR (Jun-26)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"The movement table attributes a major part of this to Bank balances \u2264 90 days rising from 1,561 mINR to 12,021 mINR (change 10,460 mINR, +670.2%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Trade receivables & unbilled decreased from 24,659 mINR (Mar-26) to 15,425 mINR (Jun-26)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"The movement table shows the main driver as Trade receivables - K falling from 21,422 mINR to 12,685 mINR (change -8,737 mINR, -40.8%), with an additional decline in Trade receivables - 3rd, B-c, B-f from 2,111 mINR to 1,671 mINR (change -439.12 mINR, -20.8%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"The dataset does not indicate where the offsetting balance accumulated beyond the visible increases in cash-like items and loans."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Trade Receivables:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"15,425 mINR at Jun-26 vs 24,659 mINR at Mar-26: -9,234 mINR (-37.4%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other current assets:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"8,228 mINR at Jun-26 vs 6,679 mINR at Mar-26: +1,550 mINR (+23.2%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Investments in Group Entities:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Investments decreased from 18,831 mINR (Mar-26) to 15,143 mINR (Jun-26)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"The movement table attributes this to Total: Investments (wo B-a) declining by -3,688 mINR (-19.6%) and Money market funds - FVPL declining by -2,908 mINR (-20.0%)."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Fixed Assets:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"10,978 mINR at Jun-26 vs 11,192 mINR at Mar-26: -215 mINR (-1.9%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other Noncurrent assets:"}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"12,816 mINR at Jun-26 vs 13,077 mINR at Mar-26: -262 mINR (-2.0%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Right-of-use assets:"}</span></p><p style={{
          lineHeight: "1.2",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"7,945 mINR at Jun-26 vs 8,430 mINR at Mar-26: -485 mINR (-5.8%). No further commentary generated for this line."}</span></p></div><div key={2} style={{
        position: "absolute",
        left: "26.88px",
        top: "415.68px",
        width: "303.36px",
        height: "19.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"All figures in mINR."}</span></p></div><div key={3} style={{
        position: "absolute",
        left: "26.88px",
        top: "447.36px",
        width: "573.12px",
        height: "163.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Key pointers on old balances:"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Trade receivables"}</span></p><p style={{
          lineHeight: "1.2",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Receivables concentration/mix change: Trade receivables - K remains a major balance at Jun-26 (12,685 mINR, 13.5% of total assets) despite a large reduction vs Mar-26 (-8,737 mINR). Validate whether the reduction reflects reclassification to cash-like balances or other balance sheet lines (not identifiable from this dataset)."}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other current assets"}</span></p><p style={{
          lineHeight: "1.2",
          textIndent: "-16px",
          paddingLeft: "16px",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontStyle: "italic",
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Nothing flagged from the data \u2014 add from supporting schedules."}</span></p><p style={{
          lineHeight: "1.2",
          textIndent: "-36px",
          paddingLeft: "36px",
          fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(8.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Investment/cash allocation swing is material: Money market funds - FVPL decreased by -2,908 mINR (-20.0%) while Bank balances \u2264 90 days increased by 10,460 mINR (+670.2%); confirm treasury policy/constraints and classification (not identifiable from this dataset)."}</span></p></div><ReactECharts key={4} option={{
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
          name: "Jun-26",
          type: "bar",
          stack: null,
          data: [23629.73, 15425.05, 8228.44, 15142.79, 7945.14, 10977.72, 12815.6],
          itemStyle: {
            color: "#439798"
          }
        }, {
          name: "Mar-26",
          type: "bar",
          stack: null,
          data: [16077.8, 24658.81, 6678.53, 18830.8, 8430.26, 11192.24, 13077.25],
          itemStyle: {
            color: "#BC4096"
          }
        }]
      }} style={{
        position: "absolute",
        left: "45.12px",
        top: "104.64px",
        width: "513.6px",
        height: "286.08px"
      }} /></div></div>;
};
export default Slide1;
