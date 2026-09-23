import React, { useState, useEffect, useRef } from "react";
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
      backgroundColor: "#ffffff",
      transform: `scale(${layout.s})`,
      left: layout.x + "px",
      top: layout.y + "px"
    }}><div key={0} style={{
        position: "absolute",
        left: "27.01px",
        top: "28.19px",
        width: "1097.2px",
        height: "40.82px",
        boxSizing: "border-box",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#009999"
          }}>{"Balance Sheet \u2013 Assets"}</span><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#007BC0"
          }}>{" "}</span><span style={{
            fontSize: "calc(24pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Aptos', sans-serif",
            fontWeight: "700",
            color: "#D40694"
          }}>{"as of XX"}</span></p></div><div key={1} style={{
        position: "absolute",
        left: "624.75px",
        top: "87.64px",
        width: "616.37px",
        height: "544.72px",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Cash & Cash equivalents:"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on cash and cash equivalents)"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "1pt",
          textIndent: "-18px",
          paddingLeft: "18px",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            marginRight: "8px"
          }}>{"\xA7"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Trade Receivables:"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on trade receivables)"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#000000"
          }}>{"(Includes Unbilled Revenue, GMR, 859 mINR noncurrent) "}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other current assets:"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on current assets)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Investments in Group Entities:"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on investments in group entities)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Fixed Assets:"}</span></p><p style={{
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on fixed assets)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "1pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#000000"
          }}>{"Other Noncurrent assets:"}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
            color: "#000000"
          }}>{"(Pointers on non-current assets)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            color: "#ED0007"
          }}>{" "}</span></p></div><div key={2} style={{
        position: "absolute",
        left: "27.01px",
        top: "415.41px",
        width: "303.43px",
        height: "10.66px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#C00000"
          }}>{"Notes: <if there is any note from the bar graph>"}</span></p></div><div key={3} style={{
        position: "absolute",
        left: "27.01px",
        top: "447.51px",
        width: "573.55px",
        height: "163.59px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700",
            color: "#C00000"
          }}>{"Key pointers on old balances:"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700"
          }}>{"Trade receivables: "}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
          }}>{"(Pointers on trade receivables)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontWeight: "700"
          }}>{"Other current assets: "}</span></p><p style={{
          textAlign: "justify",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
          }}>{"(Pointers on current assets)"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          marginTop: "5pt",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))"
          }}>{"\xA0"}</span></p></div><div key={4} style={{
        position: "absolute",
        left: "44.65px",
        top: "104.93px",
        width: "513.49px",
        height: "285.77px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        borderRadius: "47.63px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "4.8px 9.6px 4.8px 9.6px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "center",
          lineHeight: "1.2",
          fontSize: "calc(18pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(18pt * var(--pptx-font-scale, 1))",
            color: "#002060"
          }}>{"Placeholder for bar graph: representing change in Asset type between two time periods"}</span></p></div></div></div>;
};
export default Slide1;
