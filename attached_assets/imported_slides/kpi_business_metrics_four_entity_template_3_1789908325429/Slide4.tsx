import React, { useState, useEffect, useRef } from "react";
const Slide4: React.FC = () => {
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
      const s = Math.min(w / 1280, h / 883.17);
      setLayout({
        s,
        x: (w - 1280 * s) / 2,
        y: (h - 883.17 * s) / 2
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div id="slide-4" ref={outerRef} className="w-screen h-screen overflow-hidden relative" style={{
    backgroundColor: "#000"
  }}><div id="slide-inner-4" style={{
      position: "absolute",
      width: "1280px",
      height: "883.17px",
      overflow: "hidden",
      transformOrigin: "top left",
      color: "#000000",
      backgroundColor: "#FFFFFF",
      transform: `scale(${layout.s})`,
      left: layout.x + "px",
      top: layout.y + "px"
    }}><div key={0} style={{
        position: "absolute",
        left: "0px",
        top: "0px",
        width: "1279.97px",
        height: "8.64px",
        boxSizing: "border-box",
        backgroundColor: "#A83678",
        border: "1.33px solid rgba(168, 54, 120, 0)"
      }} /><div key={1} style={{
        position: "absolute",
        left: "0px",
        top: "8.64px",
        width: "211.2px",
        height: "5.28px",
        boxSizing: "border-box",
        backgroundColor: "#A83678",
        border: "1.33px solid rgba(168, 54, 120, 0)"
      }} /><div key={2} style={{
        position: "absolute",
        left: "211.2px",
        top: "8.64px",
        width: "259.2px",
        height: "5.28px",
        boxSizing: "border-box",
        backgroundColor: "#F08A21",
        border: "1.33px solid rgba(240, 138, 33, 0)"
      }} /><div key={3} style={{
        position: "absolute",
        left: "470.4px",
        top: "8.64px",
        width: "297.6px",
        height: "5.28px",
        boxSizing: "border-box",
        backgroundColor: "#009B76",
        border: "1.33px solid rgba(0, 155, 118, 0)"
      }} /><div key={4} style={{
        position: "absolute",
        left: "768px",
        top: "8.64px",
        width: "220.8px",
        height: "5.28px",
        boxSizing: "border-box",
        backgroundColor: "#0097A7",
        border: "1.33px solid rgba(0, 151, 167, 0)"
      }} /><div key={5} style={{
        position: "absolute",
        left: "988.8px",
        top: "8.64px",
        width: "291.17px",
        height: "5.28px",
        boxSizing: "border-box",
        backgroundColor: "#D9192B",
        border: "1.33px solid rgba(217, 25, 43, 0)"
      }} /><div key={6} style={{
        position: "absolute",
        left: "-110.4px",
        top: "15.36px",
        width: "662.4px",
        height: "283.2px",
        boxSizing: "border-box",
        backgroundColor: "rgba(246, 239, 243, 0.72)",
        border: "1.33px solid rgba(246, 239, 243, 0)",
        clipPath: "path('M 331.2 0 A 331.2 141.6 0 0 1 662.4 141.6 L 331.2 141.6 Z')"
      }} /><div key={7} style={{
        position: "absolute",
        left: "710.4px",
        top: "19.2px",
        width: "662.4px",
        height: "312px",
        boxSizing: "border-box",
        backgroundColor: "rgba(246, 239, 243, 0.72)",
        border: "1.33px solid rgba(246, 239, 243, 0)",
        clipPath: "path('M 331.2 0 A 331.2 156 0 0 1 662.4 156 L 331.2 156 Z')"
      }} /><div key={8} style={{
        position: "absolute",
        left: "255.36px",
        top: "31.68px",
        width: "662.4px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "center",
          lineHeight: "1.2",
          fontSize: "calc(25pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(25pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Business Metrics {{report_month}}"}</span></p></div><div key={9} style={{
        position: "absolute",
        left: "1139.52px",
        top: "28.8px",
        width: "103.68px",
        height: "53.76px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Bosch"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Global"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Software"}</span></p><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Technologies"}</span></p></div><div key={10} style={{
        position: "absolute",
        left: "1139.52px",
        top: "82.56px",
        width: "103.68px",
        height: "11.52px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(4.6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(4.6pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#626262"
          }}>{"Be future-ready."}</span></p></div><div key={11} style={{
        position: "absolute",
        left: "196.8px",
        top: "95.04px",
        width: "201.6px",
        height: "51.84px",
        boxSizing: "border-box",
        backgroundColor: "#FFFFFF",
        border: "1.33px solid #B8B8B8",
        borderRadius: "4.8px"
      }} /><div key={12} style={{
        position: "absolute",
        left: "209.28px",
        top: "106.56px",
        width: "44.16px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "#006578",
        border: "1.33px solid #FFFFFF",
        borderRadius: "50%"
      }} /><svg key={13} style={{
        position: "absolute",
        left: "231.36px",
        top: "108.48px",
        width: "1px",
        height: "24.96px",
        overflow: "visible"
      }}><line x1="0" y1="0" x2="0" y2="24.96" stroke="#FFFFFF" strokeWidth="1.33" /></svg><svg key={14} style={{
        position: "absolute",
        left: "215.04px",
        top: "120.96px",
        width: "32.64px",
        height: "1px",
        overflow: "visible"
      }}><line x1="0" y1="0" x2="32.64" y2="0" stroke="#FFFFFF" strokeWidth="1.33" /></svg><div key={15} style={{
        position: "absolute",
        left: "262.08px",
        top: "107.52px",
        width: "122.88px",
        height: "15.36px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            color: "#303030"
          }}>{"Worldwide (WW)"}</span></p></div><div key={16} style={{
        position: "absolute",
        left: "420.48px",
        top: "95.04px",
        width: "201.6px",
        height: "51.84px",
        boxSizing: "border-box",
        backgroundColor: "#FFFFFF",
        border: "1.33px solid #B8B8B8",
        borderRadius: "4.8px"
      }} /><div key={17} style={{
        position: "absolute",
        left: "432.96px",
        top: "106.56px",
        width: "44.16px",
        height: "9.6px",
        boxSizing: "border-box",
        backgroundColor: "#FF9933",
        border: "1.33px solid rgba(255, 153, 51, 0)"
      }} /><div key={18} style={{
        position: "absolute",
        left: "432.96px",
        top: "116.16px",
        width: "44.16px",
        height: "9.6px",
        boxSizing: "border-box",
        backgroundColor: "#F8F8F8",
        border: "1.33px solid rgba(248, 248, 248, 0)"
      }} /><div key={19} style={{
        position: "absolute",
        left: "432.96px",
        top: "125.76px",
        width: "44.16px",
        height: "9.6px",
        boxSizing: "border-box",
        backgroundColor: "#138808",
        border: "1.33px solid rgba(19, 136, 8, 0)"
      }} /><div key={20} style={{
        position: "absolute",
        left: "451.95px",
        top: "117.79px",
        width: "6.18px",
        height: "6.34px",
        boxSizing: "border-box",
        backgroundColor: "rgba(248, 248, 248, 0)",
        border: "1.33px solid #000080",
        borderRadius: "50%"
      }} /><div key={21} style={{
        position: "absolute",
        left: "485.76px",
        top: "107.52px",
        width: "122.88px",
        height: "15.36px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            color: "#303030"
          }}>{"India (IN)"}</span></p></div><div key={22} style={{
        position: "absolute",
        left: "644.16px",
        top: "95.04px",
        width: "201.6px",
        height: "51.84px",
        boxSizing: "border-box",
        backgroundColor: "#FFFFFF",
        border: "1.33px solid #B8B8B8",
        borderRadius: "4.8px"
      }} /><div key={23} style={{
        position: "absolute",
        left: "656.64px",
        top: "106.56px",
        width: "44.16px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "#D9192B",
        border: "1.33px solid rgba(217, 25, 43, 0)"
      }} /><div key={24} style={{
        position: "absolute",
        left: "668.16px",
        top: "110.88px",
        width: "21.12px",
        height: "19.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "center",
          lineHeight: "1.2",
          fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#F7D117"
          }}>{"\u2605"}</span></p></div><div key={25} style={{
        position: "absolute",
        left: "709.44px",
        top: "107.52px",
        width: "122.88px",
        height: "15.36px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            color: "#303030"
          }}>{"Vietnam (VN)"}</span></p></div><div key={26} style={{
        position: "absolute",
        left: "867.84px",
        top: "95.04px",
        width: "201.6px",
        height: "51.84px",
        boxSizing: "border-box",
        backgroundColor: "#F2D9E5",
        border: "1.33px solid #A83678",
        borderRadius: "4.8px"
      }} /><div key={27} style={{
        position: "absolute",
        left: "880.32px",
        top: "106.56px",
        width: "14.72px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "#006847",
        border: "1.33px solid rgba(0, 104, 71, 0)"
      }} /><div key={28} style={{
        position: "absolute",
        left: "895.04px",
        top: "106.56px",
        width: "14.72px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "#F8F8F8",
        border: "1.33px solid rgba(248, 248, 248, 0)"
      }} /><div key={29} style={{
        position: "absolute",
        left: "909.76px",
        top: "106.56px",
        width: "14.72px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "#CE1126",
        border: "1.33px solid rgba(206, 17, 38, 0)"
      }} /><div key={30} style={{
        position: "absolute",
        left: "899.31px",
        top: "117.5px",
        width: "6.18px",
        height: "6.91px",
        boxSizing: "border-box",
        backgroundColor: "#8B5A2B",
        border: "1.33px solid rgba(139, 90, 43, 0)",
        borderRadius: "50%"
      }} /><div key={31} style={{
        position: "absolute",
        left: "933.12px",
        top: "107.52px",
        width: "122.88px",
        height: "15.36px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "left",
          lineHeight: "1.2",
          fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(7.3pt * var(--pptx-font-scale, 1))",
            fontFamily: "Arial, 'Helvetica Neue', sans-serif",
            fontWeight: "700",
            color: "#8C2465"
          }}>{"Mexico (MX)"}</span></p></div><div key={32} style={{
        position: "absolute",
        left: "933.12px",
        top: "125.76px",
        width: "86.4px",
        height: "9.6px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(4.9pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(4.9pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"ACTIVE"}</span></p></div><div key={33} style={{
        position: "absolute",
        left: "34.56px",
        top: "161.28px",
        width: "1211.52px",
        height: "655.68px",
        boxSizing: "border-box",
        backgroundColor: "#D9D9D9",
        border: "1.33px solid #777777"
      }} /><div key={34} style={{
        position: "absolute",
        left: "46.08px",
        top: "169.92px",
        width: "556.8px",
        height: "19.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700",
            color: "#A83678"
          }}>{"Decision / info to GLs \u2014 NE-MX"}</span></p></div><div key={35} style={{
        position: "absolute",
        left: "61.44px",
        top: "215.14px",
        width: "384px",
        height: "16.32px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700"
          }}>{"Budget / Revenue:"}</span></p></div><div key={36} style={{
        position: "absolute",
        left: "75.84px",
        top: "234.34px",
        width: "1125.12px",
        height: "85.44px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_budget_revenue_summary}}"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_budget_revenue_detail}}"}</span></p></div><div key={37} style={{
        position: "absolute",
        left: "66.33px",
        top: "359.79px",
        width: "384px",
        height: "16.32px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700"
          }}>{"Internal Utilization:"}</span></p></div><div key={38} style={{
        position: "absolute",
        left: "80.73px",
        top: "378.99px",
        width: "1125.12px",
        height: "79.68px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_internal_utilization_summary}}"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_internal_utilization_detail}}"}</span></p></div><div key={39} style={{
        position: "absolute",
        left: "64.32px",
        top: "518.84px",
        width: "384px",
        height: "26.5px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(10.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700"
          }}>{"Capacity (Internal + External):"}</span></p></div><div key={40} style={{
        position: "absolute",
        left: "78.72px",
        top: "538.04px",
        width: "1125.12px",
        height: "129.4px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_capacity_summary}}"}</span></p><p style={{
          lineHeight: "1.2",
          fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(8pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif"
          }}>{"{{mx_capacity_detail}}"}</span></p></div><svg key={41} style={{
        position: "absolute",
        left: "54.72px",
        top: "713.25px",
        width: "1184.64px",
        height: "1px",
        overflow: "visible"
      }}><line x1="0" y1="0" x2="1184.64" y2="0" stroke="#AFAFAF" strokeWidth="1.33" /></svg><div key={42} style={{
        position: "absolute",
        left: "54.72px",
        top: "724.77px",
        width: "192px",
        height: "16.32px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700"
          }}>{"Source & governance"}</span></p></div><div key={43} style={{
        position: "absolute",
        left: "54.72px",
        top: "746.85px",
        width: "1178.88px",
        height: "28.8px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            color: "#626262"
          }}>{"{{mx_source_note}}  \u2022  Actuals: {{mx_actual_source_label}}  \u2022  Forecast: {{mx_forecast_source_label}}  \u2022  {{mx_period_label}}"}</span></p></div><div key={44} style={{
        position: "absolute",
        left: "54.72px",
        top: "780.45px",
        width: "1178.88px",
        height: "23.04px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontStyle: "italic",
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            color: "#626262"
          }}>{"Warnings / data-quality notes: {{mx_warnings}}"}</span></p></div><div key={45} style={{
        position: "absolute",
        left: "996.73px",
        top: "827.77px",
        width: "240px",
        height: "12.48px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "right",
          lineHeight: "1.2",
          fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(6pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            color: "#626262"
          }}>{"{{mx_entity_label}}  \u2022  Slide 4 of 4"}</span></p></div><div key={46} style={{
        position: "absolute",
        left: "0px",
        top: "840px",
        width: "480px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "#006578",
        border: "1.33px solid rgba(0, 101, 120, 0)"
      }} /><div key={47} style={{
        position: "absolute",
        left: "480px",
        top: "840px",
        width: "230.4px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "#D9192B",
        border: "1.33px solid rgba(217, 25, 43, 0)"
      }} /><div key={48} style={{
        position: "absolute",
        left: "710.4px",
        top: "840px",
        width: "249.6px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "#0097A7",
        border: "1.33px solid rgba(0, 151, 167, 0)"
      }} /><div key={49} style={{
        position: "absolute",
        left: "960px",
        top: "840px",
        width: "319.97px",
        height: "43.2px",
        boxSizing: "border-box",
        backgroundColor: "#F08A21",
        border: "1.33px solid rgba(240, 138, 33, 0)"
      }} /><div key={50} style={{
        position: "absolute",
        left: "42.24px",
        top: "853.44px",
        width: "547.2px",
        height: "11.52px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          lineHeight: "1.2",
          fontSize: "calc(5.5pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(5.5pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700",
            color: "#FFFFFF"
          }}>{"Internal | Governed Enterprise Data | KPI Metrics Board"}</span></p></div><div key={51} style={{
        position: "absolute",
        left: "1127.04px",
        top: "848.64px",
        width: "100.8px",
        height: "19.2px",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        padding: "0px 0px 0px 0px",
        wordWrap: "break-word"
      }}><p style={{
          textAlign: "center",
          lineHeight: "1.2",
          fontSize: "calc(9.3pt * var(--pptx-font-scale, 1))",
          marginTop: "0",
          marginBottom: "0"
        }}><span style={{
            fontSize: "calc(9.3pt * var(--pptx-font-scale, 1))",
            fontFamily: "'Calibri', 'Helvetica Neue', Arial, sans-serif",
            fontWeight: "700",
            color: "#FFFFFF"
          }}>{"BOSCH"}</span></p></div></div></div>;
};
export default Slide4;
