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
  return <div id="slide-2" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-2" style={{
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
        left: "45.12px",
        top: "50.88px",
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
          }}>{"Balance Sheet \u2013 Liabilities as of Jun-26"}</span></p></div><div key={1} style={{
        position: "absolute",
        left: "640.32px",
        top: "102.72px",
        width: "531.84px",
        height: "513.6px",
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
          }}>{"Trade Payables:"}</span></p><p style={{
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
          }}>{"11,411 mINR at Jun-26 vs 9,117 mINR at Mar-26: +2,294 mINR (+25.2%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other Liabilities:"}</span></p><p style={{
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
          }}>{"9,004 mINR at Jun-26 vs 12,311 mINR at Mar-26: -3,306 mINR (-26.9%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Equity & reserves:"}</span></p><p style={{
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
          }}>{"Equity & reserves decreased from 57,995 mINR (Mar-26) to 52,905 mINR (Jun-26)."}</span></p><p style={{
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
          }}>{"The movement table shows Total: Earned surplus reserves decreased from 57,954 mINR to 52,864 mINR (change -5,090 mINR, -8.8%)."}</span></p><p style={{
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
          }}>{"The underlying driver of the earned surplus movement is not identifiable from this balance sheet dataset alone."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Lease liabilities:"}</span></p><p style={{
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
          }}>{"9,536 mINR at Jun-26 vs 10,071 mINR at Mar-26: -535 mINR (-5.3%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Provisions:"}</span></p><p style={{
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
          }}>{"4,672 mINR at Jun-26 vs 4,224 mINR at Mar-26: +447 mINR (+10.6%). No further commentary generated for this line."}</span></p><p style={{
          lineHeight: "1.2",
          marginBottom: "2pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Non-current liabilities & provisions:"}</span></p><p style={{
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
          }}>{"6,637 mINR at Jun-26 vs 5,227 mINR at Mar-26: +1,409 mINR (+27.0%). No further commentary generated for this line."}</span></p></div><div key={2} style={{
        position: "absolute",
        left: "51.84px",
        top: "420.48px",
        width: "223.68px",
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
        left: "51.84px",
        top: "440.64px",
        width: "559.68px",
        height: "189.12px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"Key pointers on old balances:"}</span></p><p style={{
          lineHeight: "1.2",
          textIndent: "-36px",
          paddingLeft: "36px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"&#x2022;"}</span><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            color: "#000000"
          }}>{"Leverage direction of travel worsened vs baseline: debt-to-equity increased from 0.71 (Mar-26) to 0.78 (Jun-26) and equity ratio fell from 58.6% to 56.2%\u2014still strong, but a watch item if the trend continues."}</span></p></div><ReactECharts key={4} option={{
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
          data: [52905.39, 11411.06, 9535.71, 4671.53, 9004.29, 6636.51],
          itemStyle: {
            color: "#439798"
          }
        }, {
          name: "Mar-26",
          type: "bar",
          stack: null,
          data: [57995.18, 9117.49, 10070.85, 4224.25, 12310.75, 5227.16],
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
export default Slide2;
